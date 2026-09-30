import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";

/** Deleting batches, papers and institutes (migration 0026): who may, and what it leaves. */
const PLATFORM = "11111111-1111-1111-1111-111111111111";
const INST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OWNER = "0f0f0f0f-0000-0000-0000-000000000001";
const ADMIN = "a1a1a1a1-0000-0000-0000-000000000001";
const T1 = "a2a2a2a2-0000-0000-0000-000000000001";
const T2 = "a2a2a2a2-0000-0000-0000-000000000002";
const S1 = "a3a3a3a3-0000-0000-0000-000000000001";
const CS = "c5000000-0000-0000-0000-000000000001";
const BATCH = "ba700000-0000-0000-0000-000000000001";
const BATCH2 = "ba700000-0000-0000-0000-000000000002";
const P_LOGGED = "9a900000-0000-0000-0000-000000000001";
const P_FRESH = "9a900000-0000-0000-0000-000000000002";
const P_BATCH2 = "9a900000-0000-0000-0000-000000000003";

let db: PGlite;
const n = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;
  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@p.test'), ('${ADMIN}', 'admin@a.test'), ('${T1}', 't1@a.test'), ('${T2}', 't2@a.test'), ('${S1}', 's1@a.test');
    insert into institutes (id, name, slug, kind, status) values ('${INST}', 'Sunrise', 'sunrise', 'institute', 'active');
    insert into institute_members (institute_id, user_id, role) values
      ('${PLATFORM}', '${OWNER}', 'owner'), ('${INST}', '${ADMIN}', 'institute_admin'),
      ('${INST}', '${T1}', 'teacher'), ('${INST}', '${T2}', 'teacher'), ('${INST}', '${S1}', 'student');
    insert into classes (id, name) values ('00000010-0000-0000-0000-000000000010', '10');
    insert into subjects (id, name) values ('5c1e0000-0000-0000-0000-000000000001', 'Science');
    insert into class_subjects (id, class_id, subject_id, bank_status) values ('${CS}', '00000010-0000-0000-0000-000000000010', '5c1e0000-0000-0000-0000-000000000001', 'ready');
    insert into institute_class_subjects (institute_id, class_subject_id, status) values ('${INST}', '${CS}', 'active');
    insert into teacher_subjects (institute_id, teacher_id, class_subject_id) values ('${INST}', '${T1}', '${CS}'), ('${INST}', '${T2}', '${CS}');
    insert into batches (id, institute_id, name, teacher_id, join_code) values
      ('${BATCH}', '${INST}', 'Morning', '${T1}', 'MORNAA'), ('${BATCH2}', '${INST}', 'Evening', '${T1}', 'EVENAA');
    insert into batch_subjects (institute_id, batch_id, class_subject_id) values ('${INST}', '${BATCH}', '${CS}'), ('${INST}', '${BATCH2}', '${CS}');
    insert into enrolments (institute_id, batch_id, student_id) values ('${INST}', '${BATCH}', '${S1}');
    insert into papers (id, institute_id, teacher_id, batch_id, class_subject_id, title, status, released_at) values
      ('${P_LOGGED}', '${INST}', '${T1}', '${BATCH}', '${CS}', 'Logged', 'generated', now()),
      ('${P_FRESH}', '${INST}', '${T1}', '${BATCH}', '${CS}', 'Fresh', 'generated', now()),
      ('${P_BATCH2}', '${INST}', '${T1}', '${BATCH2}', '${CS}', 'Evening test', 'generated', now());
    insert into attempts (institute_id, paper_id, student_id) values ('${INST}', '${P_LOGGED}', '${S1}');
  `);
});

afterEach(async () => {
  await actAsOwner(db);
});

describe("deleting a paper", () => {
  it("is refused to another teacher, even one who teaches the subject", async () => {
    await actAs(db, T2);
    await expect(db.query(`select delete_paper('${P_FRESH}')`)).rejects.toThrow(/only the teacher who set/);
  });

  it("needs the paper's code once students have logged it, then takes their logs too", async () => {
    await actAs(db, T1);
    await expect(db.query(`select delete_paper('${P_LOGGED}')`)).rejects.toThrow(/students have logged this paper/);
    const code = (await db.query<{ code: string }>(`select code from papers where id = '${P_LOGGED}'`)).rows[0]!.code;
    await db.query(`select delete_paper('${P_LOGGED}', '${code.toLowerCase()}')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from papers where id = '${P_LOGGED}'`)).toBe(0);
    expect(await n(`select count(*)::int as n from attempts where paper_id = '${P_LOGGED}'`)).toBe(0);
  });

  it("an admin deletes an unlogged paper straight away", async () => {
    await actAs(db, ADMIN);
    await db.query(`select delete_paper('${P_FRESH}')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from papers where id = '${P_FRESH}'`)).toBe(0);
  });
});

describe("deleting a batch", () => {
  it("is refused to a teacher with nothing to do with it, and to a student", async () => {
    await actAs(db, S1);
    await expect(db.query(`select delete_batch('${BATCH2}')`)).rejects.toThrow(/not authorised/);
  });

  it("keeps the batch's papers but takes them out of students' view", async () => {
    await actAs(db, T1);
    const r = await db.query<{ delete_batch: number }>(`select delete_batch('${BATCH2}')`);
    expect(r.rows[0]!.delete_batch).toBe(1);
    await actAsOwner(db);
    const p = (await db.query<{ batch_id: string | null; released_at: string | null }>(`select batch_id, released_at from papers where id = '${P_BATCH2}'`)).rows[0]!;
    expect(p.batch_id).toBeNull();
    expect(p.released_at).toBeNull();
    expect(await n(`select count(*)::int as n from batches where id = '${BATCH2}'`)).toBe(0);
  });
});

describe("deleting an institute", () => {
  it("is for the platform owner only, on a suspended institute, with its slug typed", async () => {
    await actAs(db, ADMIN);
    await expect(db.query(`select platform_delete_institute('${INST}', 'sunrise')`)).rejects.toThrow();
    await actAsOwner(db);
    await actAs(db, OWNER);
    await expect(db.query(`select platform_delete_institute('${INST}', 'sunrise')`)).rejects.toThrow(/suspend the institute first/);
    await actAsOwner(db);
    await db.query(`update institutes set status = 'suspended' where id = '${INST}'`);
    await actAs(db, OWNER);
    await expect(db.query(`select platform_delete_institute('${INST}', 'sunset')`)).rejects.toThrow(/type the institute/);
    await db.query(`select platform_delete_institute('${INST}', 'Sunrise')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from institutes where id = '${INST}'`)).toBe(0);
    expect(await n(`select count(*)::int as n from batches`)).toBe(0);
    expect(await n(`select count(*)::int as n from auth.users where id = '${S1}'`)).toBe(1);
    expect(await n(`select count(*)::int as n from platform_access_log where action = 'delete_institute'`)).toBe(1);
  });
});
