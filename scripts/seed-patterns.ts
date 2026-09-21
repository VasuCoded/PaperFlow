/**
 * seed-patterns.ts (BUILD-PLAN C1 item 17).
 *
 * Seeds paper_patterns and pattern_sections from docs/patterns/*.json, all
 * owned by the platform institute. Idempotent (keyed on owner + class_subject +
 * name). Taxonomy must be seeded first (a pattern references a class-subject).
 *
 * Usage: SUPABASE_DB_URL=... npx tsx scripts/seed-patterns.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const patternsDir = join(__dirname, "..", "docs", "patterns");

const PLATFORM_ID =
  process.env.PLATFORM_INSTITUTE_ID ?? "11111111-1111-1111-1111-111111111111";

type Section = {
  label: string;
  instructions?: string;
  question_count: number;
  marks_each: number;
  question_types?: string[];
  allow_choice?: boolean;
  practice_eligible?: boolean;
  requires_stimulus?: boolean;
};
type Pattern = {
  name: string;
  class: string;
  subject: string;
  total_marks: number;
  duration_min?: number;
  origin: "board" | "institute";
  is_default?: boolean;
  sections: Section[];
};

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) throw new Error("SUPABASE_DB_URL not set");

  const files = readdirSync(patternsDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.log("no pattern JSONs found in docs/patterns/");
    return;
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    for (const file of files) {
      const p = JSON.parse(readFileSync(join(patternsDir, file), "utf8")) as Pattern;

      const { rows: csRows } = await client.query<{ id: string }>(
        `select cs.id from class_subjects cs
         join classes c on c.id = cs.class_id
         join subjects s on s.id = cs.subject_id
         where c.name = $1 and s.name = $2`,
        [p.class, p.subject],
      );
      if (csRows.length === 0) {
        console.warn(`skip ${file}: no class_subject for ${p.class} ${p.subject} (seed taxonomy first)`);
        continue;
      }
      const classSubjectId = csRows[0]!.id;

      // Idempotent upsert keyed on (owner, class_subject, name).
      const { rows: existing } = await client.query<{ id: string }>(
        `select id from paper_patterns
         where owner_institute_id = $1 and class_subject_id = $2 and name = $3`,
        [PLATFORM_ID, classSubjectId, p.name],
      );

      let patternId: string;
      if (existing.length > 0) {
        patternId = existing[0]!.id;
        await client.query(
          `update paper_patterns
           set total_marks = $2, duration_min = $3, origin = $4, is_default = $5
           where id = $1`,
          [patternId, p.total_marks, p.duration_min ?? null, p.origin, p.is_default ?? false],
        );
        // Sections are updated in place, matched by label, never deleted and
        // recreated: saved papers point at their pattern sections, so a delete
        // would fail (or orphan practice eligibility) once any paper exists.
        const labels = p.sections.map((s) => s.label);
        const { rows: gone } = await client.query<{ id: string; label: string }>(
          `select id, label from pattern_sections where pattern_id = $1 and not (label = any ($2::text[]))`,
          [patternId, labels],
        );
        for (const g of gone) {
          const { rowCount } = await client.query(`select 1 from paper_sections where pattern_section_id = $1 limit 1`, [g.id]);
          if (rowCount) console.warn(`warn ${file}: section ${g.label} is no longer in the file but saved papers use it; left in place`);
          else await client.query(`delete from pattern_sections where id = $1`, [g.id]);
        }
      } else {
        const { rows } = await client.query<{ id: string }>(
          `insert into paper_patterns
             (owner_institute_id, class_subject_id, name, total_marks, duration_min, origin, is_default)
           values ($1, $2, $3, $4, $5, $6, $7) returning id`,
          [PLATFORM_ID, classSubjectId, p.name, p.total_marks, p.duration_min ?? null, p.origin, p.is_default ?? false],
        );
        patternId = rows[0]!.id;
      }

      let order = 0;
      let computed = 0;
      for (const s of p.sections) {
        await client.query(
          `insert into pattern_sections
             (pattern_id, owner_institute_id, label, sort_order, instructions,
              question_count, marks_each, question_types, allow_choice,
              practice_eligible, requires_stimulus)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           on conflict (pattern_id, label) do update set
             sort_order = excluded.sort_order, instructions = excluded.instructions,
             question_count = excluded.question_count, marks_each = excluded.marks_each,
             question_types = excluded.question_types, allow_choice = excluded.allow_choice,
             practice_eligible = excluded.practice_eligible, requires_stimulus = excluded.requires_stimulus`,
          [
            patternId, PLATFORM_ID, s.label, order++, s.instructions ?? null,
            s.question_count, s.marks_each, s.question_types ?? [],
            s.allow_choice ?? false, s.practice_eligible ?? true, s.requires_stimulus ?? false,
          ],
        );
        computed += s.question_count * s.marks_each;
      }
      if (computed !== p.total_marks) {
        console.warn(
          `warn ${file}: sections sum to ${computed} but total_marks is ${p.total_marks}`,
        );
      }
      console.log(`seeded pattern "${p.name}" (${p.sections.length} sections, ${computed} marks)`);
    }
    console.log("pattern seed complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
