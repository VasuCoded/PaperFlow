/**
 * SQL for Class 10 Science · Life Processes as a real chapter
 * (scripts/staging/life-processes.ts): named topics, ~170 original
 * CBSE-style questions with answers, solutions and marking points, and case
 * studies with passages — enough to generate the full 80-mark board paper
 * from this chapter alone. The generic filler in this chapter is retired so it
 * never reaches a paper. Sunrise gets Science switched on, taught by teacher 2.
 *
 * Idempotent like the rest of the staging seed: stable ids, inserts skip rows
 * that exist, updates only touch rows still in the state the seed left them.
 */
import { LP_CASES, LP_CHAPTER_NUMBER, LP_QUESTIONS, LP_SOURCE, LP_TOPICS } from "./life-processes";

export interface LpSqlHelpers {
  lit: (s: string) => string;
  onConflictSql: (columns: string[]) => string;
  csSql: (cs: "10 Science") => string;
  stagingId: (key: string) => string;
  instituteId: (key: string) => string;
  batchId: (inst: string, cs: string, letter: string) => string;
  sunriseTeacherId: string;
  sunriseAdminId: string;
}

export const LP_PATTERN_NAME = "CBSE-style Chapter Test (40 marks)";

export function lifeProcessesSql(h: LpSqlHelpers): string[] {
  const { lit, csSql, stagingId } = h;
  const out: string[] = [];
  const science = csSql("10 Science");
  const chapter = `(select ch.id from public.chapters ch where ch.class_subject_id = ${science} and ch.ncert_number = '${LP_CHAPTER_NUMBER}')`;
  const opt = (o: { key: string; text: string }[] | null) => (o ? `${lit(JSON.stringify(o))}::jsonb` : "null::jsonb");
  const txt = (v: string | null) => (v == null ? "null::text" : `${lit(v)}::text`);
  const qid = (body: string) => stagingId(`lp:q:${body}`);
  const sid = (key: string) => stagingId(`lp:stim:${key}`);
  const pid = (key: string, label: string) => stagingId(`lp:case:${key}:${label}`);

  out.push(`insert into public.topics (chapter_id, name, slug)
    select ${chapter}, v.name, v.slug
    from (values ${LP_TOPICS.map((t) => `(${lit(t.name)}, ${lit(t.slug)})`).join(", ")}) v(name, slug)
    on conflict (chapter_id, slug) do nothing`);

  out.push(`insert into public.stimuli (id, owner_institute_id, class_subject_id, kind, body, source, status)
    values ${LP_CASES.map((c) => `('${sid(c.key)}', public.platform_institute_id(), ${science}, 'case_study', ${lit(c.passage)}, ${lit(LP_SOURCE)}, 'approved')`).join(",\n      ")}
    on conflict (id) do nothing`);

  const rows = [
    ...LP_QUESTIONS.map(
      (q) =>
        `('${qid(q.body)}'::uuid, ${lit(q.topic)}, null::uuid, null::text, ${lit(q.body)}, ${lit(q.type)}, ${opt(q.options)}, ${txt(q.correct)}, ${lit(q.answer)}, ${lit(q.solution)}, ${txt(q.rubric)}, ${q.marks}, ${lit(q.difficulty)}, ${q.shufflable})`,
    ),
    ...LP_CASES.flatMap((c) =>
      c.parts.map(
        (part) =>
          `('${pid(c.key, part.label)}'::uuid, ${lit(c.topic)}, '${sid(c.key)}'::uuid, ${lit(part.label)}, ${lit(part.body)}, 'case_study', null::jsonb, null::text, ${lit(part.answer)}, ${lit(part.solution)}, null::text, ${part.marks}, ${lit(c.difficulty)}, false)`,
      ),
    ),
  ];
  out.push(`insert into public.questions (id, owner_institute_id, class_subject_id, chapter_id, topic_id, stimulus_id, part_label, body, question_type,
      options, correct_option, answer, solution, rubric, marks, difficulty, source, options_shufflable)
    select v.id, public.platform_institute_id(), ch.class_subject_id, ch.id, t.id, v.stim, v.part, v.body, v.qtype,
           v.options, v.correct, v.answer, v.solution, v.rubric, v.marks, v.difficulty, ${lit(LP_SOURCE)}, v.shufflable
    from (values
      ${rows.join(",\n      ")}
    ) v(id, topic, stim, part, body, qtype, options, correct, answer, solution, rubric, marks, difficulty, shufflable)
    join public.chapters ch on ch.id = ${chapter}
    join public.topics t on t.chapter_id = ch.id and t.slug = v.topic
    ${h.onConflictSql(["chapter_id", "topic_id", "stimulus_id", "part_label", "body", "question_type", "options", "correct_option", "answer", "solution", "rubric", "marks", "difficulty", "options_shufflable"])}`);
  out.push(`update public.questions set status = 'approved' where source = ${lit(LP_SOURCE)} and status = 'staging'`);

  // The generic placeholders this chapter got from the rest of the seed would
  // otherwise sit in the same papers as the real questions. Retired, not deleted.
  out.push(`update public.questions set status = 'retired'
    where source = 'Staging synthetic' and status = 'approved' and chapter_id = ${chapter}`);

  // A chapter-sized CBSE-style pattern. (The full 80-mark board pattern also works.)
  const patternId = stagingId("pattern:10 Science:life-processes-chapter-test");
  out.push(`insert into public.paper_patterns (id, owner_institute_id, class_subject_id, name, total_marks, duration_min, origin, is_default)
    values ('${patternId}', public.platform_institute_id(), ${science}, ${lit(LP_PATTERN_NAME)}, 40, 90, 'institute', false)
    on conflict (id) do nothing`);
  const sections: [string, string, number, number, string, boolean, boolean][] = [
    ["A", "Multiple choice and assertion–reason (1 mark each).", 10, 1, "{mcq,assertion_reason}", false, false],
    ["B", "Very short answer (2 marks each).", 4, 2, "{vsa}", false, false],
    ["C", "Short answer (3 marks each).", 3, 3, "{sa}", false, false],
    ["D", "Long answer (5 marks). Internal choice.", 1, 5, "{la}", true, false],
    ["E", "Case-based (4 marks each).", 2, 4, "{case_study}", false, true],
  ];
  out.push(`insert into public.pattern_sections (id, pattern_id, owner_institute_id, label, sort_order, instructions, question_count, marks_each, question_types, allow_choice, practice_eligible, requires_stimulus)
    values
      ${sections
        .map(([label, instr, n, m, types, choice, stim], i) =>
          `('${stagingId(`pattern:10 Science:life-processes-chapter-test:${label}`)}', '${patternId}', public.platform_institute_id(), '${label}', ${i}, ${lit(instr)}, ${n}, ${m}, '${types}', ${choice}, true, ${stim})`,
        )
        .join(",\n      ")}
    on conflict (id) do nothing`);

  // Sunrise: Science switched on, taught by teacher 2 (and the admin), with a batch.
  const sunrise = h.instituteId("sunrise");
  out.push(`insert into public.institute_class_subjects (institute_id, class_subject_id, status, activated_at)
    values ('${sunrise}', ${science}, 'active', now() - interval '3 days')
    on conflict (institute_id, class_subject_id) do nothing`);
  out.push(`insert into public.teacher_subjects (institute_id, teacher_id, class_subject_id)
    values ('${sunrise}', '${h.sunriseTeacherId}', ${science}), ('${sunrise}', '${h.sunriseAdminId}', ${science})
    on conflict do nothing`);
  out.push(`insert into public.batches (id, institute_id, name, class_subject_id, teacher_id, join_code, active)
    values ('${h.batchId("sunrise", "10 Science", "A")}', '${sunrise}', '10-Science A', ${science}, '${h.sunriseTeacherId}', '', true)
    on conflict (id) do nothing`);
  return out;
}
