import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { join } from "node:path";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";
import { instituteId, stagingPeople, stagingStatements } from "../../scripts/staging/staging-sql";

/**
 * Migrations 0021 (paper codes) and 0022 (custom layouts), on the staging
 * dataset: codes are assigned by the database, readable, unique and
 * unforgeable; layouts are saved only by people who could set that paper.
 */
let db: PGlite;
const ROOT = join(__dirname, "..", "..");
const sunrise = instituteId("sunrise");
const person = (inst: string, username: string) => stagingPeople(inst).find((p) => p.username === username)!;

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
const cs = (cls: string, subject: string) =>
  `(select cs.id from class_subjects cs join classes c on c.id = cs.class_id join subjects s on s.id = cs.subject_id where c.name = '${cls}' and s.name = '${subject}')`;

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;
  await actAsOwner(db);
  for (const stmt of stagingStatements({ repoRoot: ROOT })) await db.exec(stmt);
}, 120_000);

describe("institute codes", () => {
  it("are initials, unique, and never change", async () => {
    await actAsOwner(db);
    const codes = (await db.query<{ slug: string; code: string }>(`select slug, code from institutes order by slug`)).rows;
    expect(codes.find((c) => c.slug === "staging-sunrise")!.code).toBe("SSA");
    expect(new Set(codes.map((c) => c.code)).size).toBe(codes.length);

    await db.exec(`insert into institutes (name, slug, kind) values ('Sunshine Science Academy', 'staging-x-sunshine', 'institute')`);
    expect((await one<{ code: string }>(`select code from institutes where slug = 'staging-x-sunshine'`)).code).toBe("SSA2");

    await db.exec(`update institutes set code = 'HACK', name = 'Renamed' where id = '${sunrise}'`);
    expect((await one<{ code: string }>(`select code from institutes where id = '${sunrise}'`)).code).toBe("SSA");
  });
});

describe("paper codes", () => {
  it("are readable and unique for every paper the seed made", async () => {
    await actAsOwner(db);
    const rows = (await db.query<{ code: string }>(`select code from papers`)).rows;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.code).toMatch(/^[A-Z0-9]{2,8}-10MAT-\d{6}-\d{2}$/);
    expect(new Set(rows.map((r) => r.code)).size).toBe(rows.length);
  });

  it("number the day's papers across the whole institute, ignore a client's code, and never change", async () => {
    const t1 = person("sunrise", "sunrise.teacher1");
    const t2 = person("sunrise", "sunrise.teacher2");
    const insert = (teacher: string, subject: string) =>
      `insert into papers (institute_id, teacher_id, class_subject_id, title, code, created_at)
       values ('${sunrise}', '${teacher}', ${cs("10", subject)}, 'Test', 'FORGED-CODE', '2026-09-22 10:00+05:30') returning code`;

    await actAs(db, t1.id);
    const a = await one<{ code: string }>(insert(t1.id, "Mathematics"));
    await actAs(db, t2.id);
    // teacher 2 cannot see teacher 1's paper, but the number still counts it
    const b = await one<{ code: string }>(insert(t2.id, "Science"));
    expect(a.code).toBe("SSA-10MAT-260922-01");
    expect(b.code).toBe("SSA-10SCI-260922-02");

    await actAs(db, t1.id);
    await db.exec(`update papers set code = 'SSA-10MAT-260922-99' where code = '${a.code}'`);
    await actAsOwner(db);
    expect((await one<{ n: number }>(`select count(*)::int as n from papers where code = '${a.code}'`)).n).toBe(1);
  });
});

describe("create_paper_layout", () => {
  const sections = JSON.stringify([
    { question_count: 100, marks_each: 1, question_types: ["mcq"], instructions: "Choose the correct option." },
    { question_count: 2, marks_each: 4, question_types: ["case_study"], requires_stimulus: true },
  ]);
  const call = (inst: string, subject: string, listed = false, secs = sections) =>
    `select create_paper_layout('${inst}', ${cs("10", subject)}, 'My MCQ test', 'All compulsory.', '${secs}'::jsonb, ${listed}, 120) as id`;

  it("stores the layout for a teacher of that subject, unlisted unless asked", async () => {
    const t2 = person("sunrise", "sunrise.teacher2");
    await actAs(db, t2.id);
    const { id } = await one<{ id: string }>(call(sunrise, "Science"));
    await actAsOwner(db);
    const p = await one<{ total_marks: number; duration_min: number; listed: boolean; created_by: string; general_instructions: string; origin: string }>(
      `select total_marks, duration_min, listed, created_by, general_instructions, origin from paper_patterns where id = '${id}'`,
    );
    expect(p).toMatchObject({ total_marks: 108, duration_min: 120, listed: false, created_by: t2.id, general_instructions: "All compulsory.", origin: "institute" });
    const secs = (await db.query<{ label: string; question_count: number; question_types: string[]; requires_stimulus: boolean }>(
      `select label, question_count, question_types, requires_stimulus from pattern_sections where pattern_id = '${id}' order by sort_order`,
    )).rows;
    expect(secs).toEqual([
      { label: "A", question_count: 100, question_types: ["mcq"], requires_stimulus: false },
      { label: "B", question_count: 2, question_types: ["case_study"], requires_stimulus: true },
    ]);
  });

  it("refuses anyone who could not set that paper", async () => {
    await actAs(db, person("sunrise", "sunrise.teacher1").id); // Maths only
    expect(await fails(call(sunrise, "Science"))).toMatch(/not assigned/);
    await actAs(db, person("sunrise", "sunrise.student1").id);
    expect(await fails(call(sunrise, "Mathematics"))).toMatch(/only a teacher or institute admin/);
    await actAs(db, person("riverside", "riverside.teacher1").id); // another institute
    expect(await fails(call(sunrise, "Mathematics"))).toMatch(/only a teacher or institute admin/);
    await actAsOwner(db);
  });

  it("refuses a layout the app would never send", async () => {
    await actAs(db, person("sunrise", "sunrise.teacher1").id);
    expect(await fails(call(sunrise, "Mathematics", false, "[]"))).toMatch(/between 1 and 12 sections/);
    expect(await fails(call(sunrise, "Mathematics", false, JSON.stringify([{ question_count: 201, marks_each: 1, question_types: ["mcq"] }])))).toMatch(/invalid section/);
    expect(await fails(call(sunrise, "Mathematics", false, JSON.stringify([{ question_count: 5, marks_each: 1, question_types: [] }])))).toMatch(/invalid section/);
    await actAsOwner(db);
  });

  it("lets the creator or an admin take a template off the list, and nobody else", async () => {
    const t1 = person("sunrise", "sunrise.teacher1");
    await actAs(db, t1.id);
    const { id } = await one<{ id: string }>(call(sunrise, "Mathematics", true));
    await actAs(db, person("sunrise", "sunrise.teacher2").id);
    expect(await fails(`select unlist_paper_layout('${id}')`)).toMatch(/not allowed/);
    await actAs(db, t1.id);
    await db.query(`select unlist_paper_layout('${id}')`);
    await actAsOwner(db);
    expect((await one<{ listed: boolean }>(`select listed from paper_patterns where id = '${id}'`)).listed).toBe(false);
  });
});
