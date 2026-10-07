import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";

/** Modules per institute and self-practice (migration 0027), and the practice-items fix. */
const PLATFORM = "11111111-1111-1111-1111-111111111111";
const INST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OWNER = "0f0f0f0f-0000-0000-0000-000000000001";
const ADMIN = "a1a1a1a1-0000-0000-0000-000000000001";
const S1 = "a3a3a3a3-0000-0000-0000-000000000001";
const S2 = "a3a3a3a3-0000-0000-0000-000000000002";
const CS = "c5000000-0000-0000-0000-000000000001";
const CH = "c4000000-0000-0000-0000-000000000001";
const BATCH = "ba700000-0000-0000-0000-000000000001";
const PAPER = "9a900000-0000-0000-0000-000000000001";
const PRIVATE_Q = "f0000000-0000-0000-0000-0000000000ff";

let db: PGlite;
const n = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);
const q = (i: number) => `f0000000-0000-0000-0000-${String(i).padStart(12, "0")}`;

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;
  const questions = Array.from({ length: 12 }, (_, i) =>
    `('${q(i + 1)}', '${PLATFORM}', '${CS}', '${CH}', 'Question ${i + 1}', 'sa', 2, '${["easy", "medium", "hard"][i % 3]}', 'approved')`).join(",");
  await db.exec(`
    insert into auth.users (id, email) values ('${OWNER}', 'o@p.test'), ('${ADMIN}', 'a@a.test'), ('${S1}', 's1@a.test'), ('${S2}', 's2@a.test');
    insert into institutes (id, name, slug, kind, status) values
      ('${INST}', 'Sunrise', 'sunrise', 'institute', 'active'), ('${OTHER}', 'Other', 'other', 'institute', 'active');
    insert into institute_members (institute_id, user_id, role) values
      ('${PLATFORM}', '${OWNER}', 'owner'), ('${INST}', '${ADMIN}', 'institute_admin'), ('${INST}', '${S1}', 'student'), ('${INST}', '${S2}', 'student');
    insert into classes (id, name) values ('00000010-0000-0000-0000-000000000010', '10');
    insert into subjects (id, name) values ('5c1e0000-0000-0000-0000-000000000001', 'Science');
    insert into class_subjects (id, class_id, subject_id, bank_status) values ('${CS}', '00000010-0000-0000-0000-000000000010', '5c1e0000-0000-0000-0000-000000000001', 'ready');
    insert into chapters (id, class_subject_id, name, sort_order) values ('${CH}', '${CS}', 'Ch 1', 1);
    insert into institute_class_subjects (institute_id, class_subject_id, status) values ('${INST}', '${CS}', 'active');
    insert into questions (id, owner_institute_id, class_subject_id, chapter_id, body, question_type, marks, difficulty, status) values ${questions};
    update questions set status = 'approved';
    insert into questions (id, owner_institute_id, class_subject_id, chapter_id, body, question_type, marks, difficulty, status)
      values ('${PRIVATE_Q}', '${OTHER}', '${CS}', '${CH}', 'Other institute private', 'sa', 2, 'easy', 'approved');
    update questions set status = 'approved', answer = 'secret' where id = '${PRIVATE_Q}';
    insert into batches (id, institute_id, name, teacher_id, join_code) values ('${BATCH}', '${INST}', 'Morning', '${ADMIN}', 'MORNAA');
    insert into batch_subjects (institute_id, batch_id, class_subject_id) values ('${INST}', '${BATCH}', '${CS}');
    insert into enrolments (institute_id, batch_id, student_id) values ('${INST}', '${BATCH}', '${S1}');
    insert into papers (id, institute_id, teacher_id, batch_id, class_subject_id, title, status, released_at)
      values ('${PAPER}', '${INST}', '${ADMIN}', '${BATCH}', '${CS}', 'Test', 'generated', now());
  `);
});

afterEach(async () => {
  await actAsOwner(db);
});

describe("modules", () => {
  it("defaults: everything on except self-practice", async () => {
    const r = await db.query<{ a: boolean; b: boolean; c: boolean; d: boolean }>(
      `select module_enabled('${INST}', 'student_app') a, module_enabled('${INST}', 'results') b, module_enabled('${INST}', 'teachers') c, module_enabled('${INST}', 'self_practice') d`);
    expect(r.rows[0]).toEqual({ a: true, b: true, c: true, d: false });
  });

  it("only the platform owner sets them, and unknown keys are dropped", async () => {
    await actAs(db, ADMIN);
    await expect(db.query(`select platform_set_modules('${INST}', '{"teachers": false}')`)).rejects.toThrow();
    await actAs(db, OWNER);
    await db.query(`select platform_set_modules('${INST}', '{"teachers": false, "bogus": true}')`);
    await actAsOwner(db);
    const m = (await db.query<{ modules: Record<string, boolean> }>(`select modules from institutes where id = '${INST}'`)).rows[0]!.modules;
    expect(m).toEqual({ teachers: false });
  });

  it("teachers off: an admin can still invite students but not teachers", async () => {
    await actAs(db, ADMIN);
    await db.query(`insert into institute_invites (institute_id, email, role, invited_by) values ('${INST}', 'kid@a.test', 'student', '${ADMIN}')`);
    await expect(
      db.query(`insert into institute_invites (institute_id, email, role, invited_by) values ('${INST}', 'teach@a.test', 'teacher', '${ADMIN}')`),
    ).rejects.toThrow();
  });

  it("student app off: papers stop reaching students and codes stop working", async () => {
    await actAs(db, S1);
    expect(await n(`select count(*)::int as n from papers`)).toBe(1);
    await actAs(db, OWNER);
    await db.query(`select platform_set_modules('${INST}', '{"teachers": false, "student_app": false}')`);
    await actAs(db, S1);
    expect(await n(`select count(*)::int as n from papers`)).toBe(0);
    await actAs(db, S2);
    await expect(db.query(`select join_batch('MORNAA')`)).rejects.toThrow(/invalid or inactive join code/);
    await actAs(db, OWNER);
    await db.query(`select platform_set_modules('${INST}', '{}')`);
  });
});

describe("self-practice", () => {
  it("is refused while the module is off", async () => {
    await actAs(db, S1);
    await expect(db.query(`select create_self_practice('${CS}', null, 5, 'mixed', false)`)).rejects.toThrow(/not switched on/);
  });

  it("builds a set from the chosen chapters and difficulty, never another institute's questions", async () => {
    await actAs(db, OWNER);
    await db.query(`select platform_set_modules('${INST}', '{"self_practice": true}')`);
    await actAs(db, S1);
    const id = (await db.query<{ create_self_practice: string }>(`select create_self_practice('${CS}', array['${CH}']::uuid[], 5, 'mixed', true)`)).rows[0]!.create_self_practice;
    expect(await n(`select count(*)::int as n from practice_set_items where practice_set_id = '${id}'`)).toBe(5);
    expect(await n(`select count(*)::int as n from practice_set_items where question_id = '${PRIVATE_Q}'`)).toBe(0);
    const easy = (await db.query<{ create_self_practice: string }>(`select create_self_practice('${CS}', null, 10, 'easy', false)`)).rows[0]!.create_self_practice;
    expect(await n(`select count(*)::int as n from practice_set_items i join questions qq on qq.id = i.question_id where i.practice_set_id = '${easy}' and qq.difficulty <> 'easy'`)).toBe(0);
    expect(await n(`select count(*)::int as n from practice_set_items where practice_set_id = '${easy}'`)).toBe(4);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from practice_sets where id = '${id}' and source = 'self'`)).toBe(1);
  });

  it("is refused for a subject the student does not take", async () => {
    await actAs(db, S2);
    await expect(db.query(`select create_self_practice('${CS}', null, 5, 'mixed', false)`)).rejects.toThrow(/not taking this subject/);
  });
});

describe("practice items are written only by the database's own functions", () => {
  it("a student cannot slip another question (and its answer) into their own set", async () => {
    await actAs(db, S1);
    const set = (await db.query<{ id: string }>(`select id from practice_sets limit 1`)).rows[0]!.id;
    await expect(
      db.query(`insert into practice_set_items (institute_id, practice_set_id, question_id) values ('${INST}', '${set}', '${PRIVATE_Q}')`),
    ).rejects.toThrow();
    await expect(db.query(`update practice_set_items set question_id = '${PRIVATE_Q}' where practice_set_id = '${set}'`)).rejects.toThrow();
    // ticking an item done still works
    await db.query(`update practice_set_items set is_done = true where practice_set_id = '${set}'`);
    expect(await n(`select count(*)::int as n from get_question_solution('${PRIVATE_Q}')`)).toBe(0);
  });
});
