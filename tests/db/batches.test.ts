import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";

/**
 * Flexible batches (migration 0025): a batch holds any number of subjects, a
 * student may be in several batches, papers reach the batch they were set for,
 * and teachers manage only the batches (and subjects) that are theirs.
 */
const INST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ADMIN = "a1a1a1a1-0000-0000-0000-000000000001";
const SCI_T = "a2a2a2a2-0000-0000-0000-000000000001"; // teaches Science
const MATH_T = "a2a2a2a2-0000-0000-0000-000000000002"; // teaches Maths
const S1 = "a3a3a3a3-0000-0000-0000-000000000001";
const S2 = "a3a3a3a3-0000-0000-0000-000000000002";
const OUTSIDER = "b3b3b3b3-0000-0000-0000-000000000001";
const SCI = "c5000000-0000-0000-0000-000000000001";
const MATH = "c5000000-0000-0000-0000-000000000002";
const B_MAIN = "ba700000-0000-0000-0000-000000000001"; // Science + Maths
const B_CRASH = "ba700000-0000-0000-0000-000000000002"; // Maths only
const P_MAIN_SCI = "9a900000-0000-0000-0000-000000000001";
const P_CRASH_MATH = "9a900000-0000-0000-0000-000000000002";
const P_NOBATCH_SCI = "9a900000-0000-0000-0000-000000000003";

let db: PGlite;
const n = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;
  await db.exec(`
    insert into auth.users (id, email) values
      ('${ADMIN}', 'admin@a.test'), ('${SCI_T}', 'sci@a.test'), ('${MATH_T}', 'math@a.test'),
      ('${S1}', 's1@a.test'), ('${S2}', 's2@a.test'), ('${OUTSIDER}', 'out@b.test');
    insert into institutes (id, name, slug, kind, status) values
      ('${INST}', 'Sunrise', 'sunrise', 'institute', 'active'), ('${OTHER}', 'Other', 'other', 'institute', 'active');
    insert into institute_members (institute_id, user_id, role) values
      ('${INST}', '${ADMIN}', 'institute_admin'), ('${INST}', '${SCI_T}', 'teacher'), ('${INST}', '${MATH_T}', 'teacher'),
      ('${INST}', '${S1}', 'student'), ('${INST}', '${S2}', 'student'), ('${OTHER}', '${OUTSIDER}', 'student');
    insert into classes (id, name) values ('00000010-0000-0000-0000-000000000010', '10');
    insert into subjects (id, name) values ('5c1e0000-0000-0000-0000-000000000001', 'Science'), ('5c1e0000-0000-0000-0000-000000000002', 'Maths');
    insert into class_subjects (id, class_id, subject_id, bank_status) values
      ('${SCI}', '00000010-0000-0000-0000-000000000010', '5c1e0000-0000-0000-0000-000000000001', 'ready'),
      ('${MATH}', '00000010-0000-0000-0000-000000000010', '5c1e0000-0000-0000-0000-000000000002', 'ready');
    insert into institute_class_subjects (institute_id, class_subject_id, status) values ('${INST}', '${SCI}', 'active'), ('${INST}', '${MATH}', 'active');
    insert into teacher_subjects (institute_id, teacher_id, class_subject_id) values ('${INST}', '${SCI_T}', '${SCI}'), ('${INST}', '${MATH_T}', '${MATH}');
    insert into batches (id, institute_id, name, teacher_id, join_code) values
      ('${B_MAIN}', '${INST}', 'Class 10 Morning', '${ADMIN}', 'MAINAA'),
      ('${B_CRASH}', '${INST}', 'Maths crash course', '${MATH_T}', 'CRASHA');
    insert into batch_subjects (institute_id, batch_id, class_subject_id) values
      ('${INST}', '${B_MAIN}', '${SCI}'), ('${INST}', '${B_MAIN}', '${MATH}'), ('${INST}', '${B_CRASH}', '${MATH}');
    insert into papers (id, institute_id, teacher_id, batch_id, class_subject_id, title, status, released_at) values
      ('${P_MAIN_SCI}', '${INST}', '${SCI_T}', '${B_MAIN}', '${SCI}', 'Main science test', 'generated', now()),
      ('${P_CRASH_MATH}', '${INST}', '${MATH_T}', '${B_CRASH}', '${MATH}', 'Crash maths test', 'generated', now()),
      ('${P_NOBATCH_SCI}', '${INST}', '${SCI_T}', null, '${SCI}', 'Open science test', 'generated', now());
  `);
});

afterEach(async () => {
  await actAsOwner(db);
});

describe("one batch, many subjects", () => {
  it("a student joins once and gets every subject of the batch", async () => {
    await actAs(db, S1);
    await db.query(`select join_batch('MAINAA')`);
    const peek = await db.query<{ subject_name: string; already_enrolled_batch: string | null }>(`select * from peek_join_code('MAINAA')`);
    expect(peek.rows[0]!.subject_name).toBe("Maths, Science");
    expect(peek.rows[0]!.already_enrolled_batch).toBe("Class 10 Morning");
    await expect(db.query(`select join_batch('MAINAA')`)).rejects.toThrow(/already in batch/);
  });

  it("a student may also be in a second batch that shares a subject", async () => {
    await actAs(db, S1);
    await db.query(`select join_batch('CRASHA')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from enrolments where student_id = '${S1}'`)).toBe(2);
  });
});

describe("who sees which paper", () => {
  it("a batch's paper reaches that batch; an unbatched paper reaches everyone taking the subject", async () => {
    await actAs(db, S1); // in Main and Crash
    expect(await n(`select count(*)::int as n from papers`)).toBe(3);
    await actAsOwner(db);
    await db.query(`insert into enrolments (institute_id, batch_id, student_id) values ('${INST}', '${B_CRASH}', '${S2}') on conflict do nothing`);
    await actAs(db, S2); // Crash only: Maths
    const seen = (await db.query<{ title: string }>(`select title from papers order by title`)).rows.map((r) => r.title);
    expect(seen).toEqual(["Crash maths test"]);
  });
});

describe("managing batches", () => {
  it("a teacher adds only subjects they teach, to batches that are theirs", async () => {
    await actAs(db, MATH_T);
    await expect(
      db.query(`insert into batch_subjects (institute_id, batch_id, class_subject_id) values ('${INST}', '${B_CRASH}', '${SCI}')`),
    ).rejects.toThrow();
    await actAs(db, SCI_T);
    await expect(
      db.query(`insert into batch_subjects (institute_id, batch_id, class_subject_id) values ('${INST}', '${B_CRASH}', '${SCI}')`),
    ).rejects.toThrow();
  });

  it("a teacher creates their own multi-subject batch only with their subjects; an admin with any", async () => {
    await actAs(db, SCI_T);
    await db.query(`insert into batches (id, institute_id, name, teacher_id, join_code) values ('ba700000-0000-0000-0000-000000000003', '${INST}', 'Sci evening', '${SCI_T}', '')`);
    await db.query(`insert into batch_subjects (institute_id, batch_id, class_subject_id) values ('${INST}', 'ba700000-0000-0000-0000-000000000003', '${SCI}')`);
    await actAs(db, ADMIN);
    await db.query(`insert into batch_subjects (institute_id, batch_id, class_subject_id) values ('${INST}', 'ba700000-0000-0000-0000-000000000003', '${MATH}')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from batch_subjects where batch_id = 'ba700000-0000-0000-0000-000000000003'`)).toBe(2);
  });

  it("adds and removes students directly, only students of the institute", async () => {
    await actAs(db, SCI_T); // teaches Science, which Main has
    const added = await db.query<{ batch_add_students: number }>(`select batch_add_students('${B_MAIN}', array['${S2}', '${OUTSIDER}']::uuid[])`);
    expect(added.rows[0]!.batch_add_students).toBe(1);
    await db.query(`select batch_remove_student('${B_MAIN}', '${S2}')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from enrolments where batch_id = '${B_MAIN}' and student_id = '${S2}'`)).toBe(0);
  });

  it("refuses a teacher with nothing to do with the batch", async () => {
    await actAs(db, SCI_T);
    await expect(db.query(`select batch_add_students('${B_CRASH}', array['${S2}']::uuid[])`)).rejects.toThrow(/not authorised/);
    await expect(db.query(`select rotate_join_code('${B_CRASH}')`)).rejects.toThrow(/not authorised/);
  });

  it("a batch made the old way (one class_subject_id) still gets its subject", async () => {
    await actAs(db, MATH_T);
    await db.query(`insert into batches (id, institute_id, name, class_subject_id, teacher_id, join_code) values ('ba700000-0000-0000-0000-000000000004', '${INST}', 'Old style', '${MATH}', '${MATH_T}', '')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from batch_subjects where batch_id = 'ba700000-0000-0000-0000-000000000004' and class_subject_id = '${MATH}'`)).toBe(1);
  });
});
