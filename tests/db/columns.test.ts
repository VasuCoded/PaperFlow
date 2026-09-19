import { describe, it, expect, beforeAll, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";

/**
 * The answer columns (CLAUDE.md: "No client-side query may return solution,
 * answer or rubric"). Found on the first live Supabase run: the original
 * column-level REVOKE did nothing, because Supabase grants SELECT on the whole
 * table to authenticated and anon, and in Postgres a column revoke cannot
 * narrow a table-level grant. Migration 0018 revokes the table grant and
 * grants back only the safe columns.
 */
const PLATFORM = "11111111-1111-1111-1111-111111111111";
const INST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const STUDENT = "a3a3a3a3-0000-0000-0000-000000000001";
const TEACHER = "a2a2a2a2-0000-0000-0000-000000000001";
const CS = "c5000000-0000-0000-0000-000000000001";
const CH = "c4a70000-0000-0000-0000-000000000001";
const Q = "90000000-0000-0000-0000-000000000001";

const SECRET = ["answer", "solution", "rubric", "correct_option", "numeric_answer", "tolerance"] as const;

let db: PGlite;

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;
  await db.exec(`
    insert into auth.users (id, email) values ('${STUDENT}', 's@a.test'), ('${TEACHER}', 't@a.test');
    insert into institutes (id, name, slug, kind, status) values ('${INST}', 'A', 'a', 'institute', 'active');
    insert into institute_members (institute_id, user_id, role) values ('${INST}', '${STUDENT}', 'student'), ('${INST}', '${TEACHER}', 'teacher');
    insert into classes (id, name) values ('00000010-0000-0000-0000-000000000010', '10');
    insert into subjects (id, name) values ('5c1e0000-0000-0000-0000-000000000001', 'Science');
    insert into class_subjects (id, class_id, subject_id) values ('${CS}', '00000010-0000-0000-0000-000000000010', '5c1e0000-0000-0000-0000-000000000001');
    insert into chapters (id, class_subject_id, name) values ('${CH}', '${CS}', 'Light');
    insert into questions (id, owner_institute_id, class_subject_id, chapter_id, body, question_type, options, correct_option, answer, solution, marks, difficulty)
      values ('${Q}', '${PLATFORM}', '${CS}', '${CH}', 'What is refraction?', 'mcq', '["a","b"]', 'A', 'the bending of light', 'full working', 1, 'easy');
    update questions set status = 'approved';
  `);
});

afterEach(async () => {
  await actAsOwner(db);
});

describe("question answer columns", () => {
  for (const [who, uid] of [["student", STUDENT], ["teacher", TEACHER]] as const) {
    it(`are unreadable by a signed-in ${who}, column by column and through select *`, async () => {
      for (const col of SECRET) {
        await actAs(db, uid);
        await expect(db.query(`select ${col} from questions where id = '${Q}'`), `${who} read ${col}`).rejects.toThrow(/permission denied/);
      }
      await actAs(db, uid);
      await expect(db.query(`select * from questions where id = '${Q}'`)).rejects.toThrow(/permission denied/);
    });
  }

  it("are unreadable by an anonymous caller", async () => {
    await db.exec(`select set_config('role', 'anon', false); select set_config('request.jwt.claims', '{"role":"anon"}', false);`);
    for (const col of SECRET) {
      await expect(db.query(`select ${col} from questions`), `anon read ${col}`).rejects.toThrow(/permission denied/);
    }
  });

  it("leave everything the app reads readable", async () => {
    await actAs(db, TEACHER);
    const r = await db.query<{ body: string }>(
      `select id, owner_institute_id, class_subject_id, chapter_id, topic_id, strand_id, stimulus_id, parent_question_id,
              part_label, body, question_type, options, marks, difficulty, language, source, source_year, status,
              options_shufflable, position_locked, created_at from questions where id = '${Q}'`,
    );
    expect(r.rows[0]?.body).toBe("What is refraction?");
  });

  it("still reach a student through the gated function once they have attempted the question", async () => {
    await actAs(db, STUDENT);
    expect((await db.query(`select * from get_question_solution('${Q}')`)).rows).toEqual([]);
    await actAsOwner(db);
    await db.exec(`
      insert into batches (id, institute_id, name, class_subject_id, join_code) values ('ba700000-0000-0000-0000-00000000000a', '${INST}', 'X', '${CS}', '');
      insert into papers (id, institute_id, batch_id, class_subject_id, title, status) values ('9a9e0000-0000-0000-0000-00000000000a', '${INST}', 'ba700000-0000-0000-0000-00000000000a', '${CS}', 'UT', 'generated');
      insert into attempts (id, institute_id, paper_id, student_id) values ('a77e0000-0000-0000-0000-00000000000a', '${INST}', '9a9e0000-0000-0000-0000-00000000000a', '${STUDENT}');
      insert into attempt_items (institute_id, attempt_id, question_id, is_correct) values ('${INST}', 'a77e0000-0000-0000-0000-00000000000a', '${Q}', false);
    `);
    await actAs(db, STUDENT);
    const r = await db.query<{ answer: string }>(`select answer from get_question_solution('${Q}')`);
    expect(r.rows[0]?.answer).toBe("the bending of light");
  });

  it("still let the pool functions run as the caller", async () => {
    await actAs(db, TEACHER);
    const r = await db.query<{ id: string }>(`select id from eligible_questions('${INST}', '${CS}')`);
    expect(r.rows.map((x) => x.id)).toEqual([Q]);
  });
});
