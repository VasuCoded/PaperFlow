/**
 * seed-staging.ts (BUILD-PLAN C12 item 10) — load the synthetic staging dataset
 * built by scripts/staging/staging-sql.ts into a STAGING Supabase project.
 *
 *   SUPABASE_DB_URL=<staging connection string> \
 *   STAGING_PASSWORD=<a password every staging person gets> \
 *   STAGING_OWNER=<your username> \
 *   STAGING_TESTERS='[{"login":"friend.username","role":"teacher","institute":"sunrise"}]' \
 *   npx tsx scripts/seed-staging.ts --i-know-this-is-staging
 *
 * With STAGING_PASSWORD set you can sign in as sunrise.admin, sunrise.teacher1,
 * sunrise.student1 (… riverside.*, hilltop.*) to see every role.
 *
 * Refuses unless:
 *   - the flag --i-know-this-is-staging is given, and
 *   - the database has no institute whose slug lacks the "staging-" prefix
 *     (a production database always has one).
 * Runs in one transaction; safe to re-run. STAGING_OWNER gets the platform
 * owner role only if that account already exists (sign up first).
 */
import { Client } from "pg";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertStagingTarget, STAGING_SLUG_PREFIX, stagingStatements, type StagingTester } from "./staging/staging-sql";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  if (!process.argv.includes("--i-know-this-is-staging")) {
    throw new Error("add --i-know-this-is-staging to confirm this connection string is a staging project");
  }
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is not set");

  const testers: StagingTester[] = process.env.STAGING_TESTERS ? JSON.parse(process.env.STAGING_TESTERS) : [];
  const statements = stagingStatements({
    repoRoot,
    testers,
    platformOwner: process.env.STAGING_OWNER || process.env.STAGING_OWNER_EMAIL || undefined,
    password: process.env.STAGING_PASSWORD || undefined,
    refreshContent: process.argv.includes("--refresh-content"),
  });

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ n: number }>(
      `select count(*)::int as n from public.institutes where kind = 'institute' and slug not like $1`,
      [`${STAGING_SLUG_PREFIX}%`],
    );
    assertStagingTarget(rows[0]?.n ?? 0);

    await client.query("begin");
    for (const [i, sql] of statements.entries()) {
      try {
        await client.query(sql);
      } catch (e) {
        throw new Error(`statement ${i + 1} of ${statements.length} failed: ${(e as Error).message}\n${sql.slice(0, 400)}`);
      }
    }
    await client.query("commit");

    const summary = await client.query<{ what: string; n: number }>(`
      select 'institutes' as what, count(*)::int as n from public.institutes where slug like 'staging-%'
      union all select 'approved questions', count(*)::int from public.questions where source like 'Staging%' and status = 'approved'
      union all select 'staged for review', count(*)::int from public.questions where source = 'Staging review sample' and status = 'staging'
      union all select 'papers', count(*)::int from public.papers p join public.institutes i on i.id = p.institute_id where i.slug like 'staging-%'
      union all select 'attempts', count(*)::int from public.attempts a join public.institutes i on i.id = a.institute_id where i.slug like 'staging-%'`);
    for (const r of summary.rows) console.log(`  ${r.what.padEnd(20)} ${r.n}`);
    console.log("staging seed complete.");
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
