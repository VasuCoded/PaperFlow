/**
 * Apply every migration to an in-process Postgres and report what the schema
 * actually contains. Catches the errors a parser cannot: missing references,
 * composite foreign keys with no matching unique constraint, bad trigger
 * bodies, policies referencing columns that do not exist.
 *
 *   npm run db:verify
 */
import { bootstrapDb } from "./schema-harness";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

async function main() {
  console.log(`${DIM}applying migrations to in-process Postgres…${RESET}`);
  const { db, applied, failure } = await bootstrapDb();

  if (failure) {
    console.error(`\n${RED}FAILED in ${failure.file}${RESET}`);
    console.error(failure.error);
    console.error(`\n${applied.length} migration(s) applied before the failure.`);
    process.exit(1);
  }

  console.log(`\n${GREEN}all ${applied.length} migrations applied cleanly${RESET}\n`);

  const tables = await db.query<{ table_name: string; rls: boolean }>(`
    select c.relname as table_name, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `);
  const policies = await db.query<{ tablename: string; n: number }>(`
    select tablename, count(*)::int as n from pg_policies
    where schemaname = 'public' group by tablename order by tablename
  `);
  const funcs = await db.query<{ proname: string }>(`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' order by p.proname
  `);
  const triggers = await db.query<{ tgname: string; table_name: string }>(`
    select t.tgname, c.relname as table_name
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public','auth') and not t.tgisinternal
    order by c.relname, t.tgname
  `);
  const indexes = await db.query<{ n: number }>(
    `select count(*)::int as n from pg_indexes where schemaname = 'public'`,
  );

  const policyByTable = new Map(policies.rows.map((p) => [p.tablename, p.n]));

  console.log(`tables: ${tables.rows.length}   policies: ${policies.rows.reduce((a, p) => a + p.n, 0)}   functions: ${funcs.rows.length}   triggers: ${triggers.rows.length}   indexes: ${indexes.rows[0]?.n}`);

  // --- tenancy lint, run against the REAL applied schema -------------------
  const allow = new Set(
    (await import("node:fs"))
      .readFileSync(new URL("../docs/global-tables.txt", import.meta.url), "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#")),
  );
  const cols = await db.query<{ table_name: string; column_name: string }>(`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public'
      and column_name in ('institute_id','owner_institute_id')
  `);
  const tenantKeyed = new Set(cols.rows.map((r) => r.table_name));

  console.log("");
  let problems = 0;
  for (const t of tables.rows) {
    const keyed = tenantKeyed.has(t.table_name);
    const allowed = allow.has(t.table_name);
    const pol = policyByTable.get(t.table_name) ?? 0;
    const flags: string[] = [];
    if (!keyed && !allowed) {
      flags.push("NO TENANT KEY and not allowlisted");
      problems++;
    }
    if (!t.rls) {
      flags.push("RLS DISABLED");
      problems++;
    }
    if (pol === 0) {
      flags.push("no policies (deny-all)");
    }
    const mark = flags.length === 0 ? `${GREEN}ok${RESET}` : `${RED}${flags.join("; ")}${RESET}`;
    const key = keyed ? "tenant" : allowed ? "global" : "—";
    console.log(
      `  ${t.table_name.padEnd(28)} ${key.padEnd(7)} rls=${t.rls ? "on " : "OFF"} policies=${String(pol).padEnd(2)} ${mark}`,
    );
  }

  console.log("");
  if (problems > 0) {
    console.error(`${RED}${problems} problem(s) found.${RESET}`);
    process.exit(1);
  }
  console.log(`${GREEN}schema verified: every table tenant-keyed or allowlisted, RLS on everywhere.${RESET}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
