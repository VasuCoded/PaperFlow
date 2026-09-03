/**
 * Tenancy lint. Two checks, both fail the build:
 *
 * 1. Every base table in the public schema must carry either `institute_id`
 *    or `owner_institute_id`, unless it is on the allowlist in
 *    docs/global-tables.txt. A new table with no tenant key and no allowlist
 *    entry is a tenancy bug waiting to happen — red CI.
 *
 * 2. The escape-hatch pattern `or is_platform_owner()` must never appear
 *    inside a `create policy` block in supabase/migrations (BUILD-PLAN 6.5).
 *    Platform access to *tenant* data goes through the audited functions in
 *    section 5.8, never a blanket OR branch on a tenant-scoped table.
 *    (is_platform_owner() used as the *sole* clause of a write policy on the
 *    global/bank tables is legitimate and intended — see 5.0.)
 *
 * Check 1 needs a live database, reached via SUPABASE_DB_URL. When that env
 * var is absent (e.g. no local Postgres yet) it is skipped with a warning and
 * check 2 still runs, because check 2 is purely a static scan of the
 * migration files and is the cheaper half to keep honest.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";

function loadAllowlist(): Set<string> {
  const path = join(repoRoot, "docs", "global-tables.txt");
  const raw = readFileSync(path, "utf8");
  const names = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  return new Set(names);
}

/** Check 2: static scan of migration SQL for a forbidden pattern. */
function checkNoPlatformOwnerInPolicies(): string[] {
  const migDir = join(repoRoot, "supabase", "migrations");
  const errors: string[] = [];
  if (!existsSync(migDir)) return errors;

  const escapeHatch = /\bor\s+is_platform_owner\s*\(\s*\)/;
  const files = readdirSync(migDir).filter((f) => f.endsWith(".sql"));
  for (const file of files) {
    const sql = readFileSync(join(migDir, file), "utf8").toLowerCase();
    // Split into statements on semicolons, find create policy blocks.
    const statements = sql.split(";");
    for (const stmt of statements) {
      if (stmt.includes("create policy") && escapeHatch.test(stmt)) {
        errors.push(
          `${file}: "or is_platform_owner()" escape hatch inside a create ` +
            `policy block. Platform access to tenant data goes through the ` +
            `audited inspect functions (BUILD-PLAN 5.8), not a blanket branch.`,
        );
      }
    }
  }
  return errors;
}

/** Check 1: every base table has a tenant key or is allowlisted. */
async function checkTenantKeys(allowlist: Set<string>): Promise<string[]> {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.warn(
      `${YELLOW}tenancy-lint: SUPABASE_DB_URL not set — skipping the ` +
        `table-column check (needs a live database). Static policy scan still runs.${RESET}`,
    );
    return [];
  }

  // Dynamic import so the script runs without `pg` installed until a DB exists.
  let Client: typeof import("pg").Client;
  try {
    ({ Client } = await import("pg"));
  } catch {
    console.warn(
      `${YELLOW}tenancy-lint: "pg" not installed — skipping table-column check.${RESET}`,
    );
    return [];
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ table_name: string }>(`
      select t.table_name
      from information_schema.tables t
      where t.table_schema = 'public'
        and t.table_type = 'BASE TABLE'
      order by t.table_name
    `);

    const errors: string[] = [];
    for (const { table_name } of rows) {
      if (allowlist.has(table_name)) continue;

      const { rows: cols } = await client.query<{ column_name: string }>(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = $1
           and column_name in ('institute_id', 'owner_institute_id')`,
        [table_name],
      );
      if (cols.length === 0) {
        errors.push(
          `table "${table_name}" has no institute_id/owner_institute_id and ` +
            `is not on docs/global-tables.txt.`,
        );
      }
    }
    return errors;
  } finally {
    await client.end();
  }
}

async function main() {
  const allowlist = loadAllowlist();
  const errors: string[] = [];

  errors.push(...checkNoPlatformOwnerInPolicies());
  errors.push(...(await checkTenantKeys(allowlist)));

  if (errors.length > 0) {
    console.error(`${RED}tenancy-lint FAILED:${RESET}`);
    for (const e of errors) console.error(`  ${RED}✗${RESET} ${e}`);
    process.exit(1);
  }

  console.log(`${GREEN}tenancy-lint passed.${RESET}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
