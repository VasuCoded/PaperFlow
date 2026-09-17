import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";

/**
 * Migration 0016: the platform support functions (BUILD-PLAN C2b item 6),
 * including the plan's named test — a deliberate wrong-set scenario, corrected
 * by the platform, leaves attempt_items, practice_sets and question_exposure
 * mutually consistent.
 *
 * The paper has two sets. Set A prints q1,q2 | q3,q4; set B prints q2,q1 | q4,q3
 * (positions 0-1 are 1 mark, 2-3 are 2 marks in both).
 */
const PLATFORM = "11111111-1111-1111-1111-111111111111";
const INST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OWNER = "0f0f0f0f-0000-0000-0000-000000000001";
const ADMIN = "a1a1a1a1-0000-0000-0000-000000000001";
const TEACHER = "a2a2a2a2-0000-0000-0000-000000000001";
const STUDENT = "a3a3a3a3-0000-0000-0000-000000000001";
const CS = "c5000000-0000-0000-0000-000000000001";
const CS2 = "c5000000-0000-0000-0000-000000000002";
const CH = "c4a70000-0000-0000-0000-000000000001";
const BATCH1 = "ba700000-0000-0000-0000-000000000001";
const BATCH2 = "ba700000-0000-0000-0000-000000000002";
const BATCH_CLOSED = "ba700000-0000-0000-0000-000000000003";
const BATCH_OTHER_SUBJECT = "ba700000-0000-0000-0000-000000000004";
const BATCH_OTHER_INST = "ba700000-0000-0000-0000-000000000005";
const PAPER = "9a9e0000-0000-0000-0000-00000000000a";
const SEC_A = "5ec00000-0000-0000-0000-00000000000a";
const SEC_B = "5ec00000-0000-0000-0000-00000000000b";
const SET_A = "5e700000-0000-0000-0000-00000000000a";
const SET_B = "5e700000-0000-0000-0000-00000000000b";
const FLAG = "f1a90000-0000-0000-0000-000000000001";
const INVITE = "1a1a0000-0000-0000-0000-000000000001";

const Q = (n: number) => `90000000-0000-0000-0000-00000000000${n}`;
const B = (n: number) => `b10c0000-0000-0000-0000-00000000000${n}`;

let db: PGlite;

async function rows<T>(sql: string): Promise<T[]> {
  return (await db.query<T>(sql)).rows;
}
async function n(sql: string): Promise<number> {
  return Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);
}

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;

  await db.exec(`
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@platform.test'), ('${ADMIN}', 'admin@a.test'),
      ('${TEACHER}', 'teacher@a.test'), ('${STUDENT}', 'student@a.test');
    insert into institutes (id, name, slug, kind, status) values
      ('${INST}', 'Sunrise', 'sunrise', 'institute', 'active'),
      ('${OTHER}', 'Other', 'other', 'institute', 'active');
    insert into institute_members (institute_id, user_id, role) values
      ('${PLATFORM}', '${OWNER}', 'owner'),
      ('${INST}', '${ADMIN}', 'institute_admin'),
      ('${INST}', '${TEACHER}', 'teacher'),
      ('${INST}', '${STUDENT}', 'student');
    insert into institute_invites (id, institute_id, email, role) values ('${INVITE}', '${INST}', 'pending@a.test', 'teacher');

    insert into classes (id, name) values ('00000010-0000-0000-0000-000000000010', '10');
    insert into subjects (id, name) values ('5c1e0000-0000-0000-0000-000000000001', 'Science'), ('5c1e0000-0000-0000-0000-000000000002', 'Maths');
    insert into class_subjects (id, class_id, subject_id, bank_status) values
      ('${CS}', '00000010-0000-0000-0000-000000000010', '5c1e0000-0000-0000-0000-000000000001', 'ready'),
      ('${CS2}', '00000010-0000-0000-0000-000000000010', '5c1e0000-0000-0000-0000-000000000002', 'ready');
    insert into chapters (id, class_subject_id, name) values ('${CH}', '${CS}', 'Light');
    insert into institute_class_subjects (institute_id, class_subject_id, status) values ('${INST}', '${CS}', 'active');
    insert into teacher_subjects (institute_id, teacher_id, class_subject_id) values ('${INST}', '${TEACHER}', '${CS}');

    insert into questions (id, owner_institute_id, class_subject_id, chapter_id, body, question_type, marks, difficulty) values
      ('${Q(1)}', '${PLATFORM}', '${CS}', '${CH}', 'q1', 'mcq', 1, 'easy'),
      ('${Q(2)}', '${PLATFORM}', '${CS}', '${CH}', 'q2', 'mcq', 1, 'easy'),
      ('${Q(3)}', '${PLATFORM}', '${CS}', '${CH}', 'q3', 'sa', 2, 'medium'),
      ('${Q(4)}', '${PLATFORM}', '${CS}', '${CH}', 'q4', 'sa', 2, 'medium'),
      ('${Q(5)}', '${PLATFORM}', '${CS}', '${CH}', 'q5 practice', 'mcq', 1, 'easy'),
      ('${Q(6)}', '${INST}', '${CS}', '${CH}', 'q6 private, flagged', 'mcq', 1, 'easy');
    update questions set status = 'approved';

    insert into batches (id, institute_id, name, class_subject_id, teacher_id, join_code, active) values
      ('${BATCH1}', '${INST}', 'X-A', '${CS}', '${TEACHER}', '', true),
      ('${BATCH2}', '${INST}', 'X-B', '${CS}', '${TEACHER}', '', true),
      ('${BATCH_CLOSED}', '${INST}', 'X-old', '${CS}', '${TEACHER}', '', false),
      ('${BATCH_OTHER_SUBJECT}', '${INST}', 'X-Maths', '${CS2}', '${TEACHER}', '', true);
    insert into batches (id, institute_id, name, class_subject_id, join_code, active) values
      ('${BATCH_OTHER_INST}', '${OTHER}', 'Other-X', '${CS}', '', true);
    insert into enrolments (institute_id, batch_id, student_id, class_subject_id)
      values ('${INST}', '${BATCH1}', '${STUDENT}', '${CS}');

    insert into papers (id, institute_id, teacher_id, batch_id, class_subject_id, title, status)
      values ('${PAPER}', '${INST}', '${TEACHER}', '${BATCH1}', '${CS}', 'Unit Test 3', 'generated');
    insert into paper_sections (id, institute_id, paper_id, label, sort_order) values
      ('${SEC_A}', '${INST}', '${PAPER}', 'A', 0), ('${SEC_B}', '${INST}', '${PAPER}', 'B', 1);
    insert into paper_blocks (id, institute_id, paper_id, section_id, canonical_position) values
      ('${B(1)}', '${INST}', '${PAPER}', '${SEC_A}', 1), ('${B(2)}', '${INST}', '${PAPER}', '${SEC_A}', 2),
      ('${B(3)}', '${INST}', '${PAPER}', '${SEC_B}', 3), ('${B(4)}', '${INST}', '${PAPER}', '${SEC_B}', 4);
    insert into paper_questions (institute_id, paper_id, block_id, question_id, marks) values
      ('${INST}', '${PAPER}', '${B(1)}', '${Q(1)}', 1), ('${INST}', '${PAPER}', '${B(2)}', '${Q(2)}', 1),
      ('${INST}', '${PAPER}', '${B(3)}', '${Q(3)}', 2), ('${INST}', '${PAPER}', '${B(4)}', '${Q(4)}', 2);
    insert into paper_sets (id, institute_id, paper_id, set_label) values
      ('${SET_A}', '${INST}', '${PAPER}', 'A'), ('${SET_B}', '${INST}', '${PAPER}', 'B');
    insert into paper_set_items (institute_id, paper_set_id, paper_block_id, display_position) values
      ('${INST}', '${SET_A}', '${B(1)}', 0), ('${INST}', '${SET_A}', '${B(2)}', 1),
      ('${INST}', '${SET_A}', '${B(3)}', 2), ('${INST}', '${SET_A}', '${B(4)}', 3),
      ('${INST}', '${SET_B}', '${B(2)}', 0), ('${INST}', '${SET_B}', '${B(1)}', 1),
      ('${INST}', '${SET_B}', '${B(4)}', 2), ('${INST}', '${SET_B}', '${B(3)}', 3);

    insert into question_flags (id, institute_id, question_id, raised_by, reason)
      values ('${FLAG}', '${INST}', '${Q(6)}', '${TEACHER}', 'the diagram is missing');
  `);
});

afterEach(async () => {
  await actAsOwner(db);
});

const SUPPORT_CALLS = [
  "select platform_support_lookup('student@a.test')",
  `select platform_correct_attempt_set('${PAPER}', '${SET_B}', 'wrong set chosen')`,
  `select platform_move_student('${INST}', '${STUDENT}', '${BATCH2}', 'timetable change')`,
  `select platform_retire_question('${Q(6)}', 'missing diagram')`,
  "select * from platform_open_flags(10)",
  `select platform_resolve_flag('${FLAG}', 'dismissed', 'not a problem')`,
  `select * from platform_list_invites('${INST}')`,
  `select platform_invite('${INST}', 'x@a.test', 'institute_admin')`,
  `select platform_revoke_invite('${INVITE}')`,
];

describe("every support function refuses non-owners", () => {
  for (const [who, uid] of [["student", STUDENT], ["teacher", TEACHER], ["institute_admin", ADMIN]] as const) {
    it(`refuses ${who}`, async () => {
      for (const sql of SUPPORT_CALLS) {
        await actAs(db, uid);
        await expect(db.query(sql), `${who}: ${sql}`).rejects.toThrow(/platform owner/);
      }
    });
  }

  it("does not expose the unauthorised remap to any API role", async () => {
    await actAs(db, TEACHER);
    await expect(db.query(`select remap_attempt_set_internal('${PAPER}', '${SET_B}')`)).rejects.toThrow(/permission denied/);
  });
});

describe("C2b: correcting a student's set after a deliberate wrong-set scenario", () => {
  let attemptId = "";

  it("sets up the mistake: the student wrote set B but logged set A", async () => {
    await actAs(db, STUDENT);
    // On the sheet in their hand (set B) they got positions 0 and 3 wrong,
    // i.e. q2 and q3. Logged against set A, those positions mean q1 and q4.
    attemptId = (await rows<{ id: string }>(`select log_attempt('${PAPER}', '${SET_A}', array[0, 3]) as id`))[0]!.id;
    await actAs(db, STUDENT);
    await db.query(`select save_practice_set('${attemptId}', '[{"question_id": "${Q(5)}", "position": 0}]'::jsonb)`);
    await actAsOwner(db);
    const wrong = await rows<{ question_id: string }>(`select question_id from attempt_items where attempt_id = '${attemptId}' and not is_correct order by question_id`);
    expect(wrong.map((w) => w.question_id)).toEqual([Q(1), Q(4)]);
    expect(await n(`select count(*)::int as n from practice_sets where attempt_id = '${attemptId}'`)).toBe(1);
  });

  it("requires a reason", async () => {
    await actAs(db, OWNER);
    await expect(db.query(`select platform_correct_attempt_set('${attemptId}', '${SET_B}', '')`)).rejects.toThrow(/reason/);
  });

  it("refuses a set from a different paper", async () => {
    await actAs(db, OWNER);
    await expect(db.query(`select platform_correct_attempt_set('${attemptId}', '${B(1)}', 'wrong set chosen')`)).rejects.toThrow(/does not belong/);
  });

  it("remaps, and leaves attempt_items, practice_sets and question_exposure mutually consistent", async () => {
    await actAs(db, OWNER);
    await db.query(`select platform_correct_attempt_set('${attemptId}', '${SET_B}', 'student confirmed set B on the sheet')`);
    await actAsOwner(db);

    // 1. The attempt points at set B, and the wrong answers are now q2 and q3.
    expect(await n(`select count(*)::int as n from attempts where id = '${attemptId}' and paper_set_id = '${SET_B}'`)).toBe(1);
    const items = await rows<{ question_id: string; is_correct: boolean; display_position: number }>(
      `select question_id, is_correct, display_position from attempt_items where attempt_id = '${attemptId}' order by display_position`,
    );
    expect(items).toEqual([
      { question_id: Q(2), is_correct: false, display_position: 0 },
      { question_id: Q(1), is_correct: true, display_position: 1 },
      { question_id: Q(4), is_correct: true, display_position: 2 },
      { question_id: Q(3), is_correct: false, display_position: 3 },
    ]);

    // 2. Every attempt item agrees with set B's own position -> question map.
    expect(
      await n(`
        select count(*)::int as n from attempt_items ai
        where ai.attempt_id = '${attemptId}'
          and not exists (
            select 1 from paper_set_items psi
            join paper_questions pq on pq.block_id = psi.paper_block_id and pq.institute_id = psi.institute_id
            where psi.paper_set_id = '${SET_B}' and psi.display_position = ai.display_position and pq.question_id = ai.question_id
          )`),
    ).toBe(0);

    // 3. The practice set built from the wrong mapping is gone (the app rebuilds it).
    expect(await n(`select count(*)::int as n from practice_sets where attempt_id = '${attemptId}'`)).toBe(0);
    expect(await n(`select count(*)::int as n from practice_set_items psi where not exists (select 1 from practice_sets ps where ps.id = psi.practice_set_id)`)).toBe(0);

    // 4. Exposure still covers every question the student has seen — the whole
    //    paper (same questions in any set) and what practice already showed.
    expect(
      await n(`
        select count(*)::int as n from attempt_items ai
        where ai.attempt_id = '${attemptId}'
          and not exists (select 1 from question_exposure e where e.student_id = '${STUDENT}' and e.question_id = ai.question_id and e.institute_id = ai.institute_id)`),
    ).toBe(0);
    expect(await n(`select count(*)::int as n from question_exposure where student_id = '${STUDENT}' and question_id = '${Q(5)}'`)).toBe(1);

    // 5. Logged against the tenant, with the reason and the sets.
    const log = await rows<{ detail: string }>(`select detail from platform_access_log where action = 'correct_attempt_set' and institute_id = '${INST}'`);
    expect(log).toHaveLength(1);
    expect(log[0]!.detail).toBe("set A → B: student confirmed set B on the sheet");
  });

  it("refuses a no-op correction", async () => {
    await actAs(db, OWNER);
    await expect(db.query(`select platform_correct_attempt_set('${attemptId}', '${SET_B}', 'again, by mistake')`)).rejects.toThrow(/already on that set/);
  });

  it("leaves the teacher path working through the shared remap", async () => {
    await actAs(db, TEACHER);
    await db.query(`select correct_attempt_set('${attemptId}', '${SET_A}')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from attempts where id = '${attemptId}' and paper_set_id = '${SET_A}'`)).toBe(1);
    await actAs(db, STUDENT);
    await expect(db.query(`select correct_attempt_set('${attemptId}', '${SET_B}')`)).rejects.toThrow(/only a teacher or institute admin/);
  });
});

describe("platform_support_lookup", () => {
  it("returns memberships, enrolments with other open batches, attempts with every set, and invites", async () => {
    await actAs(db, OWNER);
    const r = (await rows<{ r: Record<string, unknown> }>(`select platform_support_lookup('  Student@A.test ') as r`))[0]!.r as {
      user: { email: string };
      memberships: { institute_name: string; role: string }[];
      enrolments: { batch_name: string; other_batches: { name: string }[] }[];
      attempts: { paper_title: string; set_label: string; sets: { label: string }[] }[];
    };
    expect(r.user.email).toBe("student@a.test");
    expect(r.memberships).toEqual([expect.objectContaining({ institute_name: "Sunrise", role: "student" })]);
    expect(r.enrolments[0]!.batch_name).toBe("X-A");
    // the closed batch and the other subject's batch are not offered
    expect(r.enrolments[0]!.other_batches.map((b) => b.name)).toEqual(["X-B"]);
    expect(r.attempts[0]!.paper_title).toBe("Unit Test 3");
    expect(r.attempts[0]!.sets.map((s) => s.label)).toEqual(["A", "B"]);

    const invites = (await rows<{ r: { invites: { role: string }[] } }>(`select platform_support_lookup('pending@a.test') as r`))[0]!.r.invites;
    expect(invites.map((i) => i.role)).toEqual(["teacher"]);
  });

  it("logs one row per tenant shown, and one untargeted row when nothing matches", async () => {
    await actAsOwner(db);
    const before = await n(`select count(*)::int as n from platform_access_log where action = 'support_lookup'`);
    await actAs(db, OWNER);
    await db.query(`select platform_support_lookup('student@a.test')`);
    await db.query(`select platform_support_lookup('nobody@nowhere.test')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from platform_access_log where action = 'support_lookup'`)).toBe(before + 2);
    expect(await n(`select count(*)::int as n from platform_access_log where action = 'support_lookup' and institute_id = '${INST}'`)).toBeGreaterThan(0);
    expect(await n(`select count(*)::int as n from platform_access_log where action = 'support_lookup' and institute_id is null and detail = 'nobody@nowhere.test'`)).toBe(1);
  });
});

describe("platform_move_student", () => {
  it("refuses a closed batch, another subject's batch, and another institute's batch", async () => {
    await actAs(db, OWNER);
    await expect(db.query(`select platform_move_student('${INST}', '${STUDENT}', '${BATCH_CLOSED}', 'timetable change')`)).rejects.toThrow(/not an open batch/);
    await expect(db.query(`select platform_move_student('${INST}', '${STUDENT}', '${BATCH_OTHER_SUBJECT}', 'timetable change')`)).rejects.toThrow(/not enrolled in that subject/);
    await expect(db.query(`select platform_move_student('${INST}', '${STUDENT}', '${BATCH_OTHER_INST}', 'timetable change')`)).rejects.toThrow(/not an open batch/);
  });

  it("moves the enrolment and logs from → to with the reason", async () => {
    await actAs(db, OWNER);
    await db.query(`select platform_move_student('${INST}', '${STUDENT}', '${BATCH2}', 'moved to the evening batch')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from enrolments where student_id = '${STUDENT}' and batch_id = '${BATCH2}'`)).toBe(1);
    expect(await n(`select count(*)::int as n from enrolments where student_id = '${STUDENT}'`)).toBe(1);
    const log = await rows<{ detail: string }>(`select detail from platform_access_log where action = 'move_student'`);
    expect(log[0]!.detail).toBe("X-A → X-B: moved to the evening batch");
    await actAs(db, OWNER);
    await expect(db.query(`select platform_move_student('${INST}', '${STUDENT}', '${BATCH2}', 'moved to the evening batch')`)).rejects.toThrow(/already in that batch/);
  });
});

describe("flags and retiring", () => {
  it("lists open flags with the question and who raised them, and logs the read", async () => {
    await actAs(db, OWNER);
    const flags = await rows<{ id: string; institute_name: string; is_private: boolean; raised_by_email: string; open_on_question: number }>(
      `select id, institute_name, is_private, raised_by_email, open_on_question from platform_open_flags(50)`,
    );
    expect(flags).toEqual([{ id: FLAG, institute_name: "Sunrise", is_private: true, raised_by_email: "teacher@a.test", open_on_question: 1 }]);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from platform_access_log where action = 'read_flags'`)).toBeGreaterThan(0);
  });

  it("retires a question out of the pool, closes its open flags, and logs against the owner", async () => {
    await actAs(db, OWNER);
    await db.query(`select platform_retire_question('${Q(6)}', 'diagram missing from source')`);
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from questions where id = '${Q(6)}' and status = 'retired'`)).toBe(1);
    expect(await n(`select count(*)::int as n from question_flags where id = '${FLAG}' and status = 'resolved'`)).toBe(1);
    const log = await rows<{ institute_id: string; detail: string }>(`select institute_id, detail from platform_access_log where action = 'retire_question'`);
    expect(log).toEqual([{ institute_id: INST, detail: "diagram missing from source (closed 1 open flag)" }]);

    await actAs(db, TEACHER);
    expect(await n(`select count(*)::int as n from eligible_questions('${INST}', '${CS}') where id = '${Q(6)}'`)).toBe(0);
    await actAs(db, OWNER);
    await expect(db.query(`select platform_retire_question('${Q(6)}', 'diagram missing from source')`)).rejects.toThrow(/already retired/);
  });

  it("resolves or dismisses a flag once, with a note", async () => {
    await actAsOwner(db);
    await db.query(`insert into question_flags (id, institute_id, question_id, raised_by, reason) values ('f1a90000-0000-0000-0000-000000000002', '${INST}', '${Q(1)}', '${TEACHER}', 'answer looks wrong')`);
    await actAs(db, OWNER);
    await expect(db.query(`select platform_resolve_flag('f1a90000-0000-0000-0000-000000000002', 'fixed', 'checked the key')`)).rejects.toThrow(/invalid flag status/);
    await db.query(`select platform_resolve_flag('f1a90000-0000-0000-0000-000000000002', 'dismissed', 'checked the key; it is right')`);
    await expect(db.query(`select platform_resolve_flag('f1a90000-0000-0000-0000-000000000002', 'dismissed', 'checked the key; it is right')`)).rejects.toThrow(/already closed/);
  });
});

describe("invites", () => {
  it("lists, invites a replacement admin, re-invites without duplicating, and revokes — all logged", async () => {
    await actAs(db, OWNER);
    expect((await rows<{ email: string }>(`select email from platform_list_invites('${INST}')`)).map((r) => r.email)).toEqual(["pending@a.test"]);

    await db.query(`select platform_invite('${INST}', 'New.Admin@a.test', 'institute_admin')`);
    await db.query(`select platform_invite('${INST}', 'new.admin@a.test', 'teacher')`);
    await actAsOwner(db);
    expect(await rows(`select role from institute_invites where institute_id = '${INST}' and email = 'new.admin@a.test'`)).toEqual([{ role: "teacher" }]);

    await actAs(db, OWNER);
    await expect(db.query(`select platform_invite('${INST}', 'teacher@a.test', 'institute_admin')`)).rejects.toThrow(/already a member/);
    await db.query(`select platform_revoke_invite('${INVITE}')`);
    await expect(db.query(`select platform_revoke_invite('${INVITE}')`)).rejects.toThrow(/not found/);

    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from platform_access_log where action in ('read_invites', 'invite', 'revoke_invite') and institute_id = '${INST}'`)).toBe(4);
  });

  it("shows reasons in the audit trail", async () => {
    await actAs(db, OWNER);
    const audit = await rows<{ action: string; target: string }>(`select action, target from platform_audit('${INST}', 100) where action = 'revoke_invite'`);
    expect(audit).toEqual([{ action: "revoke_invite", target: "pending@a.test as teacher" }]);
  });
});
