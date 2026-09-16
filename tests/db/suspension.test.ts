import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";

/**
 * Executable tests for migration 0012: suspending an institute cuts its members
 * off in the database, not only in the app, and reactivating restores them.
 * Each test suspends in its own body and afterEach reactivates, so the order
 * of tests does not matter.
 */
const PLATFORM = "11111111-1111-1111-1111-111111111111";
const INST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OWNER = "0f0f0f0f-0000-0000-0000-000000000001";
const ADMIN = "a1a1a1a1-0000-0000-0000-000000000001";
const TEACHER = "a2a2a2a2-0000-0000-0000-000000000001";
const STUDENT = "a3a3a3a3-0000-0000-0000-000000000001";
const NEWCOMER = "a4a4a4a4-0000-0000-0000-000000000001";
const CS = "c5000000-0000-0000-0000-000000000001";
const CH = "c4a70000-0000-0000-0000-000000000001";
const BATCH = "ba700000-0000-0000-0000-00000000000a";
const PAPER = "9a9e0000-0000-0000-0000-00000000000a";
const INVITE = "1a1a0000-0000-0000-0000-00000000000a";
const Q = "90000000-0000-0000-0000-000000000001";

let db: PGlite;

async function n(sql: string): Promise<number> {
  return Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);
}

async function suspend() {
  await actAsOwner(db);
  await db.query(`update institutes set status = 'suspended' where id = '${INST}'`);
}

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;

  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@platform.test'), ('${ADMIN}', 'admin@a.test'), ('${TEACHER}', 'teacher@a.test'),
      ('${STUDENT}', 'student@a.test'), ('${NEWCOMER}', 'new@a.test');
    insert into institutes (id, name, slug, kind, status) values ('${INST}', 'Sunrise', 'sunrise', 'institute', 'active');
    insert into institute_members (institute_id, user_id, role) values
      ('${PLATFORM}', '${OWNER}', 'owner'),
      ('${INST}', '${ADMIN}', 'institute_admin'),
      ('${INST}', '${TEACHER}', 'teacher'),
      ('${INST}', '${STUDENT}', 'student');
    insert into institute_invites (id, institute_id, email, role) values ('${INVITE}', '${INST}', 'new@a.test', 'teacher');

    insert into classes (id, name) values ('00000010-0000-0000-0000-000000000010', '10');
    insert into subjects (id, name) values ('5c1e0000-0000-0000-0000-000000000001', 'Science');
    insert into class_subjects (id, class_id, subject_id, bank_status)
      values ('${CS}', '00000010-0000-0000-0000-000000000010', '5c1e0000-0000-0000-0000-000000000001', 'ready');
    insert into chapters (id, class_subject_id, name) values ('${CH}', '${CS}', 'Light');
    insert into institute_class_subjects (institute_id, class_subject_id, status) values ('${INST}', '${CS}', 'active');
    insert into teacher_subjects (institute_id, teacher_id, class_subject_id) values ('${INST}', '${TEACHER}', '${CS}');
    insert into questions (id, owner_institute_id, class_subject_id, chapter_id, body, question_type, marks, difficulty)
      values ('${Q}', '${INST}', '${CS}', '${CH}', 'private q', 'mcq', 1, 'easy');
    update questions set status = 'approved';

    insert into batches (id, institute_id, name, class_subject_id, teacher_id, join_code)
      values ('${BATCH}', '${INST}', 'X-A', '${CS}', '${TEACHER}', 'KQZ7XR');
    insert into enrolments (institute_id, batch_id, student_id, class_subject_id)
      values ('${INST}', '${BATCH}', '${STUDENT}', '${CS}');
    insert into papers (id, institute_id, teacher_id, batch_id, class_subject_id, title, status)
      values ('${PAPER}', '${INST}', '${TEACHER}', '${BATCH}', '${CS}', 'UT', 'generated');
  `);
});

afterEach(async () => {
  await actAsOwner(db);
  await db.query(`update institutes set status = 'active' where id = '${INST}'`);
});

describe("while active", () => {
  it("members resolve and can read their institute", async () => {
    await actAs(db, STUDENT);
    expect(await n(`select count(*)::int as n from papers`)).toBe(1);
    await actAs(db, TEACHER);
    expect(await n(`select count(*)::int as n from questions where id = '${Q}'`)).toBe(1);
    expect(await n(`select count(*)::int as n from my_active_class_subjects`)).toBe(1);
  });
});

describe("once suspended", () => {
  it("students lose papers, roles and attempt logging", async () => {
    await suspend();
    await actAs(db, STUDENT);
    expect(await n(`select count(*)::int as n from papers`)).toBe(0);
    expect(await n(`select count(*)::int as n from institutes where id = '${INST}'`)).toBe(0);
    expect((await db.query<{ r: string | null }>(`select my_role('${INST}') as r`)).rows[0]?.r).toBeNull();
    await expect(db.query(`select log_attempt('${PAPER}', null, array[0])`)).rejects.toThrow(/paper not found/);
  });

  it("teachers lose the private bank, batches and active subjects", async () => {
    await suspend();
    await actAs(db, TEACHER);
    expect(await n(`select count(*)::int as n from questions where id = '${Q}'`)).toBe(0);
    expect(await n(`select count(*)::int as n from batches`)).toBe(0);
    expect(await n(`select count(*)::int as n from my_active_class_subjects`)).toBe(0);
    await expect(db.query(`select rotate_join_code('${BATCH}')`)).rejects.toThrow();
  });

  it("admins cannot invite, change roles or export", async () => {
    await suspend();
    await actAs(db, ADMIN);
    await expect(
      db.query(`insert into institute_invites (institute_id, email, role) values ('${INST}', 'x@a.test', 'student')`),
    ).rejects.toThrow();
    await expect(db.query(`select set_member_role('${INST}', 'student@a.test', 'teacher')`)).rejects.toThrow(/not authorised/);
    await expect(db.query(`select log_institute_export('${INST}')`)).rejects.toThrow(/institute admin/);
  });

  it("join codes behave like unknown codes", async () => {
    await suspend();
    await actAs(db, NEWCOMER);
    expect(await n(`select count(*)::int as n from peek_join_code('KQZ7XR')`)).toBe(0);
    await expect(db.query(`select join_batch('KQZ7XR')`)).rejects.toThrow(/invalid or inactive join code/);
  });

  it("pending invites cannot be accepted", async () => {
    await suspend();
    await actAs(db, NEWCOMER);
    await expect(db.query(`select accept_invite('${INVITE}')`)).rejects.toThrow(/suspended/);
  });

  it("members can learn that — and only that — the institute is suspended", async () => {
    await suspend();
    await actAs(db, STUDENT);
    const r = (await db.query<{ institute_name: string; role: string }>(`select institute_name, role from my_suspended_institutes()`)).rows;
    expect(r).toEqual([{ institute_name: "Sunrise", role: "student" }]);
  });

  it("the platform owner still reaches it through audited functions", async () => {
    await suspend();
    await actAs(db, OWNER);
    const rows = (await db.query<{ status: string }>(`select status from platform_list_institutes()`)).rows;
    expect(rows[0]?.status).toBe("suspended");
  });
});

describe("reactivation", () => {
  it("restores access exactly as it was", async () => {
    await suspend();
    await actAsOwner(db);
    await db.query(`update institutes set status = 'active' where id = '${INST}'`);
    await actAs(db, STUDENT);
    expect(await n(`select count(*)::int as n from papers`)).toBe(1);
    expect((await db.query<{ r: string }>(`select my_role('${INST}') as r`)).rows[0]?.r).toBe("student");
    await actAs(db, STUDENT);
    expect(await n(`select count(*)::int as n from my_suspended_institutes()`)).toBe(0);
  });
});
