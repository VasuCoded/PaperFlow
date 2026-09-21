/**
 * The staging dataset (BUILD-PLAN C12 item 10): "same schema, synthetic
 * questions across several class-subjects and THREE institutes, so future work
 * never touches real data and tenancy bugs surface there first."
 *
 * Pure: builds SQL statements, touches no database. scripts/seed-staging.ts
 * runs them against a staging project; tests/db/staging-seed.test.ts runs them
 * against the migrations in PGlite. Every statement is idempotent — ids are
 * derived from stable keys (md5 → uuid, identically in TS and SQL) and every
 * insert skips rows that exist — so the seed can be re-run after testers have
 * changed things without undoing what they did.
 *
 * What it builds:
 *   class-subjects  10 Mathematics (ready, 60 approved per chapter, real
 *                   chapter-by-chapter questions with computed answers —
 *                   scripts/staging/maths.ts; passes the gate)
 *                   10 Science (seeding, 30 per chapter: fails the gate) —
 *                   except Life Processes, a real CBSE-style chapter of ~170
 *                   questions (scripts/staging/life-processes.ts)
 *                   12 Biology (ready, 60 per chapter, generic filler)
 *                   chapters from docs/taxonomy, matched on NCERT number,
 *                   three synthetic topics each
 *   a platform "Staging Unit Test (25 marks)" pattern per class-subject
 *   institutes      Staging Sunrise Academy (Maths + Biology active, and
 *                   Science taught by teacher 2 for Life Processes)
 *                   Staging Riverside Classes (Maths; Science requested)
 *                   Staging Hilltop Tutorials (Maths; Biology declined)
 *   each            1 admin, 3 teachers, 24 students, 2 batches per subject,
 *                   2 generated papers (two sets each) with ~75% of students
 *                   logged, 10 approved private questions, 2 open flags,
 *                   2 pending invites
 *   review queue    12 staged shared questions (4 with session notes) and
 *                   3 staged private questions per institute
 *
 * Every synthetic person is a username account (`sunrise.admin`,
 * `sunrise.teacher1`, `sunrise.student1`, …). With `password` set, they can all
 * sign in with it — so one tester can walk through every role. Real testers
 * can also be invited through `testers`, and the platform owner is granted
 * through `platformOwner` (a username or email) once that account exists.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loginToEmail, USERNAME_EMAIL_DOMAIN } from "../../src/lib/identity";
import { mathsQuestion } from "./maths";
import { lifeProcessesSql } from "./life-processes-sql";

// Set by stagingStatements before the question SQL is built.
let REPO_ROOT_FOR_MATHS = ".";
let REFRESH_CONTENT = false;

/**
 * With refreshContent, a synthetic question that already exists is rewritten
 * to what the generator now says: content, chapter and topic. Ids never
 * change, so papers and attempts that reference them keep working. Status is
 * never touched, so whatever testers approved, rejected or flagged stays.
 */
export function onConflictSql(columns: string[]): string {
  return REFRESH_CONTENT
    ? `on conflict (id) do update set ${columns.map((c) => `${c} = excluded.${c}`).join(", ")}`
    : "on conflict (id) do nothing";
}

export const STAGING_SLUG_PREFIX = "staging-";
/** Staging people are username accounts, like everyone else. */
export const STAGING_EMAIL_DOMAIN = USERNAME_EMAIL_DOMAIN;

/** md5("staging:" + key) as a uuid — the same value SQL gets from md5(...)::uuid. */
export function stagingId(key: string): string {
  const h = createHash("md5").update(`staging:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

interface SubjectSpec {
  cls: string;
  subject: string;
  short: string;
  csv: string;
  bank: "planned" | "seeding" | "ready";
  perTopic: number;
}

export const STAGING_SUBJECTS: SubjectSpec[] = [
  { cls: "10", subject: "Mathematics", short: "MAT", csv: "10__Mathematics.csv", bank: "ready", perTopic: 20 },
  { cls: "10", subject: "Science", short: "SCI", csv: "10__Science.csv", bank: "seeding", perTopic: 10 },
  { cls: "12", subject: "Biology", short: "BIO", csv: "12__Biology.csv", bank: "ready", perTopic: 20 },
];

type CsKey = "10 Science" | "10 Mathematics" | "12 Biology";

interface InstituteSpec {
  key: string;
  name: string;
  active: CsKey[];
  request: { cs: CsKey; status: "pending" | "declined"; reason?: string } | null;
}

export const STAGING_INSTITUTES: InstituteSpec[] = [
  { key: "sunrise", name: "Staging Sunrise Academy", active: ["10 Mathematics", "12 Biology"], request: null },
  { key: "riverside", name: "Staging Riverside Classes", active: ["10 Mathematics"], request: { cs: "10 Science", status: "pending" } },
  {
    key: "hilltop",
    name: "Staging Hilltop Tutorials",
    active: ["10 Mathematics"],
    request: {
      cs: "12 Biology",
      status: "declined",
      reason: "Class 12 Biology is active for other institutes; we will turn it on once one of your teachers has read three generated papers.",
    },
  },
];

export const STUDENTS_PER_INSTITUTE = 24;
export const TEACHERS_PER_INSTITUTE = 3;

const FIRST = ["Aarav", "Diya", "Vihaan", "Ananya", "Arjun", "Isha", "Kabir", "Meera", "Rohan", "Saanvi", "Aditya", "Tara", "Nikhil", "Riya", "Dev", "Kavya", "Yash", "Priya", "Aryan", "Neha", "Siddharth", "Pooja", "Rahul", "Sneha", "Harsh", "Anjali", "Varun", "Nisha"];
const LAST = ["Sharma", "Verma", "Iyer", "Patel", "Reddy", "Gupta", "Nair", "Singh", "Joshi", "Mehta", "Rao", "Das", "Kulkarni", "Bose"];

export interface StagingPerson {
  id: string;
  /** what they sign in with, e.g. sunrise.teacher1 */
  username: string;
  email: string;
  name: string;
  role: "institute_admin" | "teacher" | "student";
}

export function stagingPeople(inst: string): StagingPerson[] {
  const seed = [...inst].reduce((a, c) => a + c.charCodeAt(0), 0);
  const name = (i: number) => `${FIRST[(seed + i * 7) % FIRST.length]} ${LAST[(seed + i * 3) % LAST.length]}`;
  const person = (role: StagingPerson["role"], slug: string, i: number): StagingPerson => ({
    id: stagingId(`user:${inst}:${slug}`),
    username: `${inst}.${slug}`,
    email: `${inst}.${slug}@${STAGING_EMAIL_DOMAIN}`,
    name: name(i),
    role,
  });
  return [
    person("institute_admin", "admin", 0),
    ...Array.from({ length: TEACHERS_PER_INSTITUTE }, (_, i) => person("teacher", `teacher${i + 1}`, i + 1)),
    ...Array.from({ length: STUDENTS_PER_INSTITUTE }, (_, i) => person("student", `student${i + 1}`, i + 10)),
  ];
}

export const instituteId = (key: string) => stagingId(`institute:${key}`);
export const patternId = (cs: string) => stagingId(`pattern:${cs}`);
const batchId = (inst: string, cs: string, letter: string) => stagingId(`batch:${inst}:${cs}:${letter}`);

function csSql(cs: CsKey): string {
  const [cls, ...rest] = cs.split(" ");
  return `(select cs.id from public.class_subjects cs join public.classes c on c.id = cs.class_id join public.subjects s on s.id = cs.subject_id where c.name = ${lit(cls!)} and s.name = ${lit(rest.join(" "))})`;
}

function readChapters(repoRoot: string, csv: string): { number: string; name: string }[] {
  const text = readFileSync(join(repoRoot, "docs", "taxonomy", csv), "utf8");
  const out: { number: string; name: string }[] = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    // strand,chapter_number,chapter_name — the name may be quoted and contain commas
    const m = /^([^,]*),([^,]*),(.*)$/.exec(line);
    if (!m) continue;
    const raw = m[3]!.trim();
    out.push({ number: m[2]!.trim(), name: raw.startsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : raw });
  }
  return out;
}

function taxonomySql(repoRoot: string): string[] {
  const out: string[] = [
    `insert into public.classes (name, sort_order) values ('10', 10), ('12', 12) on conflict (name) do nothing`,
    `insert into public.subjects (name, short_name, script) values
       ${STAGING_SUBJECTS.map((s) => `(${lit(s.subject)}, ${lit(s.short)}, 'latin')`).join(", ")}
     on conflict (name) do nothing`,
    `insert into public.class_subjects (class_id, subject_id, bank_status)
     select c.id, s.id, v.bank
     from (values ${STAGING_SUBJECTS.map((s) => `(${lit(s.cls)}, ${lit(s.subject)}, ${lit(s.bank)})`).join(", ")}) v(cls, subject, bank)
     join public.classes c on c.name = v.cls
     join public.subjects s on s.name = v.subject
     on conflict (class_id, subject_id) do update set bank_status = excluded.bank_status`,
  ];
  for (const s of STAGING_SUBJECTS) {
    const cs = `${s.cls} ${s.subject}` as CsKey;
    const chapters = readChapters(repoRoot, s.csv);
    out.push(`insert into public.chapters (class_subject_id, name, ncert_number, sort_order)
      select ${csSql(cs)}, v.name, v.num, v.ord
      from (values ${chapters.map((c, i) => `(${lit(c.name)}, ${lit(c.number)}, ${i})`).join(", ")}) v(name, num, ord)
      on conflict (class_subject_id, name) do nothing`);
  }
  out.push(`insert into public.topics (chapter_id, name, slug)
    select ch.id, 'Staging topic ' || k, 'staging-topic-' || k
    from public.chapters ch
    cross join generate_series(1, 3) k
    where ch.class_subject_id in (${STAGING_SUBJECTS.map((s) => csSql(`${s.cls} ${s.subject}` as CsKey)).join(", ")})
    on conflict (chapter_id, slug) do nothing`);
  return out;
}

function patternSql(): string[] {
  const out: string[] = [];
  for (const s of STAGING_SUBJECTS) {
    const cs = `${s.cls} ${s.subject}`;
    const pid = patternId(cs);
    out.push(`insert into public.paper_patterns (id, owner_institute_id, class_subject_id, name, total_marks, duration_min, origin, is_default)
      values ('${pid}', public.platform_institute_id(), ${csSql(cs as CsKey)}, 'Staging Unit Test (25 marks)', 25, 60, 'institute', false)
      on conflict (id) do nothing`);
    out.push(`insert into public.pattern_sections (id, pattern_id, owner_institute_id, label, sort_order, instructions, question_count, marks_each, question_types, practice_eligible)
      values
        ('${stagingId(`pattern:${cs}:A`)}', '${pid}', public.platform_institute_id(), 'A', 0, 'Objective (1 mark each).', 10, 1, '{mcq,assertion_reason,vsa}', true),
        ('${stagingId(`pattern:${cs}:B`)}', '${pid}', public.platform_institute_id(), 'B', 1, 'Short answer (2 marks each).', 5, 2, '{vsa,sa}', true),
        ('${stagingId(`pattern:${cs}:C`)}', '${pid}', public.platform_institute_id(), 'C', 2, 'Long answer (5 marks).', 1, 5, '{la}', true)
      -- types are corrected on existing rows: sections now select by type as well as marks
      on conflict (id) do update set question_types = excluded.question_types
      where pattern_sections.question_types is distinct from excluded.question_types`);
  }
  return out;
}

/** type, marks, body, options by the item number g within a topic. */
const questionColumns = (g: string, owner: string, bodyPrefix: string, source: string) => `
  ${owner},
  ch.class_subject_id, ch.id, t.id,
  case
    when (${g} - 1) % 10 < 5 and s.name = 'Science' and ${g} % 4 = 0
      then format('%s Balance $\\ce{H2 + O2 -> H2O}$. What is the coefficient of $\\ce{H2O}$? (item %s)', ${bodyPrefix}, ${g})
    when (${g} - 1) % 10 < 5 and s.name = 'Mathematics'
      then format('%s If $x = %s$, what is $x^2 + %s$? (item %s)', ${bodyPrefix}, ${g} % 7 + 2, ${g}, ${g})
    when (${g} - 1) % 10 < 5
      then format('%s Which statement about %s is correct? (item %s)', ${bodyPrefix}, lower(t.name), ${g})
    when (${g} - 1) % 10 < 8
      then format('%s Explain briefly, with one example, the idea tested in item %s.', ${bodyPrefix}, ${g})
    else format('%s Describe in detail, with worked steps, item %s. The ratio $\\frac{a}{b}$ appears in the working.', ${bodyPrefix}, ${g})
  end,
  case when (${g} - 1) % 10 < 3 then 'mcq' when (${g} - 1) % 10 < 5 then 'vsa' when (${g} - 1) % 10 < 8 then 'sa' else 'la' end,
  case when (${g} - 1) % 10 < 3 then jsonb_build_array(
    jsonb_build_object('key', 'A', 'text', 'First option for item ' || ${g}),
    jsonb_build_object('key', 'B', 'text', 'Second option for item ' || ${g}),
    jsonb_build_object('key', 'C', 'text', 'Third option for item ' || ${g}),
    jsonb_build_object('key', 'D', 'text', 'Fourth option for item ' || ${g})) end,
  case when (${g} - 1) % 10 < 3 then (array['A', 'B', 'C', 'D'])[1 + ${g} % 4] end,
  'Staging model answer for item ' || ${g},
  'Staging worked solution for item ' || ${g},
  case when (${g} - 1) % 10 < 5 then 1 when (${g} - 1) % 10 < 8 then 2 else 5 end,
  (array['easy', 'medium', 'hard'])[1 + (${g} + ch.sort_order) % 3],
  ${lit(source)},
  (${g} - 1) % 10 < 3`;

const QUESTION_INSERT_COLUMNS = `(id, owner_institute_id, class_subject_id, chapter_id, topic_id, body, question_type, options, correct_option, answer, solution, marks, difficulty, source, options_shufflable)`;

const SUBJECT_JOINS = `
  from public.topics t
  join public.chapters ch on ch.id = t.chapter_id
  join public.class_subjects cs on cs.id = ch.class_subject_id
  join public.classes c on c.id = cs.class_id
  join public.subjects s on s.id = cs.subject_id`;

interface MathsRow {
  chapter: number;
  topic: number;
  g: number;
  salt: number;
}

/**
 * Class 10 Mathematics questions from scripts/staging/maths.ts (real content,
 * computed answers), inserted by chapter number and staging topic.
 */
function mathsInsertSql(opts: { owner: string; source: string; idExpr: string; rows: MathsRow[] }): string {
  const values = opts.rows.map((r) => {
    const q = mathsQuestion(r.chapter, r.topic, r.g, r.salt);
    return `(${r.chapter}::int, ${r.topic}::int, ${r.g}::int, ${lit(q.body)}::text, ${lit(q.type)}::text, ${
      q.options ? `${lit(JSON.stringify(q.options))}::jsonb` : "null::jsonb"
    }, ${q.correct ? `${lit(q.correct)}::text` : "null::text"}, ${lit(q.answer)}::text, ${lit(q.solution)}::text, ${q.marks}::int, ${lit(q.difficulty)}::text)`;
  });
  return `insert into public.questions ${QUESTION_INSERT_COLUMNS}
    select ${opts.idExpr}, ${opts.owner}, ch.class_subject_id, ch.id, t.id,
           v.body, v.qtype, v.options, v.correct, v.answer, v.solution, v.marks, v.difficulty,
           ${lit(opts.source)}, v.qtype = 'mcq'
    from (values
      ${values.join(",\n      ")}
    ) v(ord, k, g, body, qtype, options, correct, answer, solution, marks, difficulty)
    join public.chapters ch on ch.class_subject_id = ${csSql("10 Mathematics")} and ch.ncert_number = v.ord::text
    join public.topics t on t.chapter_id = ch.id and t.slug = 'staging-topic-' || v.k
    ${onConflictSql(["chapter_id", "topic_id", "body", "question_type", "options", "correct_option", "answer", "solution", "marks", "difficulty", "options_shufflable"])}`;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

function questionSql(): string[] {
  const out: string[] = [];
  for (const s of STAGING_SUBJECTS) {
    if (s.subject === "Mathematics") {
      const chapters = readChapters(REPO_ROOT_FOR_MATHS, s.csv).map((c) => Number(c.number));
      out.push(
        mathsInsertSql({
          owner: "public.platform_institute_id()",
          source: "Staging synthetic",
          idExpr: "md5('staging:q:' || t.id::text || ':' || v.g)::uuid",
          rows: chapters.flatMap((chapter) => [1, 2, 3].flatMap((topic) => range(1, s.perTopic).map((g) => ({ chapter, topic, g, salt: 0 })))),
        }),
      );
      continue;
    }
    out.push(`insert into public.questions ${QUESTION_INSERT_COLUMNS}
      select md5('staging:q:' || t.id::text || ':' || g)::uuid, ${questionColumns("g", "public.platform_institute_id()", "format('[Staging · %s · %s]', ch.name, t.name)", "Staging synthetic")}
      ${SUBJECT_JOINS}
      cross join generate_series(1, ${s.perTopic}) g
      where c.name = ${lit(s.cls)} and s.name = ${lit(s.subject)} and t.slug like 'staging-topic-%'
      on conflict (id) do nothing`);
  }

  // Each institute's own private Maths questions (chapters 1–2).
  STAGING_INSTITUTES.forEach((inst, i) => {
    out.push(
      mathsInsertSql({
        owner: `'${instituteId(inst.key)}'::uuid`,
        source: "Staging private synthetic",
        idExpr: `md5('staging:private:${inst.key}:' || ch.ncert_number || ':' || v.g)::uuid`,
        rows: [1, 2].flatMap((chapter) => range(1, 5).map((g) => ({ chapter, topic: 1, g, salt: 300 + i * 10 }))),
      }),
    );
  });

  // Approve the synthetic bank. Only rows still in staging: anything a tester
  // has since rejected or retired stays as they left it.
  out.push(`update public.questions set status = 'approved'
    where source in ('Staging synthetic', 'Staging private synthetic') and status = 'staging'`);

  // The review queue: staged on purpose, never approved by the seed.
  out.push(
    mathsInsertSql({
      owner: "public.platform_institute_id()",
      source: "Staging review sample",
      idExpr: "md5('staging:review:' || v.g)::uuid",
      rows: range(1, 12).map((g) => ({ chapter: 1, topic: 2, g, salt: 500 })),
    }),
  );
  out.push(`update public.questions set note = 'Unsure: option C may also be correct depending on the textbook edition.'
    where source = 'Staging review sample' and note is null and owner_institute_id = public.platform_institute_id()
      and id in (select md5('staging:review:' || g)::uuid from generate_series(3, 12, 3) g)`);
  STAGING_INSTITUTES.forEach((inst, i) => {
    out.push(
      mathsInsertSql({
        owner: `'${instituteId(inst.key)}'::uuid`,
        source: "Staging review sample",
        idExpr: `md5('staging:review:${inst.key}:' || v.g)::uuid`,
        rows: range(1, 3).map((g) => ({ chapter: 2, topic: 3, g, salt: 700 + i * 10 })),
      }),
    );
  });
  return out;
}

function institutesSql(): string[] {
  const out: string[] = [];
  for (const inst of STAGING_INSTITUTES) {
    const iid = instituteId(inst.key);
    const people = stagingPeople(inst.key);
    const admin = people.find((p) => p.role === "institute_admin")!;
    const teachers = people.filter((p) => p.role === "teacher");
    const students = people.filter((p) => p.role === "student");

    out.push(`insert into public.institutes (id, name, slug, kind, status, contact_email)
      values ('${iid}', ${lit(inst.name)}, '${STAGING_SLUG_PREFIX}${inst.key}', 'institute', 'active', '${admin.email}')
      on conflict (id) do nothing`);
    // Shaped like a real sign-up, or Supabase's auth server cannot read the
    // row ("Database error querying schema"): token columns '' rather than
    // NULL, created_at/updated_at set, provider 'email' and an 'email'
    // identity. The update repairs rows an older seed inserted.
    out.push(`insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change, created_at, updated_at)
      values ${people.map((p) => `('${p.id}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', '${p.email}', now(), jsonb_build_object('full_name', ${lit(p.name)}, 'username', '${p.username}'), '{"provider":"email","providers":["email"]}'::jsonb, '', '', '', '', now(), now())`).join(",\n        ")}
      on conflict (id) do nothing`);
    const ids = people.map((p) => `'${p.id}'`).join(", ");
    out.push(`update auth.users set created_at = coalesce(created_at, now()), updated_at = coalesce(updated_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb
      where id in (${ids}) and (created_at is null or updated_at is null or raw_app_meta_data->>'provider' = 'staging')`);
    out.push(`insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
      select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', false, 'phone_verified', false), 'email', now(), now()
      from auth.users u where u.id in (${ids})
      on conflict (provider_id, provider) do nothing`);
    out.push(`insert into public.institute_members (institute_id, user_id, role)
      values ${people.map((p) => `('${iid}', '${p.id}', '${p.role}')`).join(", ")}
      on conflict (institute_id, user_id) do nothing`);

    for (const cs of inst.active) {
      out.push(`insert into public.institute_class_subjects (institute_id, class_subject_id, status, activated_at)
        values ('${iid}', ${csSql(cs)}, 'active', now() - interval '30 days')
        on conflict (institute_id, class_subject_id) do nothing`);
    }
    if (inst.request) {
      const r = inst.request;
      out.push(`insert into public.activation_requests (id, institute_id, class_subject_id, requested_by, status, reason, created_at, decided_at)
        values ('${stagingId(`request:${inst.key}`)}', '${iid}', ${csSql(r.cs)}, '${admin.id}', '${r.status}', ${r.reason ? lit(r.reason) : "null"},
                now() - interval '6 days', ${r.status === "pending" ? "null" : "now() - interval '2 days'"})
        on conflict do nothing`);
    }

    // Who teaches what: teachers 1-2 the first subject, teacher 3 the last,
    // the admin everything active.
    const assignments: [string, CsKey][] = [
      [teachers[0]!.id, inst.active[0]!],
      [teachers[1]!.id, inst.active[0]!],
      [teachers[2]!.id, inst.active[inst.active.length - 1]!],
      ...inst.active.map((cs): [string, CsKey] => [admin.id, cs]),
    ];
    out.push(`insert into public.teacher_subjects (institute_id, teacher_id, class_subject_id)
      values ${assignments.map(([t, cs]) => `('${iid}', '${t}', ${csSql(cs)})`).join(", ")}
      on conflict do nothing`);

    // Two batches per active subject; join codes come from the trigger.
    for (const cs of inst.active) {
      const teacher = cs === inst.active[0] ? teachers[0]! : teachers[2]!;
      const label = cs.replace(/^(\d+) /, "$1-");
      out.push(`insert into public.batches (id, institute_id, name, class_subject_id, teacher_id, join_code, active)
        values ('${batchId(inst.key, cs, "A")}', '${iid}', ${lit(`${label} A`)}, ${csSql(cs)}, '${teacher.id}', '', true),
               ('${batchId(inst.key, cs, "B")}', '${iid}', ${lit(`${label} B`)}, ${csSql(cs)}, '${teacher.id}', '', true)
        on conflict (id) do nothing`);
    }
    // Students: with two active subjects, the first 16 take the first and the
    // rest the second; otherwise everyone takes the one. Alternate A / B.
    const enrol = students.map((st, i) => {
      const cs = inst.active.length > 1 && i >= 16 ? inst.active[1]! : inst.active[0]!;
      return `('${iid}', '${batchId(inst.key, cs, i % 2 === 0 ? "A" : "B")}', '${st.id}', ${csSql(cs)})`;
    });
    out.push(`insert into public.enrolments (institute_id, batch_id, student_id, class_subject_id)
      values ${enrol.join(",\n        ")}
      on conflict do nothing`);

    out.push(`insert into public.institute_invites (institute_id, email, role, invited_by)
      values ('${iid}', '${inst.key}.newteacher@${STAGING_EMAIL_DOMAIN}', 'teacher', '${admin.id}'),
             ('${iid}', '${inst.key}.newstudent@${STAGING_EMAIL_DOMAIN}', 'student', '${admin.id}')
      on conflict (institute_id, email) do nothing`);
  }
  return out;
}

interface PaperSpec {
  key: string;
  inst: string;
  cs: CsKey;
  teacher: string;
  batch: string;
  title: string;
  chapters: [number, number];
  daysAgo: number;
  seed: number;
}

export function stagingPapers(): PaperSpec[] {
  return STAGING_INSTITUTES.flatMap((inst) => {
    const teachers = stagingPeople(inst.key).filter((p) => p.role === "teacher");
    const first = inst.active[0]!;
    return [
      { key: `${inst.key}:ut1`, inst: inst.key, cs: first, teacher: teachers[0]!.id, batch: batchId(inst.key, first, "A"), title: "Staging Unit Test 1", chapters: [1, 3] as [number, number], daysAgo: 14, seed: 101 },
      { key: `${inst.key}:ut2`, inst: inst.key, cs: first, teacher: teachers[0]!.id, batch: batchId(inst.key, first, "A"), title: "Staging Unit Test 2", chapters: [4, 6] as [number, number], daysAgo: 5, seed: 202 },
    ];
  });
}

function paperSql(p: PaperSpec): string {
  const iid = instituteId(p.inst);
  const pid = stagingId(`paper:${p.key}`);
  return `do $staging$
declare
  v_inst uuid := '${iid}';
  v_paper uuid := '${pid}';
  v_cs uuid := ${csSql(p.cs)};
  v_pattern uuid := '${patternId(p.cs)}';
  v_pos int := 0;
  v_sec uuid;
  v_block uuid;
  sec record;
  q record;
begin
  if exists (select 1 from public.papers where id = v_paper) then
    return;
  end if;

  insert into public.papers (id, institute_id, teacher_id, batch_id, class_subject_id, pattern_id, title, total_marks, duration_min, status, seed, generated_at, created_at)
  values (v_paper, v_inst, '${p.teacher}', '${p.batch}', v_cs, v_pattern, ${lit(p.title)}, 25, 60, 'generated', ${p.seed},
          now() - interval '${p.daysAgo} days', now() - interval '${p.daysAgo} days');

  for sec in
    select ps.id, ps.label, ps.sort_order, ps.question_count, ps.marks_each, ps.question_types
    from public.pattern_sections ps where ps.pattern_id = v_pattern order by ps.sort_order
  loop
    v_sec := md5('staging:paper:${p.key}:section:' || sec.label)::uuid;
    insert into public.paper_sections (id, institute_id, paper_id, pattern_section_id, label, sort_order)
    values (v_sec, v_inst, v_paper, sec.id, sec.label, sec.sort_order);

    for q in
      select qq.id from public.questions qq
      join public.chapters ch on ch.id = qq.chapter_id
      where qq.class_subject_id = v_cs and qq.status = 'approved' and qq.source = 'Staging synthetic'
        and qq.question_type = any (sec.question_types) and qq.marks = sec.marks_each
        and ch.ncert_number::int between ${p.chapters[0]} and ${p.chapters[1]}
      order by md5(qq.id::text || '${p.key}')
      limit sec.question_count
    loop
      v_pos := v_pos + 1;
      v_block := md5('staging:paper:${p.key}:block:' || v_pos)::uuid;
      insert into public.paper_blocks (id, institute_id, paper_id, section_id, canonical_position)
      values (v_block, v_inst, v_paper, v_sec, v_pos);
      insert into public.paper_questions (institute_id, paper_id, block_id, question_id, marks)
      values (v_inst, v_paper, v_block, q.id, sec.marks_each);
    end loop;
  end loop;

  insert into public.paper_sets (id, institute_id, paper_id, set_label, copies_to_print)
  values ('${stagingId(`paper:${p.key}:set:A`)}', v_inst, v_paper, 'A', 12),
         ('${stagingId(`paper:${p.key}:set:B`)}', v_inst, v_paper, 'B', 12);

  insert into public.paper_set_items (institute_id, paper_set_id, paper_block_id, display_position)
  select v_inst, '${stagingId(`paper:${p.key}:set:A`)}', b.id, b.canonical_position - 1
  from public.paper_blocks b where b.paper_id = v_paper;

  -- Set B reverses the order within each section, so every position keeps its marks.
  insert into public.paper_set_items (institute_id, paper_set_id, paper_block_id, display_position)
  select v_inst, '${stagingId(`paper:${p.key}:set:B`)}', b.id,
         (min(b.canonical_position) over w) + (max(b.canonical_position) over w) - b.canonical_position - 1
  from public.paper_blocks b where b.paper_id = v_paper
  window w as (partition by b.section_id);
end
$staging$`;
}

function activitySql(): string[] {
  const staging = `(select id from public.institutes where slug like '${STAGING_SLUG_PREFIX}%')`;
  const out: string[] = stagingPapers().map(paperSql);

  // About three in four students log each paper, split across the two sets.
  out.push(`insert into public.attempts (id, institute_id, paper_id, student_id, paper_set_id, logged_at, source)
    select md5('staging:attempt:' || p.id::text || ':' || e.student_id::text)::uuid,
           p.institute_id, p.id, e.student_id,
           (select s.id from public.paper_sets s
            where s.paper_id = p.id and s.institute_id = p.institute_id
              and s.set_label = case when abs(hashtext(e.student_id::text || p.id::text)) % 2 = 0 then 'A' else 'B' end),
           p.generated_at + interval '2 days', 'student'
    from public.papers p
    join public.enrolments e on e.batch_id = p.batch_id and e.institute_id = p.institute_id
    where p.institute_id in ${staging}
      and abs(hashtext(e.student_id::text || p.id::text || ':logged')) % 4 <> 0
    on conflict do nothing`);
  out.push(`insert into public.attempt_items (institute_id, attempt_id, question_id, is_correct, display_position)
    select a.institute_id, a.id, pq.question_id,
           abs(hashtext(a.id::text || ':' || psi.display_position)) % 10 >= 3,
           psi.display_position
    from public.attempts a
    join public.paper_set_items psi on psi.paper_set_id = a.paper_set_id and psi.institute_id = a.institute_id
    join public.paper_questions pq on pq.block_id = psi.paper_block_id and pq.institute_id = a.institute_id
    where a.institute_id in ${staging}
      and not exists (select 1 from public.attempt_items ai where ai.attempt_id = a.id)`);
  out.push(`insert into public.question_exposure (institute_id, student_id, question_id, context)
    select a.institute_id, a.student_id, pq.question_id, 'paper'
    from public.attempts a
    join public.paper_questions pq on pq.paper_id = a.paper_id and pq.institute_id = a.institute_id
    where a.institute_id in ${staging}
    on conflict do nothing`);

  for (const inst of STAGING_INSTITUTES) {
    const teacher = stagingPeople(inst.key).find((p) => p.role === "teacher")!;
    out.push(`insert into public.question_flags (id, institute_id, question_id, raised_by, reason, created_at)
      select md5('staging:flag:${inst.key}:' || x.n)::uuid, '${instituteId(inst.key)}', x.qid, '${teacher.id}', x.reason, now() - interval '3 days'
      from (
        select row_number() over (order by md5(q.id::text || '${inst.key}')) as n, q.id as qid,
               case when row_number() over (order by md5(q.id::text || '${inst.key}')) = 1
                    then 'The marked answer looks wrong to me.' else 'The wording is ambiguous for Class 10.' end as reason
        from public.questions q
        where q.source = 'Staging synthetic' and q.status = 'approved' and q.class_subject_id = ${csSql(inst.active[0]!)}
        order by md5(q.id::text || '${inst.key}')
        limit 2
      ) x
      on conflict (id) do nothing`);
  }
  return out;
}

/** Give every staging person the same password (bcrypt, as Supabase stores it). */
function passwordSql(password: string | undefined): string[] {
  if (!password) return [];
  if (password.length < 8) throw new Error("STAGING_PASSWORD must be at least 8 characters");
  const ids = STAGING_INSTITUTES.flatMap((i) => stagingPeople(i.key).map((p) => `'${p.id}'`));
  return [
    `update auth.users set encrypted_password = crypt(${lit(password)}, gen_salt('bf'))
      where id in (${ids.join(", ")})`,
  ];
}

function testerSql(testers: StagingTester[], platformOwner?: string): string[] {
  const out: string[] = [];
  for (const t of testers) {
    const inst = STAGING_INSTITUTES.find((i) => i.key === t.institute);
    if (!inst) throw new Error(`unknown staging institute "${t.institute}" (use ${STAGING_INSTITUTES.map((i) => i.key).join(", ")})`);
    out.push(`insert into public.institute_invites (institute_id, email, role)
      values ('${instituteId(inst.key)}', ${lit(loginToEmail(t.login ?? t.email ?? ""))}, '${t.role}')
      on conflict (institute_id, email) do update set role = excluded.role`);
  }
  if (platformOwner) {
    out.push(`insert into public.institute_members (institute_id, user_id, role)
      select public.platform_institute_id(), p.id, 'owner' from public.profiles p where p.email = ${lit(loginToEmail(platformOwner))}
      on conflict (institute_id, user_id) do nothing`);
  }
  return out;
}

export interface StagingTester {
  /** a username or an email */
  login?: string;
  /** older name for `login` */
  email?: string;
  role: "institute_admin" | "teacher" | "student";
  institute: string;
}

export interface StagingOptions {
  repoRoot: string;
  testers?: StagingTester[];
  /** Username or email of an EXISTING account to make platform owner. */
  platformOwner?: string;
  /** Sign-in password for every staging person; omit to leave them unable to sign in. */
  password?: string;
  /** Rewrite existing synthetic questions to the current content (see onConflictSql). */
  refreshContent?: boolean;
}

export function stagingStatements(opts: StagingOptions): string[] {
  REPO_ROOT_FOR_MATHS = opts.repoRoot;
  REFRESH_CONTENT = opts.refreshContent ?? false;
  return [
    ...taxonomySql(opts.repoRoot),
    ...patternSql(),
    // institutes before questions: private questions reference their owner
    ...institutesSql(),
    ...questionSql(),
    ...lifeProcessesSql({
      lit,
      csSql,
      onConflictSql,
      stagingId,
      instituteId,
      batchId,
      sunriseTeacherId: stagingPeople("sunrise").find((p) => p.username === "sunrise.teacher2")!.id,
      sunriseAdminId: stagingPeople("sunrise").find((p) => p.role === "institute_admin")!.id,
    }),
    ...activitySql(),
    ...passwordSql(opts.password),
    ...testerSql(opts.testers ?? [], opts.platformOwner),
  ];
}

/**
 * The guard the runner applies before touching a database: staging means no
 * institute that is not a staging institute. A production database always has
 * one, so a mistyped connection string is refused rather than seeded.
 */
export function assertStagingTarget(nonStagingInstitutes: number): void {
  if (nonStagingInstitutes > 0) {
    throw new Error(
      `refusing to seed: this database has ${nonStagingInstitutes} institute(s) whose slug does not start with "${STAGING_SLUG_PREFIX}". ` +
        "It looks like a real environment. The staging seed only runs against a staging project.",
    );
  }
}
