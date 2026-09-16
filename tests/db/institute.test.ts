import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";

/**
 * The institute console's database paths: invites, role changes, removal,
 * teacher-subject assignment and activation requests — exercised as the
 * institute admin, and refused for everyone who should be refused.
 */
const PLATFORM = "11111111-1111-1111-1111-111111111111";
const INST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OWNER = "0f0f0f0f-0000-0000-0000-000000000001";
const ADMIN = "a1a1a1a1-0000-0000-0000-000000000001";
const ADMIN2 = "a1a1a1a1-0000-0000-0000-000000000002";
const TEACHER = "a2a2a2a2-0000-0000-0000-000000000001";
const STUDENT = "a3a3a3a3-0000-0000-0000-000000000001";
const STUDENT2 = "a3a3a3a3-0000-0000-0000-000000000002";
const OUTSIDER = "b3b3b3b3-0000-0000-0000-000000000001";
const CS = "c5000000-0000-0000-0000-000000000001";
const CS2 = "c5000000-0000-0000-0000-000000000002";
const BATCH = "ba700000-0000-0000-0000-00000000000a";

let db: PGlite;

async function n(sql: string): Promise<number> {
  return Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);
}

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;

  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@platform.test'), ('${ADMIN}', 'admin@a.test'), ('${ADMIN2}', 'admin2@a.test'),
      ('${TEACHER}', 'teacher@a.test'), ('${STUDENT}', 'student@a.test'), ('${STUDENT2}', 'student2@a.test'),
      ('${OUTSIDER}', 'outsider@b.test');
    insert into institutes (id, name, slug, kind, status) values
      ('${INST}', 'Sunrise', 'sunrise', 'institute', 'active'),
      ('${OTHER}', 'Other', 'other', 'institute', 'active');
    insert into institute_members (institute_id, user_id, role) values
      ('${PLATFORM}', '${OWNER}', 'owner'),
      ('${INST}', '${ADMIN}', 'institute_admin'),
      ('${INST}', '${ADMIN2}', 'institute_admin'),
      ('${INST}', '${TEACHER}', 'teacher'),
      ('${INST}', '${STUDENT}', 'student'),
      ('${INST}', '${STUDENT2}', 'student'),
      ('${OTHER}', '${OUTSIDER}', 'student');
    insert into classes (id, name) values ('00000010-0000-0000-0000-000000000010', '10');
    insert into subjects (id, name) values ('5c1e0000-0000-0000-0000-000000000001', 'Science'), ('5c1e0000-0000-0000-0000-000000000002', 'Maths');
    insert into class_subjects (id, class_id, subject_id, bank_status) values
      ('${CS}', '00000010-0000-0000-0000-000000000010', '5c1e0000-0000-0000-0000-000000000001', 'ready'),
      ('${CS2}', '00000010-0000-0000-0000-000000000010', '5c1e0000-0000-0000-0000-000000000002', 'seeding');
    insert into institute_class_subjects (institute_id, class_subject_id, status) values ('${INST}', '${CS}', 'active');
    insert into teacher_subjects (institute_id, teacher_id, class_subject_id) values ('${INST}', '${TEACHER}', '${CS}');
    insert into batches (id, institute_id, name, class_subject_id, teacher_id, join_code)
      values ('${BATCH}', '${INST}', 'X-A', '${CS}', '${TEACHER}', 'KQZ7XR');
    insert into enrolments (institute_id, batch_id, student_id, class_subject_id)
      values ('${INST}', '${BATCH}', '${STUDENT2}', '${CS}');
  `);
});

afterEach(async () => {
  await actAsOwner(db);
});

describe("invites", () => {
  it("an admin invites teachers and students, never admins", async () => {
    await actAs(db, ADMIN);
    await db.query(`insert into institute_invites (institute_id, email, role, invited_by) values ('${INST}', 'new.teacher@a.test', 'teacher', '${ADMIN}')`);
    await expect(
      db.query(`insert into institute_invites (institute_id, email, role) values ('${INST}', 'boss@a.test', 'institute_admin')`),
    ).rejects.toThrow();
  });

  it("a teacher cannot invite, and an admin cannot invite into another institute", async () => {
    await actAs(db, TEACHER);
    await expect(db.query(`insert into institute_invites (institute_id, email, role) values ('${INST}', 'x@a.test', 'student')`)).rejects.toThrow();
    await actAs(db, ADMIN);
    await expect(db.query(`insert into institute_invites (institute_id, email, role) values ('${OTHER}', 'x@b.test', 'student')`)).rejects.toThrow();
  });

  it("an admin can revoke their own institute's invite", async () => {
    await actAs(db, ADMIN);
    await db.query(`insert into institute_invites (institute_id, email, role) values ('${INST}', 'revoke.me@a.test', 'student')`);
    await db.query(`delete from institute_invites where institute_id = '${INST}' and email = 'revoke.me@a.test'`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from institute_invites where email = 'revoke.me@a.test'`)).toBe(0);
  });
});

describe("set_member_role (0013)", () => {
  it("moves a student to teacher and audits it", async () => {
    await actAs(db, ADMIN);
    await db.query(`select set_member_role('${INST}', 'student@a.test', 'teacher')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from institute_members where user_id = '${STUDENT}' and institute_id = '${INST}' and role = 'teacher'`)).toBe(1);
    expect(await n(`select count(*)::int as n from role_audit where target = '${STUDENT}' and old_role = 'student' and new_role = 'teacher'`)).toBe(1);
    await actAs(db, ADMIN);
    await db.query(`select set_member_role('${INST}', 'student@a.test', 'student')`);
  });

  it("will not pull a user from another institute in without an invite", async () => {
    await actAs(db, ADMIN);
    await expect(db.query(`select set_member_role('${INST}', 'outsider@b.test', 'student')`)).rejects.toThrow(/not a teacher or student of this institute/);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from institute_members where user_id = '${OUTSIDER}' and institute_id = '${INST}'`)).toBe(0);
  });

  it("gives one message whether or not the email has an account", async () => {
    await actAs(db, ADMIN);
    await expect(db.query(`select set_member_role('${INST}', 'nobody@nowhere.test', 'student')`)).rejects.toThrow(/not a teacher or student of this institute/);
  });

  it("will not let an admin demote a fellow admin", async () => {
    await actAs(db, ADMIN);
    await expect(db.query(`select set_member_role('${INST}', 'admin2@a.test', 'student')`)).rejects.toThrow(/not a teacher or student/);
  });

  it("does not write an audit row for a no-op", async () => {
    await actAsOwner(db);
    const before = await n(`select count(*)::int as n from role_audit where target = '${TEACHER}'`);
    await actAs(db, ADMIN);
    await db.query(`select set_member_role('${INST}', 'teacher@a.test', 'teacher')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from role_audit where target = '${TEACHER}'`)).toBe(before);
  });

  it("still lets the platform owner make an institute admin", async () => {
    await actAs(db, OWNER);
    await db.query(`select set_member_role('${OTHER}', 'outsider@b.test', 'institute_admin')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from institute_members where user_id = '${OUTSIDER}' and role = 'institute_admin'`)).toBe(1);
    await actAs(db, OWNER);
    await db.query(`select set_member_role('${OTHER}', 'outsider@b.test', 'student')`);
  });
});

describe("remove_member (0013)", () => {
  it("does not reveal membership to someone who is not authorised", async () => {
    await actAs(db, OUTSIDER);
    await expect(db.query(`select remove_member('${INST}', '${STUDENT}')`)).rejects.toThrow(/^not authorised$/);
    await expect(db.query(`select remove_member('${INST}', '${OUTSIDER}')`)).rejects.toThrow(/^not authorised$/);
  });

  it("refuses to remove an admin or yourself", async () => {
    await actAs(db, ADMIN);
    await expect(db.query(`select remove_member('${INST}', '${ADMIN2}')`)).rejects.toThrow(/only remove teachers and students/);
    await expect(db.query(`select remove_member('${INST}', '${ADMIN}')`)).rejects.toThrow();
  });

  it("removes a student with their enrolments, and audits it", async () => {
    await actAs(db, ADMIN);
    await db.query(`select remove_member('${INST}', '${STUDENT2}')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from institute_members where user_id = '${STUDENT2}'`)).toBe(0);
    expect(await n(`select count(*)::int as n from enrolments where student_id = '${STUDENT2}'`)).toBe(0);
    expect(await n(`select count(*)::int as n from role_audit where target = '${STUDENT2}' and new_role is null`)).toBe(1);
  });
});

describe("teacher_subjects", () => {
  it("only an admin assigns subjects", async () => {
    await actAs(db, ADMIN);
    await db.query(`insert into teacher_subjects (institute_id, teacher_id, class_subject_id) values ('${INST}', '${TEACHER}', '${CS2}')`);
    await db.query(`delete from teacher_subjects where institute_id = '${INST}' and teacher_id = '${TEACHER}' and class_subject_id = '${CS2}'`);
    await actAs(db, TEACHER);
    await expect(db.query(`insert into teacher_subjects (institute_id, teacher_id, class_subject_id) values ('${INST}', '${TEACHER}', '${CS2}')`)).rejects.toThrow();
  });
});

describe("institute_subject_overview (0014)", () => {
  it("shows every class-subject with shared and private counts, and requests, to the admin", async () => {
    await actAsOwner(db);
    await db.exec(`
      insert into chapters (id, class_subject_id, name) values ('c4a70000-0000-0000-0000-000000000001', '${CS}', 'Light');
      insert into questions (owner_institute_id, class_subject_id, chapter_id, body, question_type, marks, difficulty) values
        ('${PLATFORM}', '${CS}', 'c4a70000-0000-0000-0000-000000000001', 's1', 'mcq', 1, 'easy'),
        ('${PLATFORM}', '${CS}', 'c4a70000-0000-0000-0000-000000000001', 's2', 'mcq', 1, 'easy'),
        ('${INST}', '${CS}', 'c4a70000-0000-0000-0000-000000000001', 'mine', 'mcq', 1, 'easy'),
        ('${OTHER}', '${CS}', 'c4a70000-0000-0000-0000-000000000001', 'theirs', 'mcq', 1, 'easy');
      update questions set status = 'approved' where body in ('s1', 's2', 'mine', 'theirs');
    `);

    await actAs(db, ADMIN);
    const rows = (await db.query<{ subject_name: string; approved_shared: number; approved_private: number; status: string }>(
      `select subject_name, approved_shared, approved_private, status from institute_subject_overview('${INST}')`,
    )).rows;
    expect(rows.map((r) => r.subject_name)).toEqual(["Maths", "Science"]);
    expect(rows.find((r) => r.subject_name === "Science")).toMatchObject({ approved_shared: 2, approved_private: 1, status: "active" });
  });

  it("leaks nothing tenant-specific when called with another institute's id", async () => {
    await actAs(db, OUTSIDER);
    const rows = (await db.query<{ subject_name: string; approved_private: number; status: string; pending_request: boolean }>(
      `select subject_name, approved_private, status, pending_request from institute_subject_overview('${INST}')`,
    )).rows;
    for (const r of rows) {
      expect(r).toMatchObject({ approved_private: 0, status: "planned", pending_request: false });
    }
  });
});

describe("activation requests", () => {
  it("an admin requests once; a second pending request for the same subject is refused", async () => {
    await actAs(db, ADMIN);
    await db.query(`insert into activation_requests (institute_id, class_subject_id, requested_by) values ('${INST}', '${CS2}', '${ADMIN}')`);
    await expect(
      db.query(`insert into activation_requests (institute_id, class_subject_id, requested_by) values ('${INST}', '${CS2}', '${ADMIN}')`),
    ).rejects.toThrow(/duplicate|unique/);
  });

  it("can be declined, re-requested and declined again (0014)", async () => {
    // Inserted as table owner, on the second institute, so this test does not
    // depend on the pending request left by the test above.
    await actAsOwner(db);
    for (let round = 1; round <= 2; round++) {
      const id = (await db.query<{ id: string }>(
        `insert into activation_requests (institute_id, class_subject_id, requested_by) values ('${OTHER}', '${CS2}', '${OUTSIDER}') returning id`,
      )).rows[0]!.id;
      await actAs(db, OWNER);
      await db.query(`select decide_activation_request('${id}', false, 'Bank still seeding, round ${round}')`);
      await actAsOwner(db);
    }
    expect(await n(`select count(*)::int as n from activation_requests where institute_id = '${OTHER}' and status = 'declined'`)).toBe(2);
  });

  it("cannot be raised in someone else's name, or by a teacher", async () => {
    await actAs(db, ADMIN);
    await expect(db.query(`insert into activation_requests (institute_id, class_subject_id, requested_by) values ('${INST}', '${CS}', '${ADMIN2}')`)).rejects.toThrow();
    await actAs(db, TEACHER);
    await expect(db.query(`insert into activation_requests (institute_id, class_subject_id, requested_by) values ('${INST}', '${CS}', '${TEACHER}')`)).rejects.toThrow();
  });
});
