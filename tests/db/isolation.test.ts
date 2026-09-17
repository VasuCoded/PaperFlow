import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";

/**
 * THE CROSS-TENANT ISOLATION SUITE (BUILD-PLAN C12 item 7), executable in
 * `npm test` against the real migrations.
 *
 * supabase/tests/isolation.test.sql needs a live database and so has never
 * run. It also had two holes this version closes:
 *   - it enumerated only tables with an `institute_id` column, skipping the
 *     five keyed by `owner_institute_id` (questions, stimuli, question_assets,
 *     paper_patterns, pattern_sections) — the private question bank;
 *   - its fixture left most tables empty for institute B, so "zero B rows
 *     visible" passed vacuously for them.
 *
 * Here every tenant table is enumerated from information_schema, and the suite
 * FAILS if any of them has no rows for institute B. A new tenant table
 * therefore fails until it is seeded below — which forces someone to think
 * about its policies.
 */
const PLATFORM = "11111111-1111-1111-1111-111111111111";
const CS = "c5000000-0000-0000-0000-000000000001";
const CH = "c4a70000-0000-0000-0000-000000000001";
const TOPIC = "40910000-0000-0000-0000-000000000001";
const SHARED_Q = "90000000-0000-0000-0000-0000000000f1";

/** Deterministic ids per institute: `a0000000-…-00000000000n` or `b…`. */
function tenant(letter: "a" | "b") {
  const id = (n: number) => `${letter}0000000-0000-0000-0000-${n.toString(16).padStart(12, "0")}`;
  return {
    letter,
    inst: `${letter.repeat(8)}-${letter.repeat(4)}-${letter.repeat(4)}-${letter.repeat(4)}-${letter.repeat(12)}`,
    admin: id(1),
    teacher: id(2),
    student: id(3),
    onlyHere: id(4), // a student who belongs to this institute and no other
    batch: id(10),
    paper: id(11),
    section: id(12),
    block: id(13),
    paperQuestion: id(14),
    set: id(15),
    attempt: id(16),
    practiceSet: id(17),
    privateQ: id(18),
    stimulus: id(19),
    pattern: id(20),
  };
}

const A = tenant("a");
const B = tenant("b");

function seedSql(t: ReturnType<typeof tenant>) {
  return `
    insert into auth.users (id, email) values
      ('${t.admin}', 'admin@${t.letter}.test'), ('${t.teacher}', 'teacher@${t.letter}.test'),
      ('${t.student}', 'student@${t.letter}.test'), ('${t.onlyHere}', 'only@${t.letter}.test');
    insert into institutes (id, name, slug, kind, status) values ('${t.inst}', 'Institute ${t.letter}', 'inst-${t.letter}', 'institute', 'active');
    insert into institute_members (institute_id, user_id, role) values
      ('${t.inst}', '${t.admin}', 'institute_admin'), ('${t.inst}', '${t.teacher}', 'teacher'),
      ('${t.inst}', '${t.student}', 'student'), ('${t.inst}', '${t.onlyHere}', 'student');
    insert into institute_invites (institute_id, email, role, invited_by) values ('${t.inst}', 'pending@${t.letter}.test', 'student', '${t.admin}');
    insert into role_audit (institute_id, actor, target, old_role, new_role) values ('${t.inst}', '${t.admin}', '${t.teacher}', 'student', 'teacher');
    insert into platform_access_log (institute_id, action, target_table) values ('${t.inst}', 'inspect_institute', 'institutes');
    insert into institute_class_subjects (institute_id, class_subject_id, status) values ('${t.inst}', '${CS}', 'active');
    insert into activation_requests (institute_id, class_subject_id, requested_by) values ('${t.inst}', '${CS}', '${t.admin}');
    insert into teacher_subjects (institute_id, teacher_id, class_subject_id) values ('${t.inst}', '${t.teacher}', '${CS}');

    insert into stimuli (id, owner_institute_id, class_subject_id, kind, body) values ('${t.stimulus}', '${t.inst}', '${CS}', 'passage', 'private passage ${t.letter}');
    insert into questions (id, owner_institute_id, class_subject_id, chapter_id, topic_id, body, question_type, answer, marks, difficulty)
      values ('${t.privateQ}', '${t.inst}', '${CS}', '${CH}', '${TOPIC}', 'private question ${t.letter}', 'sa', 'answer ${t.letter}', 1, 'easy');
    update questions set status = 'approved' where id = '${t.privateQ}';
    insert into question_assets (owner_institute_id, question_id, storage_path) values ('${t.inst}', '${t.privateQ}', '${t.letter}/diagram.png');
    insert into paper_patterns (id, owner_institute_id, class_subject_id, name, total_marks, origin) values ('${t.pattern}', '${t.inst}', '${CS}', 'UT ${t.letter}', 1, 'institute');
    insert into pattern_sections (pattern_id, owner_institute_id, label, question_count, marks_each) values ('${t.pattern}', '${t.inst}', 'A', 1, 1);
    insert into question_flags (institute_id, question_id, raised_by, reason) values ('${t.inst}', '${SHARED_Q}', '${t.teacher}', 'wrong key?');

    insert into batches (id, institute_id, name, class_subject_id, teacher_id, join_code) values ('${t.batch}', '${t.inst}', '${t.letter}-10', '${CS}', '${t.teacher}', '');
    insert into enrolments (institute_id, batch_id, student_id, class_subject_id) values ('${t.inst}', '${t.batch}', '${t.student}', '${CS}');
    insert into papers (id, institute_id, teacher_id, batch_id, class_subject_id, title, status) values ('${t.paper}', '${t.inst}', '${t.teacher}', '${t.batch}', '${CS}', 'UT ${t.letter}', 'generated');
    insert into paper_sections (id, institute_id, paper_id, label) values ('${t.section}', '${t.inst}', '${t.paper}', 'A');
    insert into paper_blocks (id, institute_id, paper_id, section_id, canonical_position) values ('${t.block}', '${t.inst}', '${t.paper}', '${t.section}', 1);
    insert into paper_questions (id, institute_id, paper_id, block_id, question_id, marks) values ('${t.paperQuestion}', '${t.inst}', '${t.paper}', '${t.block}', '${SHARED_Q}', 1);
    insert into paper_sets (id, institute_id, paper_id, set_label) values ('${t.set}', '${t.inst}', '${t.paper}', 'A');
    insert into paper_set_items (institute_id, paper_set_id, paper_block_id, display_position) values ('${t.inst}', '${t.set}', '${t.block}', 0);
    insert into paper_set_options (institute_id, paper_set_id, paper_question_id, option_order) values ('${t.inst}', '${t.set}', '${t.paperQuestion}', '{B,A,D,C}');
    insert into attempts (id, institute_id, paper_id, student_id, paper_set_id) values ('${t.attempt}', '${t.inst}', '${t.paper}', '${t.student}', '${t.set}');
    insert into attempt_items (institute_id, attempt_id, question_id, is_correct) values ('${t.inst}', '${t.attempt}', '${SHARED_Q}', false);
    insert into practice_sets (id, institute_id, student_id, attempt_id, class_subject_id) values ('${t.practiceSet}', '${t.inst}', '${t.student}', '${t.attempt}', '${CS}');
    insert into practice_set_items (institute_id, practice_set_id, question_id) values ('${t.inst}', '${t.practiceSet}', '${SHARED_Q}');
    insert into question_exposure (institute_id, student_id, question_id) values ('${t.inst}', '${t.student}', '${SHARED_Q}');
    insert into coverage_gaps (institute_id, class_subject_id, topic_id, severity) values ('${t.inst}', '${CS}', '${TOPIC}', 'severe');
  `;
}

let db: PGlite;
let tables: { table_name: string; column_name: string }[] = [];

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;

  await db.exec(`
    insert into classes (id, name) values ('00000010-0000-0000-0000-000000000010', '10');
    insert into subjects (id, name) values ('5c1e0000-0000-0000-0000-000000000001', 'Science');
    insert into class_subjects (id, class_id, subject_id, bank_status)
      values ('${CS}', '00000010-0000-0000-0000-000000000010', '5c1e0000-0000-0000-0000-000000000001', 'ready');
    insert into chapters (id, class_subject_id, name) values ('${CH}', '${CS}', 'Chemical Reactions');
    insert into topics (id, chapter_id, name, slug) values ('${TOPIC}', '${CH}', 'Balancing', 'balancing');
    insert into questions (id, owner_institute_id, class_subject_id, chapter_id, topic_id, body, question_type, answer, marks, difficulty)
      values ('${SHARED_Q}', '${PLATFORM}', '${CS}', '${CH}', '${TOPIC}', 'shared question', 'mcq', 'shared', 1, 'easy');
    update questions set status = 'approved' where id = '${SHARED_Q}';
  `);
  await db.exec(seedSql(A));
  await db.exec(seedSql(B));

  tables = (
    await db.query<{ table_name: string; column_name: string }>(`
      select t.table_name, c.column_name
      from information_schema.tables t
      join information_schema.columns c
        on c.table_schema = t.table_schema and c.table_name = t.table_name
      where t.table_schema = 'public'
        and t.table_type = 'BASE TABLE'
        and c.column_name in ('institute_id', 'owner_institute_id')
      order by t.table_name
    `)
  ).rows;
});

afterEach(async () => {
  await actAsOwner(db);
});

const count = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);

describe("fixture", () => {
  it("enumerates the tenant tables, including the owner_institute_id ones", () => {
    const names = tables.map((t) => t.table_name);
    expect(names.length).toBeGreaterThanOrEqual(28);
    for (const t of ["questions", "stimuli", "question_assets", "paper_patterns", "pattern_sections", "attempts", "practice_sets"]) {
      expect(names).toContain(t);
    }
  });

  it("has rows for BOTH institutes in every tenant table, so no check below is vacuous", async () => {
    const empty: string[] = [];
    for (const { table_name, column_name } of tables) {
      for (const t of [A, B]) {
        const n = await count(`select count(*)::int as n from public.${table_name} where ${column_name} = '${t.inst}'`);
        if (n === 0) empty.push(`${table_name} (institute ${t.letter})`);
      }
    }
    expect(empty, "seed these tables in tests/db/isolation.test.ts and review their policies").toEqual([]);
  });
});

type Outcome = { ok: true } | { ok: false; code: string; message: string };

const OWNER_SQL = "reset role; select set_config('request.jwt.claims', '', true)";

/** Run `sql` as `uid` inside a savepoint, always returning to the owner role. */
async function attemptAs(uid: string, sql: string): Promise<Outcome> {
  await db.exec("savepoint probe");
  try {
    await db.exec(`
      select set_config('role', 'authenticated', true);
      select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true);
      ${sql};
    `);
    await db.exec(OWNER_SQL);
    await db.exec("release savepoint probe");
    return { ok: true };
  } catch (e) {
    await db.exec("rollback to savepoint probe");
    await db.exec(OWNER_SQL);
    const err = e as { code?: string; message?: string };
    return { ok: false, code: err.code ?? "", message: err.message ?? String(e) };
  }
}

/** "permission denied" — a privilege refusal at plan time, reached no rows. */
const noPrivilege = (o: Outcome) => !o.ok && o.code === "42501" && /permission denied/i.test(o.message);
/** A WITH CHECK refusal on the NEW row — only raised once a row was reached. */
const rlsCheckFailed = (o: Outcome) => !o.ok && o.code === "42501" && /row-level security/i.test(o.message);

/**
 * Why neither probe has a where clause, and why the update sets a constant:
 * Postgres applies a table's SELECT policy to UPDATE and DELETE only when the
 * statement READS columns (a where clause, RETURNING, or `set x = x`). A
 * correct SELECT policy would therefore mask a leaky UPDATE or DELETE policy
 * from a probe that reads — while `update t set note = 'x'` or `delete from t`
 * issued by an attacker would still reach institute B's rows.
 *
 * Everything runs in a transaction that is always rolled back.
 */
async function updateProbe(uid: string, table: string, column: string): Promise<string[]> {
  await db.exec("begin");
  try {
    // Leave ONLY institute B's rows in the table, so any row the user's
    // update reaches is B's. Triggers off for this cleanup and for the probe
    // (RLS is not a trigger and still applies), so cascades and guard
    // triggers cannot stand in for policies.
    await db.exec(`set local session_replication_role = replica;
      delete from public.${table} where ${column} is distinct from '${B.inst}'`);
    // An updated row is a new tuple version with a new xmin. (Not "xmin = this
    // transaction": the probe runs in a savepoint, whose rows carry the
    // subtransaction's xid.)
    const versions = async () =>
      new Set((await db.query<{ v: string }>(`select xmin::text as v from public.${table} where ${column} = '${B.inst}'`)).rows.map((r) => r.v));
    const before = await versions();
    const outcome = await attemptAs(uid, `update public.${table} set ${column} = '${B.inst}'::uuid`);
    if (outcome.ok) {
      const touched = [...(await versions())].filter((v) => !before.has(v)).length;
      return touched ? [`${table}: UPDATE reached B rows`] : [];
    }
    if (rlsCheckFailed(outcome)) return [`${table}: UPDATE reached B rows (stopped only by WITH CHECK)`];
    if (noPrivilege(outcome)) return [];
    throw new Error(`${table} update probe: ${outcome.message}`);
  } finally {
    await db.exec("rollback");
  }
}

async function deleteProbe(uid: string, table: string, column: string): Promise<string[]> {
  const bRows = `select count(*)::int as n from public.${table} where ${column} = '${B.inst}'`;
  await db.exec("begin");
  try {
    const before = await count(bRows);
    // First with triggers ON: a real delete by this user, cascades included.
    // Errors here other than a refusal are real bugs (this is how the
    // composite ON DELETE SET NULL bug in migration 0015 was found: 23502).
    let outcome = await attemptAs(uid, `delete from public.${table}`);
    if (!outcome.ok && outcome.code === "23503") {
      // A foreign key refused the statement, possibly only because of the
      // user's OWN dependent rows (a paper_set with logged attempts cannot be
      // deleted — intended). That must not mask B rows also being in reach:
      // retry with FK triggers off so whatever the policy lets through is
      // actually removed and counted.
      await db.exec("set local session_replication_role = replica");
      outcome = await attemptAs(uid, `delete from public.${table}`);
      await db.exec("set local session_replication_role = origin");
    }
    if (!outcome.ok && !noPrivilege(outcome)) throw new Error(`${table} delete probe: ${outcome.message}`);
    const after = await count(bRows);
    return after !== before ? [`${table}: DELETE removed ${before - after}`] : [];
  } finally {
    await db.exec("rollback");
  }
}

describe.each([
  ["student", A.student],
  ["teacher", A.teacher],
  ["institute_admin", A.admin],
] as const)("as %s of institute A", (role, uid) => {
  it("sees zero rows of institute B in every tenant table", async () => {
    const leaks: string[] = [];
    for (const { table_name, column_name } of tables) {
      await actAs(db, uid);
      const n = await count(`select count(*)::int as n from public.${table_name} where ${column_name} = '${B.inst}'`);
      if (n !== 0) leaks.push(`${table_name}: ${n}`);
    }
    expect(leaks, `${role} can SELECT institute B rows`).toEqual([]);
  });

  it("updates and deletes zero rows of institute B in every tenant table", async () => {
    const hits: string[] = [];
    for (const { table_name, column_name } of tables) {
      hits.push(...(await updateProbe(uid, table_name, column_name)));
      hits.push(...(await deleteProbe(uid, table_name, column_name)));
    }
    expect(hits, `${role} can modify institute B rows`).toEqual([]);
  });

  it("cannot see institute B, its people, or its subjects through the global tables and the view", async () => {
    await actAs(db, uid);
    expect(await count(`select count(*)::int as n from institutes where id = '${B.inst}'`)).toBe(0);
    expect(await count(`select count(*)::int as n from profiles where id in ('${B.admin}', '${B.teacher}', '${B.onlyHere}')`)).toBe(0);
    expect(await count(`select count(*)::int as n from my_active_class_subjects where institute_id = '${B.inst}'`)).toBe(0);
  });

  it("cannot open institute B's paper or read its private answers through the definer functions", async () => {
    await actAs(db, uid);
    expect((await db.query<{ ok: boolean }>(`select can_access_paper('${B.paper}') as ok`)).rows[0]?.ok).toBe(false);
    expect(await count(`select count(*)::int as n from get_question_solution('${B.privateQ}')`)).toBe(0);
    expect(await count(`select count(*)::int as n from eligible_questions('${B.inst}', '${CS}') where owner_institute_id = '${B.inst}'`)).toBe(0);
  });

  it("still sees its own institute — the suite is not passing because nothing is visible", async () => {
    await actAs(db, uid);
    expect(await count(`select count(*)::int as n from papers where institute_id = '${A.inst}'`)).toBe(1);
    expect(await count(`select count(*)::int as n from institutes where id = '${A.inst}'`)).toBe(1);
  });
});

describe("the B rows survived every attempt above", () => {
  it("institute B still has all its rows", async () => {
    await actAsOwner(db);
    for (const { table_name, column_name } of tables) {
      expect(await count(`select count(*)::int as n from public.${table_name} where ${column_name} = '${B.inst}'`), table_name).toBeGreaterThan(0);
    }
  });
});
