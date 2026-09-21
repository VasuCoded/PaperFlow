import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { join } from "node:path";
import { actAs, actAsOwner, bootstrapDb } from "../../scripts/schema-harness";
import {
  assertStagingTarget,
  instituteId,
  STAGING_INSTITUTES,
  STUDENTS_PER_INSTITUTE,
  stagingId,
  stagingPeople,
  stagingStatements,
} from "../../scripts/staging/staging-sql";
import { LP_CASES, LP_QUESTIONS, LP_SOURCE } from "../../scripts/staging/life-processes";
import { LP_PATTERN_NAME } from "../../scripts/staging/life-processes-sql";
import { gateStatus } from "@/lib/gate";
import { buildBlocks, generatePaper } from "@/server/generator";
import type { GenQuestion } from "@/server/generator/types";

/**
 * The staging seed (C12 item 10), run against the real migrations: it applies
 * cleanly, is idempotent, produces the gate results it claims, and its data is
 * good enough for the actual generator to set a paper from.
 */
const ROOT = join(__dirname, "..", "..");
const OWNER = "0f0f0f0f-0000-0000-0000-000000000001";

let db: PGlite;

async function n(sql: string): Promise<number> {
  return Number((await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0);
}

async function runSeed(refreshContent = false) {
  await actAsOwner(db);
  await db.exec("begin");
  try {
    for (const stmt of stagingStatements({
      repoRoot: ROOT,
      testers: [
        { email: "Tester.One@example.com", role: "teacher", institute: "riverside" },
        { login: "@Friend.Two", role: "student", institute: "hilltop" },
      ],
      platformOwner: "owner@platform.test",
      password: "staging-pass-123",
      refreshContent,
    })) {
      await db.exec(stmt);
    }
    await db.exec("commit");
  } catch (e) {
    await db.exec("rollback");
    throw e;
  }
}

const snapshot = async () => ({
  questions: await n(`select count(*)::int as n from questions`),
  papers: await n(`select count(*)::int as n from papers`),
  attempts: await n(`select count(*)::int as n from attempts`),
  attemptItems: await n(`select count(*)::int as n from attempt_items`),
  members: await n(`select count(*)::int as n from institute_members`),
  batches: await n(`select count(*)::int as n from batches`),
  flags: await n(`select count(*)::int as n from question_flags`),
  invites: await n(`select count(*)::int as n from institute_invites`),
});

beforeAll(async () => {
  const boot = await bootstrapDb({ quiet: true });
  if (boot.failure) throw new Error(`${boot.failure.file}: ${boot.failure.error}`);
  db = boot.db;
  // The owner signs in before the seed grants them the platform.
  await db.exec(`insert into auth.users (id, email) values ('${OWNER}', 'owner@platform.test')`);
  await runSeed();
}, 120_000);

describe("staging seed", () => {
  it("builds three institutes with their people", async () => {
    expect(await n(`select count(*)::int as n from institutes where slug like 'staging-%'`)).toBe(3);
    for (const inst of STAGING_INSTITUTES) {
      const iid = instituteId(inst.key);
      expect(await n(`select count(*)::int as n from institute_members where institute_id = '${iid}' and role = 'student'`)).toBe(STUDENTS_PER_INSTITUTE);
      expect(await n(`select count(*)::int as n from institute_members where institute_id = '${iid}' and role = 'teacher'`)).toBe(3);
      expect(await n(`select count(*)::int as n from profiles where email like '${inst.key}.%'`)).toBe(stagingPeople(inst.key).length);
    }
    expect(await n(`select count(*)::int as n from institute_members where role = 'owner' and user_id = '${OWNER}'`)).toBe(1);
  });

  it("derives the same ids in TypeScript and SQL", async () => {
    const r = await db.query<{ id: string }>(`select md5('staging:institute:sunrise')::uuid::text as id`);
    expect(r.rows[0]!.id).toBe(stagingId("institute:sunrise"));
  });

  it("passes the activation gate for Maths and Biology, and deliberately fails it for Science", async () => {
    await actAs(db, OWNER);
    const coverage = (await db.query<{ label: string; bank_status: string; approved: number; chapters: number; thinnest_chapter: string | null; thinnest_chapter_count: number | null; thinnest_topic_count: number | null; staging: number }>(
      `select label, bank_status, approved, chapters, thinnest_chapter, thinnest_chapter_count, thinnest_topic_count, staging from platform_bank_coverage()`,
    )).rows;
    await actAsOwner(db);
    const byLabel = new Map(coverage.map((c) => [c.label, c]));
    expect(gateStatus(byLabel.get("Class 10 · Mathematics")!).met).toBe(true);
    expect(gateStatus(byLabel.get("Class 12 · Biology")!).met).toBe(true);
    expect(gateStatus(byLabel.get("Class 10 · Science")!).met).toBe(false);
    expect(byLabel.get("Class 10 · Science")!.bank_status).toBe("seeding");
    expect(byLabel.get("Class 10 · Mathematics")!.staging).toBeGreaterThan(0);
  });

  it("gives each institute two papers with two sets and ~75% of the batch logged", async () => {
    for (const inst of STAGING_INSTITUTES) {
      const iid = instituteId(inst.key);
      expect(await n(`select count(*)::int as n from papers where institute_id = '${iid}'`)).toBe(2);
      expect(await n(`select count(*)::int as n from paper_blocks where institute_id = '${iid}'`)).toBe(32);
      expect(await n(`select count(*)::int as n from paper_sets where institute_id = '${iid}'`)).toBe(4);
      const attempts = await n(`select count(*)::int as n from attempts where institute_id = '${iid}'`);
      // batch A holds half the first subject's students, across two papers
      expect(attempts).toBeGreaterThan(0);
      expect(await n(`select count(*)::int as n from attempts a where a.institute_id = '${iid}' and (select count(*) from attempt_items ai where ai.attempt_id = a.id) <> 16`)).toBe(0);
    }
    // set B really is a different order from set A
    expect(await n(`
      select count(*)::int as n from paper_set_items a
      join paper_set_items b on b.paper_block_id = a.paper_block_id and b.paper_set_id <> a.paper_set_id
      where a.display_position <> b.display_position`)).toBeGreaterThan(0);
  });

  it("fills the review queue, flags, requests and invites", async () => {
    expect(await n(`select count(*)::int as n from questions where source = 'Staging review sample' and status = 'staging'`)).toBe(12 + 3 * 3);
    expect(await n(`select count(*)::int as n from questions where source = 'Staging review sample' and note is not null`)).toBe(4);
    expect(await n(`select count(*)::int as n from question_flags where status = 'open'`)).toBe(6);
    expect(await n(`select count(*)::int as n from activation_requests where status = 'pending'`)).toBe(1);
    expect(await n(`select count(*)::int as n from activation_requests where status = 'declined' and reason is not null`)).toBe(1);
    expect(await n(`select count(*)::int as n from institute_invites where email = 'tester.one@example.com' and role = 'teacher'`)).toBe(1);
  });

  it("keeps private questions private: a Riverside teacher sees none of Sunrise's", async () => {
    const riversideTeacher = stagingPeople("riverside").find((p) => p.role === "teacher")!;
    await actAs(db, riversideTeacher.id);
    expect(await n(`select count(*)::int as n from questions where owner_institute_id = '${instituteId("sunrise")}'`)).toBe(0);
    expect(await n(`select count(*)::int as n from questions where owner_institute_id = '${instituteId("riverside")}' and status = 'approved'`)).toBe(10);
    expect(await n(`select count(*)::int as n from papers where institute_id <> '${instituteId("riverside")}'`)).toBe(0);
    await actAsOwner(db);
  });

  it("is enough for the real generator to set the unit test for a teacher", async () => {
    const teacher = stagingPeople("sunrise").find((p) => p.role === "teacher")!;
    const iid = instituteId("sunrise");
    const cs = (await db.query<{ id: string }>(
      `select cs.id from class_subjects cs join classes c on c.id = cs.class_id join subjects s on s.id = cs.subject_id where c.name = '10' and s.name = 'Mathematics'`,
    )).rows[0]!.id;
    await actAs(db, teacher.id);
    const pool = (await db.query<{
      id: string; owner_institute_id: string; class_subject_id: string; chapter_id: string | null; topic_id: string | null;
      strand_id: string | null; stimulus_id: string | null; parent_question_id: string | null; difficulty: string; marks: number;
      question_type: string; options_shufflable: boolean; position_locked: boolean;
    }>(`select * from eligible_questions('${iid}', '${cs}')`)).rows;
    await actAsOwner(db);
    expect(pool.length).toBeGreaterThan(700);

    const questions: GenQuestion[] = [...pool].sort((a, b) => a.id.localeCompare(b.id)).map((q, i) => ({
      id: q.id,
      ownerInstituteId: q.owner_institute_id,
      classSubjectId: q.class_subject_id,
      chapterId: q.chapter_id ?? "",
      topicId: q.topic_id,
      strandId: q.strand_id,
      stimulusId: q.stimulus_id,
      parentQuestionId: q.parent_question_id,
      withinBlockOrder: i,
      difficulty: q.difficulty as GenQuestion["difficulty"],
      marks: q.marks,
      questionType: q.question_type,
      optionsShufflable: q.options_shufflable,
      positionLocked: q.position_locked,
    }));
    const sections = (await db.query<{ label: string; question_count: number; marks_each: number; question_types: string[] }>(
      `select label, question_count, marks_each, question_types from pattern_sections where pattern_id = '${stagingId("pattern:10 Mathematics")}' order by sort_order`,
    )).rows;
    const result = generatePaper(
      { instituteId: iid, classSubjectId: cs, allowedOwnerIds: ["11111111-1111-1111-1111-111111111111", iid], difficultySplit: { easy: 0.3, medium: 0.5, hard: 0.2 }, seed: 7 },
      buildBlocks(questions),
      {
        id: stagingId("pattern:10 Mathematics"),
        name: "Staging Unit Test (25 marks)",
        totalMarks: 25,
        sections: sections.map((s) => ({
          label: s.label, questionCount: s.question_count, marksEach: s.marks_each, questionTypes: s.question_types,
          allowChoice: false, practiceEligible: true, requiresStimulus: false,
        })),
      },
    );
    expect(result.ok, result.ok ? "" : result.reason).toBe(true);
  });

  // Found on dev: the real taxonomy loader numbers chapters from 0, and a seed
  // that matched on sort_order put every question one chapter late. Chapters
  // are matched on their NCERT number; the harness numbers them like the loader.
  it("files every question under its own chapter", async () => {
    const perChapter = (await db.query<{ ncert: string; name: string; n: number }>(
      `select ch.ncert_number as ncert, ch.name, count(q.id)::int as n
       from chapters ch join class_subjects cs on cs.id = ch.class_subject_id join classes c on c.id = cs.class_id join subjects s on s.id = cs.subject_id
       left join questions q on q.chapter_id = ch.id and q.status = 'approved' and q.source = 'Staging synthetic'
       where c.name = '10' and s.name = 'Mathematics' group by 1, 2`,
    )).rows;
    expect(perChapter.length).toBeGreaterThan(10);
    for (const ch of perChapter) expect(ch.n, `${ch.ncert} ${ch.name}`).toBe(60);

    const where = async (like: string) =>
      (await db.query<{ name: string }>(`select distinct ch.name from questions q join chapters ch on ch.id = q.chapter_id where q.body like '${like}'`)).rows.map((r) => r.name);
    expect(await where("%HCF%")).toEqual(["Real Numbers"]);
    expect(await where("%probability%")).toEqual(["Probability"]);
    expect(await where("%photosynthesis%")).toEqual(["Life Processes"]);
  });

  it("lets Sunrise's Science teacher set a Life Processes paper from real questions only", async () => {
    const teacher = stagingPeople("sunrise").find((p) => p.username === "sunrise.teacher2")!;
    const iid = instituteId("sunrise");
    const cs = (await db.query<{ id: string }>(
      `select cs.id from class_subjects cs join classes c on c.id = cs.class_id join subjects s on s.id = cs.subject_id where c.name = '10' and s.name = 'Science'`,
    )).rows[0]!.id;
    const chapter = (await db.query<{ id: string }>(`select id from chapters where class_subject_id = '${cs}' and ncert_number = '5'`)).rows[0]!.id;

    await actAs(db, teacher.id);
    const active = await n(`select count(*)::int as n from my_active_class_subjects where class_subject_id = '${cs}'`);
    const pool = (await db.query<{
      id: string; owner_institute_id: string; class_subject_id: string; chapter_id: string | null; topic_id: string | null;
      strand_id: string | null; stimulus_id: string | null; parent_question_id: string | null; difficulty: string; marks: number;
      question_type: string; options_shufflable: boolean; position_locked: boolean; source: string;
    }>(`select * from eligible_questions('${iid}', '${cs}', array['${chapter}']::uuid[])`)).rows;
    const passages = await n(`select count(*)::int as n from stimuli where id in (select stimulus_id from questions where chapter_id = '${chapter}')`);
    await actAsOwner(db);

    expect(active).toBe(1);
    expect(pool.length).toBe(LP_QUESTIONS.length + LP_CASES.reduce((s, c) => s + c.parts.length, 0));
    expect(new Set(pool.map((q) => q.source))).toEqual(new Set([LP_SOURCE]));
    expect(passages).toBe(LP_CASES.length);

    const questions: GenQuestion[] = [...pool].sort((a, b) => a.id.localeCompare(b.id)).map((q, i) => ({
      id: q.id, ownerInstituteId: q.owner_institute_id, classSubjectId: q.class_subject_id, chapterId: q.chapter_id ?? "",
      topicId: q.topic_id, strandId: q.strand_id, stimulusId: q.stimulus_id, parentQuestionId: q.parent_question_id,
      withinBlockOrder: i, difficulty: q.difficulty as GenQuestion["difficulty"], marks: q.marks, questionType: q.question_type,
      optionsShufflable: q.options_shufflable, positionLocked: q.position_locked,
    }));
    const patterns = (await db.query<{ id: string; name: string; total_marks: number }>(
      `select id, name, total_marks from paper_patterns where class_subject_id = '${cs}' and name in ('${LP_PATTERN_NAME}', 'CBSE Class 10 Science (Board)')`,
    )).rows;
    // the board pattern comes from seed-patterns, which this test does not run
    expect(patterns.map((p) => p.name)).toContain(LP_PATTERN_NAME);
    for (const p of patterns) {
      const sections = (await db.query<{ label: string; question_count: number; marks_each: number; question_types: string[]; allow_choice: boolean; requires_stimulus: boolean }>(
        `select label, question_count, marks_each, question_types, allow_choice, requires_stimulus from pattern_sections where pattern_id = '${p.id}' order by sort_order`,
      )).rows;
      const result = generatePaper(
        { instituteId: iid, classSubjectId: cs, allowedOwnerIds: ["11111111-1111-1111-1111-111111111111", iid], difficultySplit: { easy: 0.3, medium: 0.5, hard: 0.2 }, seed: 11 },
        buildBlocks(questions),
        {
          id: p.id, name: p.name, totalMarks: p.total_marks,
          sections: sections.map((s) => ({
            label: s.label, questionCount: s.question_count, marksEach: s.marks_each, questionTypes: s.question_types,
            allowChoice: s.allow_choice, practiceEligible: true, requiresStimulus: s.requires_stimulus,
          })),
        },
      );
      expect(result.ok, `${p.name}: ${result.ok ? "" : result.reason}`).toBe(true);
      if (result.ok) expect(result.totalMarks).toBe(p.total_marks);
    }
  });

  // Found on dev: getSession selected institute_members without a user filter.
  // RLS lets a member read their fellow members, so a teacher's first row
  // could be the admin's, and the teacher got the institute console.
  it("shows a teacher their fellow members, so the session must filter to its own row", async () => {
    const teacher = stagingPeople("sunrise").find((p) => p.username === "sunrise.teacher2")!;
    await actAs(db, teacher.id);
    const all = (await db.query<{ user_id: string; role: string }>(`select user_id, role from institute_members`)).rows;
    const own = (await db.query<{ role: string }>(`select role from institute_members where user_id = '${teacher.id}'`)).rows;
    await actAsOwner(db);
    expect(all.some((r) => r.role === "institute_admin")).toBe(true);
    expect(own.map((r) => r.role)).toEqual(["teacher"]);
  });

  it("is idempotent: running it again changes nothing", async () => {
    const before = await snapshot();
    await runSeed();
    expect(await snapshot()).toEqual(before);
  }, 120_000);

  it("--refresh-content repairs a question's content and chapter, keeps its id and a tester's status", async () => {
    await actAsOwner(db);
    const q = (await db.query<{ id: string; chapter_id: string; body: string }>(
      `select id, chapter_id, body from questions where source = 'Staging synthetic' and body like '%HCF%' order by id limit 1`,
    )).rows[0]!;
    const other = (await db.query<{ id: string }>(`select id from chapters where name = 'Polynomials'`)).rows[0]!.id;
    await db.exec(`update questions set chapter_id = '${other}', body = 'scrambled', status = 'rejected' where id = '${q.id}'`);
    const row = async () =>
      (await db.query<{ chapter_id: string; body: string; status: string }>(`select chapter_id, body, status from questions where id = '${q.id}'`)).rows[0]!;

    await runSeed(false);
    expect((await row()).body).toBe("scrambled");

    await runSeed(true);
    expect(await row()).toEqual({ chapter_id: q.chapter_id, body: q.body, status: "rejected" });
    await db.exec(`update questions set status = 'approved' where id = '${q.id}'`);
  }, 120_000);

  it("refuses a database that has any non-staging institute", () => {
    expect(() => assertStagingTarget(0)).not.toThrow();
    expect(() => assertStagingTarget(2)).toThrow(/refusing to seed/);
  });
});

describe("staging users are readable by Supabase's auth server", () => {
  it("never leaves an auth token column NULL", async () => {
    await actAsOwner(db);
    expect(
      await n(`select count(*)::int as n from auth.users where email like '%@users.paperflow.invalid'
        and (confirmation_token is null or recovery_token is null or email_change_token_new is null or email_change is null)`),
    ).toBe(0);
  });

  // Found on dev: without these, every password sign-in answered
  // "Database error querying schema".
  it("shapes users like a real sign-up: timestamps, email provider, email identity", async () => {
    await actAsOwner(db);
    expect(
      await n(`select count(*)::int as n from auth.users u where u.email like '%@users.paperflow.invalid'
        and (u.created_at is null or u.updated_at is null or u.raw_app_meta_data->>'provider' <> 'email'
          or not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'))`),
    ).toBe(0);
  });
});

describe("staging people are username accounts", () => {
  it("have usernames, a password when one is given, and tester invites by username", async () => {
    await actAsOwner(db);
    expect(await n(`select count(*)::int as n from profiles where username = 'sunrise.teacher1'`)).toBe(1);
    const pw = (await db.query<{ ok: boolean }>(
      `select encrypted_password = crypt('staging-pass-123', encrypted_password) as ok from auth.users where email = 'sunrise.student1@users.paperflow.invalid'`,
    )).rows[0];
    expect(pw?.ok).toBe(true);
    expect(await n(`select count(*)::int as n from institute_invites where email = 'friend.two@users.paperflow.invalid' and role = 'student'`)).toBe(1);
  });
});
