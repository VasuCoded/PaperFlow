import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { bootstrapDb } from "../../scripts/schema-harness";

/**
 * Executable tests for the eligible-pool SQL (migration 0009), run against the
 * real migrations in an in-process Postgres.
 *
 * The property under test is the one BUILD-PLAN C8 warns about: the teacher's
 * chapter counts and the generator's pool must be the SAME pool. If they drift,
 * a teacher sees a count they cannot draw from.
 */
const PLATFORM = "11111111-1111-1111-1111-111111111111";
const INST_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const INST_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CS = "c5000000-0000-0000-0000-000000000001";
const CH1 = "c4a70000-0000-0000-0000-000000000001";
const CH2 = "c4a70000-0000-0000-0000-000000000002";
const TEACHER = "a2a2a2a2-0000-0000-0000-000000000001";

let db: PGlite;

async function n(sql: string, params: unknown[] = []): Promise<number> {
  const r = await db.query<{ n: number }>(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;

  await db.exec(`
    insert into auth.users (id, email) values
      ('${TEACHER}', 'teacher@a.test') on conflict do nothing;

    insert into institutes (id, name, slug, kind, status) values
      ('${INST_A}', 'A', 'a', 'institute', 'active'),
      ('${INST_B}', 'B', 'b', 'institute', 'active') on conflict do nothing;

    insert into classes (id, name) values ('00000010-0000-0000-0000-000000000010', '10')
      on conflict do nothing;
    insert into subjects (id, name) values ('5c1e0000-0000-0000-0000-000000000001', 'Science')
      on conflict do nothing;
    insert into class_subjects (id, class_id, subject_id, bank_status) values
      ('${CS}', '00000010-0000-0000-0000-000000000010',
       '5c1e0000-0000-0000-0000-000000000001', 'ready') on conflict do nothing;
    insert into chapters (id, class_subject_id, name, sort_order) values
      ('${CH1}', '${CS}', 'Chapter One', 1),
      ('${CH2}', '${CS}', 'Chapter Two', 2) on conflict do nothing;
  `);

  // 4 shared, 2 private to A, 3 private to B — all approved
  const rows: string[] = [];
  const mk = (id: string, owner: string, ch: string) =>
    `('${id}', '${owner}', '${CS}', '${ch}', 'q ${id}', 'mcq', 1, 'easy')`;
  for (let i = 1; i <= 4; i++) rows.push(mk(`f0000000-0000-0000-0000-00000000000${i}`, PLATFORM, CH1));
  for (let i = 1; i <= 2; i++) rows.push(mk(`a0000000-0000-0000-0000-00000000000${i}`, INST_A, CH1));
  for (let i = 1; i <= 3; i++) rows.push(mk(`b0000000-0000-0000-0000-00000000000${i}`, INST_B, CH2));

  await db.exec(`
    insert into questions
      (id, owner_institute_id, class_subject_id, chapter_id, body, question_type, marks, difficulty)
    values ${rows.join(",")};
    -- the status guard forces inserts to 'staging'
    update questions set status = 'approved';
  `);
});

describe("eligible_questions", () => {
  it("returns the shared bank plus this institute's private layer only", async () => {
    const a = await n(`select count(*)::int as n from eligible_questions('${INST_A}', '${CS}')`);
    expect(a).toBe(6); // 4 shared + 2 private to A

    const b = await n(`select count(*)::int as n from eligible_questions('${INST_B}', '${CS}')`);
    expect(b).toBe(7); // 4 shared + 3 private to B
  });

  it("never leaks another institute's private questions", async () => {
    const leaked = await n(`
      select count(*)::int as n from eligible_questions('${INST_A}', '${CS}')
      where owner_institute_id = '${INST_B}'
    `);
    expect(leaked).toBe(0);
  });

  it("suppresses a flagged question for the flagging institute ONLY", async () => {
    await db.exec(`
      insert into question_flags (institute_id, question_id, raised_by, reason, status)
      values ('${INST_A}', 'f0000000-0000-0000-0000-000000000001', '${TEACHER}', 'wrong', 'open');
    `);

    const a = await n(`select count(*)::int as n from eligible_questions('${INST_A}', '${CS}')`);
    expect(a).toBe(5); // A loses the flagged shared question

    const b = await n(`select count(*)::int as n from eligible_questions('${INST_B}', '${CS}')`);
    expect(b).toBe(7); // B still sees it — one tenant cannot pull it from everyone

    // resolving the flag returns it to A's pool
    await db.exec(`update question_flags set status = 'resolved' where institute_id = '${INST_A}'`);
    expect(await n(`select count(*)::int as n from eligible_questions('${INST_A}', '${CS}')`)).toBe(6);
  });

  it("filters by chapter", async () => {
    const ch1 = await n(
      `select count(*)::int as n from eligible_questions('${INST_A}', '${CS}', array['${CH1}']::uuid[])`,
    );
    expect(ch1).toBe(6);
    const ch2 = await n(
      `select count(*)::int as n from eligible_questions('${INST_A}', '${CS}', array['${CH2}']::uuid[])`,
    );
    expect(ch2).toBe(0); // chapter two is all institute B's
  });

  it("excludes questions used in the teacher's recent papers", async () => {
    await db.exec(`
      insert into papers (id, institute_id, teacher_id, class_subject_id, title, status)
      values ('9a9e0000-0000-0000-0000-00000000000a', '${INST_A}', '${TEACHER}', '${CS}', 'UT1', 'generated');
      insert into paper_sections (id, institute_id, paper_id, label)
      values ('5ec00000-0000-0000-0000-00000000000a', '${INST_A}', '9a9e0000-0000-0000-0000-00000000000a', 'A');
      insert into paper_blocks (id, institute_id, paper_id, section_id, canonical_position)
      values ('b10c0000-0000-0000-0000-00000000000a', '${INST_A}', '9a9e0000-0000-0000-0000-00000000000a',
              '5ec00000-0000-0000-0000-00000000000a', 1);
      insert into paper_questions (institute_id, paper_id, block_id, question_id, marks)
      values ('${INST_A}', '9a9e0000-0000-0000-0000-00000000000a',
              'b10c0000-0000-0000-0000-00000000000a', 'f0000000-0000-0000-0000-000000000002', 1);
    `);

    const guarded = await n(`
      select count(*)::int as n
      from eligible_questions('${INST_A}', '${CS}', null, '${TEACHER}', 3)
    `);
    expect(guarded).toBe(5); // the used question is held back

    const unguarded = await n(`
      select count(*)::int as n
      from eligible_questions('${INST_A}', '${CS}', null, '${TEACHER}', 0)
    `);
    expect(unguarded).toBe(6); // repeat guard off -> back in the pool
  });
});

describe("chapter_pool_counts", () => {
  it("agrees exactly with eligible_questions, per chapter", async () => {
    const counts = await db.query<{ chapter_id: string; approved: number }>(
      `select chapter_id, approved::int as approved from chapter_pool_counts('${INST_A}', '${CS}')`,
    );
    expect(counts.rows.length).toBe(2);

    for (const row of counts.rows) {
      const direct = await n(
        `select count(*)::int as n from eligible_questions('${INST_A}', '${CS}', array['${row.chapter_id}']::uuid[])`,
      );
      // this is the invariant: the number shown to the teacher IS the pool
      expect(Number(row.approved)).toBe(direct);
    }
  });

  it("lists every chapter, including the empty ones", async () => {
    const rows = await db.query<{ chapter_name: string; approved: number }>(
      `select chapter_name, approved::int as approved from chapter_pool_counts('${INST_A}', '${CS}')`,
    );
    const byName = new Map(rows.rows.map((r) => [r.chapter_name, Number(r.approved)]));
    expect(byName.get("Chapter One")).toBe(6);
    expect(byName.get("Chapter Two")).toBe(0);
  });
});
