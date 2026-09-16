import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";

/**
 * Executable tests for migration 0010, against the real migrations.
 *
 * The paper has two sets whose orders differ. Set A prints q1,q2 | q3,q4 and
 * Set B prints q2,q1 | q4,q3 — positions 0-1 are 1-mark, 2-3 are 2-mark in
 * both, as the marks-per-position trigger requires.
 */
const PLATFORM = "11111111-1111-1111-1111-111111111111";
const INST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const CS = "c5000000-0000-0000-0000-000000000001";
const CH = "c4a70000-0000-0000-0000-000000000001";
const TEACHER = "a2a2a2a2-0000-0000-0000-000000000001";
const STUDENT = "a3a3a3a3-0000-0000-0000-000000000001";
const BATCH = "ba700000-0000-0000-0000-00000000000a";
const PAPER = "9a9e0000-0000-0000-0000-00000000000a";
const OTHER_PAPER = "9a9e0000-0000-0000-0000-00000000000b";
const SEC_A = "5ec00000-0000-0000-0000-00000000000a";
const SEC_B = "5ec00000-0000-0000-0000-00000000000b";
const SET_A = "5e700000-0000-0000-0000-00000000000a";
const SET_B = "5e700000-0000-0000-0000-00000000000b";
const OTHER_SET = "5e700000-0000-0000-0000-0000000000ff";

const Q = (n: number) => `90000000-0000-0000-0000-00000000000${n}`;
const B = (n: number) => `b10c0000-0000-0000-0000-00000000000${n}`;
const PRIVATE_OTHER = "90000000-0000-0000-0000-0000000000ee";

let db: PGlite;

async function one<T>(sql: string): Promise<T> {
  const r = await db.query<T>(sql);
  return r.rows[0] as T;
}
async function rows<T>(sql: string): Promise<T[]> {
  return (await db.query<T>(sql)).rows;
}

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;

  await db.exec(`
    insert into auth.users (id, email) values
      ('${TEACHER}', 'teacher@a.test'), ('${STUDENT}', 'student@a.test');
    insert into institutes (id, name, slug, kind, status) values
      ('${INST}', 'A', 'a', 'institute', 'active'),
      ('${OTHER}', 'B', 'b', 'institute', 'active');
    insert into institute_members (institute_id, user_id, role) values
      ('${INST}', '${TEACHER}', 'teacher'), ('${INST}', '${STUDENT}', 'student');

    insert into classes (id, name) values ('00000010-0000-0000-0000-000000000010', '10');
    insert into subjects (id, name) values ('5c1e0000-0000-0000-0000-000000000001', 'Science');
    insert into class_subjects (id, class_id, subject_id, bank_status)
      values ('${CS}', '00000010-0000-0000-0000-000000000010', '5c1e0000-0000-0000-0000-000000000001', 'ready');
    insert into chapters (id, class_subject_id, name) values ('${CH}', '${CS}', 'Ch');
    insert into teacher_subjects (institute_id, teacher_id, class_subject_id) values ('${INST}', '${TEACHER}', '${CS}');

    insert into questions (id, owner_institute_id, class_subject_id, chapter_id, body, question_type, marks, difficulty) values
      ('${Q(1)}', '${PLATFORM}', '${CS}', '${CH}', 'q1', 'mcq', 1, 'easy'),
      ('${Q(2)}', '${PLATFORM}', '${CS}', '${CH}', 'q2', 'mcq', 1, 'easy'),
      ('${Q(3)}', '${PLATFORM}', '${CS}', '${CH}', 'q3', 'sa', 2, 'medium'),
      ('${Q(4)}', '${PLATFORM}', '${CS}', '${CH}', 'q4', 'sa', 2, 'medium'),
      ('${Q(5)}', '${PLATFORM}', '${CS}', '${CH}', 'q5 practice', 'mcq', 1, 'easy'),
      ('${PRIVATE_OTHER}', '${OTHER}', '${CS}', '${CH}', 'B private', 'mcq', 1, 'easy');
    update questions set status = 'approved';

    insert into batches (id, institute_id, name, class_subject_id, teacher_id, join_code)
      values ('${BATCH}', '${INST}', 'A-10', '${CS}', '${TEACHER}', 'KQZ7XR');
    insert into enrolments (institute_id, batch_id, student_id, class_subject_id)
      values ('${INST}', '${BATCH}', '${STUDENT}', '${CS}');

    insert into papers (id, institute_id, teacher_id, batch_id, class_subject_id, title, status) values
      ('${PAPER}', '${INST}', '${TEACHER}', '${BATCH}', '${CS}', 'UT', 'generated'),
      ('${OTHER_PAPER}', '${INST}', '${TEACHER}', '${BATCH}', '${CS}', 'UT2', 'generated');
    insert into paper_sections (id, institute_id, paper_id, label, sort_order) values
      ('${SEC_A}', '${INST}', '${PAPER}', 'A', 0), ('${SEC_B}', '${INST}', '${PAPER}', 'B', 1);
    insert into paper_blocks (id, institute_id, paper_id, section_id, canonical_position) values
      ('${B(1)}', '${INST}', '${PAPER}', '${SEC_A}', 1),
      ('${B(2)}', '${INST}', '${PAPER}', '${SEC_A}', 2),
      ('${B(3)}', '${INST}', '${PAPER}', '${SEC_B}', 3),
      ('${B(4)}', '${INST}', '${PAPER}', '${SEC_B}', 4);
    insert into paper_questions (institute_id, paper_id, block_id, question_id, marks) values
      ('${INST}', '${PAPER}', '${B(1)}', '${Q(1)}', 1),
      ('${INST}', '${PAPER}', '${B(2)}', '${Q(2)}', 1),
      ('${INST}', '${PAPER}', '${B(3)}', '${Q(3)}', 2),
      ('${INST}', '${PAPER}', '${B(4)}', '${Q(4)}', 2);

    insert into paper_sets (id, institute_id, paper_id, set_label, copies_to_print) values
      ('${SET_A}', '${INST}', '${PAPER}', 'A', 20),
      ('${SET_B}', '${INST}', '${PAPER}', 'B', 20),
      ('${OTHER_SET}', '${INST}', '${OTHER_PAPER}', 'A', 40);
    insert into paper_set_items (institute_id, paper_set_id, paper_block_id, display_position) values
      ('${INST}', '${SET_A}', '${B(1)}', 0), ('${INST}', '${SET_A}', '${B(2)}', 1),
      ('${INST}', '${SET_A}', '${B(3)}', 2), ('${INST}', '${SET_A}', '${B(4)}', 3),
      ('${INST}', '${SET_B}', '${B(2)}', 0), ('${INST}', '${SET_B}', '${B(1)}', 1),
      ('${INST}', '${SET_B}', '${B(4)}', 2), ('${INST}', '${SET_B}', '${B(3)}', 3);
  `);
});

afterEach(async () => {
  await actAsOwner(db);
});

async function results(attemptId: string): Promise<Record<string, boolean>> {
  await actAsOwner(db);
  const r = await rows<{ question_id: string; is_correct: boolean }>(
    `select question_id, is_correct from attempt_items where attempt_id = '${attemptId}'`,
  );
  return Object.fromEntries(r.map((x) => [x.question_id, x.is_correct]));
}

describe("marks-per-position trigger", () => {
  it("rejects a set that puts a 2-mark block at a 1-mark position", async () => {
    await expect(
      db.exec(`
        insert into paper_sets (id, institute_id, paper_id, set_label)
          values ('5e700000-0000-0000-0000-00000000000c', '${INST}', '${PAPER}', 'C');
        insert into paper_set_items (institute_id, paper_set_id, paper_block_id, display_position)
          values ('${INST}', '5e700000-0000-0000-0000-00000000000c', '${B(3)}', 0);
      `),
    ).rejects.toThrow(/marks-per-position/);
  });
});

describe("log_attempt", () => {
  let attemptId = "";

  it("maps tapped positions to questions through the chosen set", async () => {
    await actAs(db, STUDENT);
    const r = await one<{ id: string }>(
      `select log_attempt('${PAPER}', '${SET_B}', array[0, 3]) as id`,
    );
    attemptId = r.id;

    // Set B: pos0 = q2, pos3 = q3
    expect(await results(attemptId)).toEqual({
      [Q(1)]: true,
      [Q(2)]: false,
      [Q(3)]: false,
      [Q(4)]: true,
    });
  });

  it("records exposure for every question on the paper", async () => {
    await actAsOwner(db);
    const n = await one<{ n: number }>(
      `select count(*)::int as n from question_exposure where student_id = '${STUDENT}'`,
    );
    expect(n.n).toBe(4);
  });

  it("refuses a multi-set paper without a chosen set", async () => {
    await actAs(db, STUDENT);
    await expect(db.query(`select log_attempt('${PAPER}', null, array[0])`)).rejects.toThrow(/choose the set/);
  });

  it("refuses a set from a different paper", async () => {
    await actAs(db, STUDENT);
    await expect(db.query(`select log_attempt('${PAPER}', '${OTHER_SET}', array[0])`)).rejects.toThrow(/does not belong/);
  });

  it("does not let a teacher log on a student's behalf", async () => {
    await actAs(db, TEACHER);
    await expect(db.query(`select log_attempt('${PAPER}', '${SET_A}', array[0])`)).rejects.toThrow(/only a student/);
  });

  it("re-logging replaces the items rather than duplicating them", async () => {
    await actAs(db, STUDENT);
    await db.query(`select log_attempt('${PAPER}', '${SET_B}', array[1])`);
    const r = await results(attemptId);
    expect(Object.keys(r)).toHaveLength(4);
    expect(r[Q(1)]).toBe(false); // set B pos1 = q1
    expect(r[Q(2)]).toBe(true);

    // put it back for the correction tests
    await actAs(db, STUDENT);
    await db.query(`select log_attempt('${PAPER}', '${SET_B}', array[0, 3])`);
  });
});

describe("correct_attempt_set", () => {
  const attempt = async () => {
    await actAsOwner(db);
    return (await one<{ id: string; paper_set_id: string }>(
      `select id, paper_set_id from attempts where student_id = '${STUDENT}' and paper_id = '${PAPER}'`,
    ));
  };

  it("refuses a student", async () => {
    const a = await attempt();
    await actAs(db, STUDENT);
    await expect(db.query(`select correct_attempt_set('${a.id}', '${SET_A}')`)).rejects.toThrow(/only a teacher/);
  });

  it("refuses a set belonging to another paper", async () => {
    const a = await attempt();
    await actAs(db, TEACHER);
    await expect(db.query(`select correct_attempt_set('${a.id}', '${OTHER_SET}')`)).rejects.toThrow(/does not belong/);
  });

  it("remaps every tap to the question at that position in the correct set, atomically", async () => {
    const a = await attempt();
    expect(a.paper_set_id).toBe(SET_B);

    // a practice set built off the wrong mapping must not survive
    await actAs(db, STUDENT);
    await db.query(
      `select save_practice_set('${a.id}', '[{"question_id":"${Q(5)}","position":0}]'::jsonb)`,
    );
    await actAsOwner(db);
    expect((await one<{ n: number }>(`select count(*)::int as n from practice_sets where attempt_id = '${a.id}'`)).n).toBe(1);

    await actAs(db, TEACHER);
    await db.query(`select correct_attempt_set('${a.id}', '${SET_A}')`);

    // The student tapped positions 0 and 3 on the sheet in their hand, which was
    // actually Set A: pos0 = q1, pos3 = q4.
    expect(await results(a.id)).toEqual({
      [Q(1)]: false,
      [Q(2)]: true,
      [Q(3)]: true,
      [Q(4)]: false,
    });

    const after = await attempt();
    expect(after.paper_set_id).toBe(SET_A);
    expect((await one<{ n: number }>(`select count(*)::int as n from practice_sets where attempt_id = '${a.id}'`)).n).toBe(0);
    // exposure is per question, and the question multiset is identical in every set
    expect((await one<{ n: number }>(`select count(*)::int as n from question_exposure where student_id = '${STUDENT}' and context = 'paper'`)).n).toBe(4);
  });

  it("is a no-op when the set is already right", async () => {
    const a = await attempt();
    const before = await results(a.id);
    await actAs(db, TEACHER);
    await db.query(`select correct_attempt_set('${a.id}', '${SET_A}')`);
    expect(await results(a.id)).toEqual(before);
  });
});

describe("save_practice_set", () => {
  it("rejects a question from another institute's private layer", async () => {
    await actAsOwner(db);
    const a = await one<{ id: string }>(`select id from attempts where student_id = '${STUDENT}'`);
    await actAs(db, STUDENT);
    await expect(
      db.query(`select save_practice_set('${a.id}', '[{"question_id":"${PRIVATE_OTHER}","position":0}]'::jsonb)`),
    ).rejects.toThrow(/may not be given/);
  });

  it("stores items, exposure and coverage gaps", async () => {
    await actAsOwner(db);
    const a = await one<{ id: string }>(`select id from attempts where student_id = '${STUDENT}'`);
    await actAs(db, STUDENT);
    await db.query(`
      select save_practice_set(
        '${a.id}',
        '[{"question_id":"${Q(5)}","position":0}]'::jsonb,
        '[{"topic_id":null,"difficulty":"easy","severity":"severe"}]'::jsonb
      )
    `);
    await actAsOwner(db);
    expect((await one<{ n: number }>(`select count(*)::int as n from practice_set_items psi join practice_sets ps on ps.id = psi.practice_set_id where ps.attempt_id = '${a.id}'`)).n).toBe(1);
    expect((await one<{ n: number }>(`select count(*)::int as n from question_exposure where student_id = '${STUDENT}' and question_id = '${Q(5)}'`)).n).toBe(1);
    expect((await one<{ n: number }>(`select count(*)::int as n from coverage_gaps where institute_id = '${INST}' and severity = 'severe'`)).n).toBe(1);
  });
});

describe("rotate_join_code", () => {
  it("issues a new code without O, 0, I or 1, and kills the old one", async () => {
    await actAs(db, TEACHER);
    const r = await one<{ code: string }>(`select rotate_join_code('${BATCH}') as code`);
    expect(r.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(r.code).not.toBe("KQZ7XR");
    await actAsOwner(db);
    expect((await one<{ n: number }>(`select count(*)::int as n from batches where join_code = 'KQZ7XR'`)).n).toBe(0);
  });

  it("refuses a student", async () => {
    await actAs(db, STUDENT);
    await expect(db.query(`select rotate_join_code('${BATCH}')`)).rejects.toThrow(/not authorised/);
  });
});
