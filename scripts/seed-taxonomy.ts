/**
 * seed-taxonomy.ts (BUILD-PLAN C1 item 16).
 *
 * Reads docs/taxonomy/*.csv, one file per class-subject, and upserts classes,
 * subjects, class_subjects (bank_status='planned'), strands and chapters.
 * Idempotent. Topics are seeded separately, per activation (H6b).
 *
 * File naming: `<class>__<Subject Name>.csv`  e.g. `10__Social Science.csv`.
 * CSV columns (header row required): strand,chapter_number,chapter_name
 *   - `strand` may be blank for subjects without strands (e.g. Science).
 *
 * Usage: SUPABASE_DB_URL=... npx tsx scripts/seed-taxonomy.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const taxonomyDir = join(__dirname, "..", "docs", "taxonomy");

// Subject metadata: short name + script. Hindi (and any Devanagari subject)
// must be marked so text handling uses the `simple` tsv config + NFC.
const SUBJECT_META: Record<string, { short: string; script: "latin" | "devanagari" }> = {
  Physics: { short: "PHY", script: "latin" },
  Chemistry: { short: "CHE", script: "latin" },
  Mathematics: { short: "MAT", script: "latin" },
  Biology: { short: "BIO", script: "latin" },
  Science: { short: "SCI", script: "latin" },
  "Social Science": { short: "SST", script: "latin" },
  History: { short: "HIS", script: "latin" },
  Geography: { short: "GEO", script: "latin" },
  "Political Science": { short: "POL", script: "latin" },
  Economics: { short: "ECO", script: "latin" },
  English: { short: "ENG", script: "latin" },
  Hindi: { short: "HIN", script: "devanagari" },
};

type Row = { strand: string; chapter_number: string; chapter_name: string };

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { record.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (field !== "" || record.length > 0) { record.push(field); rows.push(record); }
      field = ""; record = [];
    } else field += ch;
  }
  if (field !== "" || record.length > 0) { record.push(field); rows.push(record); }

  if (rows.length === 0) return [];
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const iStrand = header.indexOf("strand");
  const iNum = header.indexOf("chapter_number");
  const iName = header.indexOf("chapter_name");
  if (iNum === -1 || iName === -1) {
    throw new Error("CSV must have columns: strand,chapter_number,chapter_name");
  }
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => ({
      strand: (iStrand === -1 ? "" : r[iStrand] ?? "").trim(),
      chapter_number: (r[iNum] ?? "").trim(),
      chapter_name: (r[iName] ?? "").trim(),
    }));
}

function parseFileName(file: string): { className: string; subjectName: string } {
  const base = file.replace(/\.csv$/i, "");
  const parts = base.split("__");
  if (parts.length !== 2) {
    throw new Error(`bad filename "${file}" — expected <class>__<Subject>.csv`);
  }
  return { className: parts[0]!.trim(), subjectName: parts[1]!.trim() };
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) throw new Error("SUPABASE_DB_URL not set");

  const files = readdirSync(taxonomyDir).filter((f) => f.endsWith(".csv"));
  if (files.length === 0) {
    console.log("no taxonomy CSVs found in docs/taxonomy/");
    return;
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    for (const file of files) {
      const { className, subjectName } = parseFileName(file);
      const meta = SUBJECT_META[subjectName];
      if (!meta) throw new Error(`unknown subject "${subjectName}" in ${file}`);
      const rows = parseCsv(readFileSync(join(taxonomyDir, file), "utf8"));

      const { rows: [cls] } = await client.query<{ id: string }>(
        `insert into classes (name, sort_order) values ($1, $2)
         on conflict (name) do update set sort_order = excluded.sort_order
         returning id`,
        [className, Number(className) || 0],
      );
      const { rows: [subj] } = await client.query<{ id: string }>(
        `insert into subjects (name, short_name, script) values ($1, $2, $3)
         on conflict (name) do update set short_name = excluded.short_name, script = excluded.script
         returning id`,
        [subjectName, meta.short, meta.script],
      );
      const { rows: [cs] } = await client.query<{ id: string }>(
        `insert into class_subjects (class_id, subject_id, bank_status)
         values ($1, $2, 'planned')
         on conflict (class_id, subject_id) do update set class_id = excluded.class_id
         returning id`,
        [cls!.id, subj!.id],
      );

      const strandIds = new Map<string, string>();
      let order = 0;
      for (const row of rows) {
        let strandId: string | null = null;
        if (row.strand) {
          if (!strandIds.has(row.strand)) {
            const { rows: [st] } = await client.query<{ id: string }>(
              `insert into strands (class_subject_id, name, sort_order) values ($1, $2, $3)
               on conflict (class_subject_id, name) do update set name = excluded.name
               returning id`,
              [cs!.id, row.strand, strandIds.size],
            );
            strandIds.set(row.strand, st!.id);
          }
          strandId = strandIds.get(row.strand)!;
        }
        await client.query(
          `insert into chapters (class_subject_id, strand_id, name, ncert_number, sort_order)
           values ($1, $2, $3, $4, $5)
           on conflict (class_subject_id, name)
           do update set strand_id = excluded.strand_id,
                         ncert_number = excluded.ncert_number,
                         sort_order = excluded.sort_order`,
          [cs!.id, strandId, row.chapter_name, row.chapter_number || null, order++],
        );
      }
      console.log(`seeded ${className} ${subjectName}: ${rows.length} chapters`);
    }
    console.log("taxonomy seed complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
