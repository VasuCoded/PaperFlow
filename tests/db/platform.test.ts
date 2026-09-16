import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";

/**
 * Executable tests for migration 0011 (platform console functions), against the
 * real migrations. Covers BUILD-PLAN C2b's named tests: every platform function
 * refuses non-owners, and platform_inspect_institute writes exactly one access
 * log row per call.
 */
const PLATFORM = "11111111-1111-1111-1111-111111111111";
const INST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OWNER = "0f0f0f0f-0000-0000-0000-000000000001";
const ADMIN = "a1a1a1a1-0000-0000-0000-000000000001";
const TEACHER = "a2a2a2a2-0000-0000-0000-000000000001";
const STUDENT = "a3a3a3a3-0000-0000-0000-000000000001";
const CS = "c5000000-0000-0000-0000-000000000001";
const CH = "c4a70000-0000-0000-0000-000000000001";
const Q_SHARED = "90000000-0000-0000-0000-000000000001";
const Q_PRIVATE = "90000000-0000-0000-0000-000000000002";

let db: PGlite;

const count = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;

  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@platform.test'), ('${ADMIN}', 'admin@a.test'),
      ('${TEACHER}', 'teacher@a.test'), ('${STUDENT}', 'student@a.test');
    insert into institutes (id, name, slug, kind, status) values ('${INST}', 'Sunrise', 'sunrise', 'institute', 'active');
    insert into institute_members (institute_id, user_id, role) values
      ('${PLATFORM}', '${OWNER}', 'owner'),
      ('${INST}', '${ADMIN}', 'institute_admin'),
      ('${INST}', '${TEACHER}', 'teacher'),
      ('${INST}', '${STUDENT}', 'student');
    insert into classes (id, name) values ('00000010-0000-0000-0000-000000000010', '10');
    insert into subjects (id, name) values ('5c1e0000-0000-0000-0000-000000000001', 'Science');
    insert into class_subjects (id, class_id, subject_id, bank_status)
      values ('${CS}', '00000010-0000-0000-0000-000000000010', '5c1e0000-0000-0000-0000-000000000001', 'seeding');
    insert into chapters (id, class_subject_id, name) values ('${CH}', '${CS}', 'Light');
    insert into questions (id, owner_institute_id, class_subject_id, chapter_id, body, question_type, answer, marks, difficulty, note) values
      ('${Q_SHARED}', '${PLATFORM}', '${CS}', '${CH}', 'shared staging', 'sa', 'shared answer', 2, 'easy', null),
      ('${Q_PRIVATE}', '${INST}', '${CS}', '${CH}', 'private staging', 'sa', 'private answer', 2, 'easy', 'check the diagram');
  `);
});

afterEach(async () => {
  await actAsOwner(db);
});

const PLATFORM_CALLS = [
  "select * from platform_list_institutes()",
  `select platform_set_institute_status('${INST}', 'suspended')`,
  "select * from platform_review_queue(10)",
  `select platform_review_question('${Q_SHARED}', 'approve')`,
  "select * from platform_bank_coverage()",
  `select platform_set_activation('${INST}', '${CS}', true)`,
  "select * from platform_activation_requests()",
  "select platform_health()",
  "select * from platform_audit()",
  `select platform_inspect_institute('${INST}')`,
  `select create_institute('Rogue', 'rogue', 'x@x.test', 'y@y.test')`,
];

describe("every platform function refuses non-owners", () => {
  for (const [who, uid] of [["student", STUDENT], ["teacher", TEACHER], ["institute_admin", ADMIN]] as const) {
    it(`refuses ${who}`, async () => {
      for (const sql of PLATFORM_CALLS) {
        await actAs(db, uid);
        await expect(db.query(sql), `${who}: ${sql}`).rejects.toThrow(/platform owner/);
      }
    });
  }
});

describe("platform_inspect_institute", () => {
  it("writes exactly one access-log row per call", async () => {
    const before = await count(`select count(*)::int as n from platform_access_log where action = 'inspect_institute'`);
    await actAs(db, OWNER);
    await db.query(`select platform_inspect_institute('${INST}')`);
    await actAsOwner(db);
    expect(await count(`select count(*)::int as n from platform_access_log where action = 'inspect_institute'`)).toBe(before + 1);

    await actAs(db, OWNER);
    await db.query(`select platform_inspect_institute('${INST}')`);
    await db.query(`select platform_inspect_institute('${INST}')`);
    await actAsOwner(db);
    expect(await count(`select count(*)::int as n from platform_access_log where action = 'inspect_institute'`)).toBe(before + 3);
  });
});

describe("institutes", () => {
  it("lists tenants with role counts and never the platform itself", async () => {
    await actAs(db, OWNER);
    const rows = (await db.query<{ slug: string; admins: number; teachers: number; students: number }>(
      "select slug, admins, teachers, students from platform_list_institutes()",
    )).rows;
    expect(rows.map((r) => r.slug)).toEqual(["sunrise"]);
    expect(rows[0]).toMatchObject({ admins: 1, teachers: 1, students: 1 });
  });

  it("suspends and logs it", async () => {
    await actAs(db, OWNER);
    await db.query(`select platform_set_institute_status('${INST}', 'suspended')`);
    await actAsOwner(db);
    expect(await count(`select count(*)::int as n from institutes where id = '${INST}' and status = 'suspended'`)).toBe(1);
    expect(await count(`select count(*)::int as n from platform_access_log where action = 'set_status_suspended'`)).toBe(1);
    await actAs(db, OWNER);
    await db.query(`select platform_set_institute_status('${INST}', 'active')`);
  });
});

describe("review queue", () => {
  it("shows private staging questions with their answers and owner, and logs the read", async () => {
    await actAs(db, OWNER);
    const rows = (await db.query<{ id: string; is_private: boolean; answer: string; owner_name: string; note: string | null }>(
      "select id, is_private, answer, owner_name, note from platform_review_queue(50)",
    )).rows;
    const priv = rows.find((r) => r.id === Q_PRIVATE);
    expect(priv).toMatchObject({ is_private: true, answer: "private answer", owner_name: "Sunrise", note: "check the diagram" });
    await actAsOwner(db);
    expect(await count(`select count(*)::int as n from platform_access_log where action = 'review_queue'`)).toBeGreaterThan(0);
  });

  it("approves without changing ownership", async () => {
    await actAs(db, OWNER);
    await db.query(`select platform_review_question('${Q_SHARED}', 'approve')`);
    await actAsOwner(db);
    const r = (await db.query<{ status: string; owner_institute_id: string; approved_by: string }>(
      `select status, owner_institute_id, approved_by from questions where id = '${Q_SHARED}'`,
    )).rows[0]!;
    expect(r.status).toBe("approved");
    expect(r.owner_institute_id).toBe(PLATFORM);
  });

  it("promotes a private question to the shared bank only when asked, and logs which", async () => {
    await actAs(db, OWNER);
    await db.query(`select platform_review_question('${Q_PRIVATE}', 'approve', true)`);
    await actAsOwner(db);
    const r = (await db.query<{ owner_institute_id: string; status: string }>(
      `select owner_institute_id, status from questions where id = '${Q_PRIVATE}'`,
    )).rows[0]!;
    expect(r).toEqual({ owner_institute_id: PLATFORM, status: "approved" });
    expect(await count(`select count(*)::int as n from platform_access_log where action = 'question_approve_promoted_to_shared' and institute_id = '${INST}'`)).toBe(1);
  });
});

describe("activation", () => {
  it("activates a class-subject for an institute and logs it", async () => {
    await actAs(db, OWNER);
    await db.query(`select platform_set_activation('${INST}', '${CS}', true)`);
    await actAsOwner(db);
    expect(await count(`select count(*)::int as n from institute_class_subjects where institute_id = '${INST}' and status = 'active'`)).toBe(1);
    expect(await count(`select count(*)::int as n from platform_access_log where action = 'activate_subject'`)).toBe(1);
  });

  it("reports coverage against the gate", async () => {
    await actAs(db, OWNER);
    const r = (await db.query<{ label: string; approved: number; chapters: number; thinnest_chapter: string }>(
      "select label, approved, chapters, thinnest_chapter from platform_bank_coverage()",
    )).rows[0]!;
    expect(r.label).toBe("Class 10 · Science");
    expect(r.approved).toBe(2);
    expect(r.chapters).toBe(1);
    expect(r.thinnest_chapter).toBe("Light");
  });
});

describe("institute export", () => {
  it("is admin-only, audited, and rate limited to one per ten minutes", async () => {
    await actAs(db, TEACHER);
    await expect(db.query(`select log_institute_export('${INST}')`)).rejects.toThrow(/institute admin/);

    await actAs(db, ADMIN);
    await db.query(`select log_institute_export('${INST}')`);
    await actAs(db, ADMIN);
    await expect(db.query(`select log_institute_export('${INST}')`)).rejects.toThrow(/last ten minutes/);

    await actAsOwner(db);
    expect(await count(`select count(*)::int as n from platform_access_log where action = 'institute_export'`)).toBe(1);
  });
});
