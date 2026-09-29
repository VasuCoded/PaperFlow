import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { join } from "node:path";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";
import { instituteId, stagingPeople, stagingStatements } from "../../scripts/staging/staging-sql";

/**
 * An institute admin can do everything a teacher can: set and save papers,
 * make batches, flag questions, save layouts. The staging seed also gives its
 * admin a teaching assignment for every subject, which would hide a gap, so
 * these tests first remove them: the admin here has NONE, like a real one.
 */
let db: PGlite;
const ROOT = join(__dirname, "..", "..");
const sunrise = instituteId("sunrise");
const person = (inst: string, username: string) => stagingPeople(inst).find((p) => p.username === username)!;
const admin = person("sunrise", "sunrise.admin");
const student = person("sunrise", "sunrise.student1");
const mathsTeacher = person("sunrise", "sunrise.teacher1"); // teaches Maths only

const cs = (cls: string, subject: string) =>
  `(select cs.id from class_subjects cs join classes c on c.id = cs.class_id join subjects s on s.id = cs.subject_id where c.name = '${cls}' and s.name = '${subject}')`;
async function one<T>(sql: string): Promise<T> {
  return (await db.query<T>(sql)).rows[0]!;
}
async function fails(sql: string): Promise<string> {
  try {
    await db.query(sql);
    return "";
  } catch (e) {
    return (e as Error).message;
  }
}

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;
  await actAsOwner(db);
  for (const stmt of stagingStatements({ repoRoot: ROOT })) await db.exec(stmt);
  await db.exec(`delete from teacher_subjects where teacher_id = '${admin.id}' and institute_id = '${sunrise}'`);
}, 120_000);

describe("an institute admin with no teaching assignments", () => {
  it("really has none (nothing is borrowed from the seed)", async () => {
    await actAsOwner(db);
    expect((await one<{ n: number }>(`select count(*)::int as n from teacher_subjects where teacher_id = '${admin.id}'`)).n).toBe(0);
  });

  it("draws from the question pool of every active subject", async () => {
    await actAs(db, admin.id);
    const maths = await one<{ n: number }>(`select count(*)::int as n from eligible_questions('${sunrise}', ${cs("10", "Mathematics")})`);
    const science = await one<{ n: number }>(`select count(*)::int as n from eligible_questions('${sunrise}', ${cs("10", "Science")})`);
    expect(maths.n).toBeGreaterThan(0);
    expect(science.n).toBeGreaterThan(0);
  });

  it("counts against the generation limit like a teacher", async () => {
    await actAs(db, admin.id);
    expect(await fails(`select note_generation('${sunrise}', 'preview')`)).toBe("");
    expect(await fails(`select note_generation('${sunrise}', 'save')`)).toBe("");
  });

  it("saves a paper and its sections, and the paper gets its code", async () => {
    await actAs(db, admin.id);
    const p = await one<{ id: string; code: string }>(
      `insert into papers (institute_id, teacher_id, class_subject_id, title)
       values ('${sunrise}', '${admin.id}', ${cs("10", "Science")}, 'Admin paper') returning id, code`,
    );
    expect(p.code).toMatch(/^SSA-10SCI-\d{6}-\d{2}$/);
    expect(await fails(`insert into paper_sections (institute_id, paper_id, label, sort_order) values ('${sunrise}', '${p.id}', 'A', 0)`)).toBe("");
    const seen = await one<{ n: number }>(`select count(*)::int as n from papers where id = '${p.id}'`);
    expect(seen.n).toBe(1);
  });

  it("saves a layout for a subject it is not assigned to", async () => {
    await actAs(db, admin.id);
    const sections = JSON.stringify([{ question_count: 10, marks_each: 1, question_types: ["mcq"] }]);
    expect(await fails(`select create_paper_layout('${sunrise}', ${cs("10", "Science")}, 'Admin layout', '', '${sections}'::jsonb, false, 30)`)).toBe("");
  });

  it("creates a batch for any active subject, and it gets a join code", async () => {
    await actAs(db, admin.id);
    const b = await one<{ join_code: string }>(
      `insert into batches (institute_id, name, class_subject_id, teacher_id, join_code, active)
       values ('${sunrise}', 'Admin batch', ${cs("10", "Science")}, '${admin.id}', '', true) returning join_code`,
    );
    expect(b.join_code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it("flags a question", async () => {
    await actAsOwner(db);
    const q = await one<{ id: string }>(`select id from questions where status = 'approved' and owner_institute_id = public.platform_institute_id() limit 1`);
    await actAs(db, admin.id);
    expect(await fails(`insert into question_flags (institute_id, question_id, raised_by, reason, status) values ('${sunrise}', '${q.id}', '${admin.id}', 'wrong answer key', 'open')`)).toBe("");
  });
});

describe("the controls: the same actions are still refused to people who should not do them", () => {
  it("a student cannot save a paper", async () => {
    await actAs(db, student.id);
    expect(await fails(`insert into papers (institute_id, teacher_id, class_subject_id, title) values ('${sunrise}', '${student.id}', ${cs("10", "Mathematics")}, 'Nope')`)).toMatch(/row-level security|violates/);
    await actAsOwner(db);
  });

  it("a teacher cannot make a batch for a subject they are not assigned (an admin can)", async () => {
    await actAs(db, mathsTeacher.id);
    expect(await fails(`insert into batches (institute_id, name, class_subject_id, teacher_id, join_code, active) values ('${sunrise}', 'Nope', ${cs("10", "Science")}, '${mathsTeacher.id}', '', true)`)).toMatch(/row-level security|violates/);
    await actAsOwner(db);
  });

  it("a student cannot make a batch or flag a question", async () => {
    await actAsOwner(db);
    const q = await one<{ id: string }>(`select id from questions where status = 'approved' and owner_institute_id = public.platform_institute_id() limit 1`);
    await actAs(db, student.id);
    expect(await fails(`insert into batches (institute_id, name, class_subject_id, teacher_id, join_code, active) values ('${sunrise}', 'Nope', ${cs("10", "Mathematics")}, '${student.id}', '', true)`)).toMatch(/row-level security|violates/);
    expect(await fails(`insert into question_flags (institute_id, question_id, raised_by, reason, status) values ('${sunrise}', '${q.id}', '${student.id}', 'x', 'open')`)).toMatch(/row-level security|violates/);
    await actAsOwner(db);
  });
});
