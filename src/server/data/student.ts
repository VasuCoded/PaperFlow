import "server-only";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { Session } from "@/server/session";
import { consecutiveWrongStreak, topicAccuracy, type TopicResult } from "@/server/practice";

export const SUBJECT_COOKIE = "pf_subject";

export interface StudentSubject {
  classSubjectId: string;
  label: string;
  short: string;
  className: string;
  script: string;
  batchName: string;
}

type EnrolmentRow = {
  class_subject_id: string;
  batches: { name: string } | null;
  class_subjects: { classes: { name: string } | null; subjects: { name: string; short_name: string | null; script: string } | null } | null;
};

/** The class-subjects this student is enrolled in, at the current institute. */
export async function getStudentSubjects(session: Session): Promise<StudentSubject[]> {
  if (!session.instituteId) return [];
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("enrolments")
    .select("class_subject_id, batches ( name ), class_subjects ( classes ( name ), subjects ( name, short_name, script ) )")
    .eq("institute_id", session.instituteId)
    .eq("student_id", session.userId)
    .returns<EnrolmentRow[]>();

  return (data ?? []).map((e) => ({
    classSubjectId: e.class_subject_id,
    label: `Class ${e.class_subjects?.classes?.name ?? "?"} · ${e.class_subjects?.subjects?.name ?? "?"}`,
    short: e.class_subjects?.subjects?.short_name ?? e.class_subjects?.subjects?.name?.slice(0, 3).toUpperCase() ?? "?",
    className: e.class_subjects?.classes?.name ?? "",
    script: e.class_subjects?.subjects?.script ?? "latin",
    batchName: e.batches?.name ?? "",
  }));
}

export interface StudentPaper {
  id: string;
  title: string;
  classSubjectId: string;
  createdAt: string;
  totalMarks: number;
  setCount: number;
  logged: boolean;
  wrong: number;
}

/**
 * Papers for the student's batches. can_access_paper() in RLS already limits
 * these to class-subjects they are enrolled in, at this institute.
 */
export async function getStudentPapers(session: Session): Promise<StudentPaper[]> {
  if (!session.instituteId) return [];
  const supabase = await createServerSupabaseClient();

  const [{ data: papers }, { data: attempts }] = await Promise.all([
    supabase
      .from("papers")
      .select("id, title, class_subject_id, created_at, total_marks, paper_sets ( count )")
      .eq("institute_id", session.instituteId)
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(120)
      .returns<{ id: string; title: string; class_subject_id: string; created_at: string; total_marks: number | null; paper_sets: { count: number }[] }[]>(),
    supabase
      .from("attempts")
      .select("paper_id, attempt_items ( is_correct )")
      .eq("institute_id", session.instituteId)
      .eq("student_id", session.userId)
      .returns<{ paper_id: string; attempt_items: { is_correct: boolean }[] }[]>(),
  ]);

  const byPaper = new Map((attempts ?? []).map((a) => [a.paper_id, a]));
  return (papers ?? []).map((p) => {
    const a = byPaper.get(p.id);
    return {
      id: p.id,
      title: p.title,
      classSubjectId: p.class_subject_id,
      createdAt: p.created_at,
      totalMarks: p.total_marks ?? 0,
      setCount: p.paper_sets[0]?.count ?? 0,
      logged: !!a,
      wrong: a ? a.attempt_items.filter((i) => !i.is_correct).length : 0,
    };
  });
}

/**
 * The subject context. Persisted in a cookie so it survives navigation, but only
 * ever as a choice among the student's own enrolments. Defaults to the subject
 * with the most recent unlogged paper — the habit the app is trying to build.
 */
export async function resolveSubject(subjects: StudentSubject[], papers: StudentPaper[]): Promise<string | null> {
  if (subjects.length === 0) return null;
  const jar = await cookies();
  const chosen = jar.get(SUBJECT_COOKIE)?.value;
  if (chosen && subjects.some((s) => s.classSubjectId === chosen)) return chosen;
  const enrolled = new Set(subjects.map((s) => s.classSubjectId));
  const unlogged = papers.find((p) => !p.logged && enrolled.has(p.classSubjectId));
  return unlogged?.classSubjectId ?? subjects[0]!.classSubjectId;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export interface LogQuestion {
  body: string;
  partLabel: string | null;
  topic: string | null;
  difficulty: string;
}
export interface LogPosition {
  position: number;
  number: number;
  marks: number;
  sectionLabel: string;
  practiceEligible: boolean;
  stimulus: string | null;
  questions: LogQuestion[];
}
export interface LogSet {
  id: string;
  label: string;
  positions: LogPosition[];
}
export interface PaperForLogging {
  id: string;
  title: string;
  classSubjectId: string;
  totalMarks: number;
  createdAt: string;
  sets: LogSet[];
  existing: { setId: string | null; wrongPositions: number[] } | null;
}

export async function getPaperForLogging(session: Session, paperId: string): Promise<PaperForLogging | null> {
  if (!session.instituteId || !/^[0-9a-f-]{36}$/i.test(paperId)) return null;
  const inst = session.instituteId;
  const supabase = await createServerSupabaseClient();

  const { data: paper } = await supabase
    .from("papers")
    .select("id, title, class_subject_id, total_marks, created_at")
    .eq("id", paperId)
    .eq("institute_id", inst)
    .maybeSingle();
  if (!paper) return null;

  const [setsRes, sectionsRes, blocksRes, pqRes, attemptRes] = await Promise.all([
    supabase.from("paper_sets").select("id, set_label").eq("paper_id", paperId).eq("institute_id", inst).order("set_label"),
    supabase
      .from("paper_sections")
      .select("id, label, sort_order, pattern_sections ( practice_eligible )")
      .eq("paper_id", paperId)
      .eq("institute_id", inst)
      .returns<{ id: string; label: string; sort_order: number; pattern_sections: { practice_eligible: boolean } | null }[]>(),
    supabase.from("paper_blocks").select("id, section_id, stimulus_id").eq("paper_id", paperId).eq("institute_id", inst),
    supabase
      .from("paper_questions")
      .select("block_id, question_id, within_block_order, marks, is_choice_alternative")
      .eq("paper_id", paperId)
      .eq("institute_id", inst)
      .eq("is_choice_alternative", false),
    supabase
      .from("attempts")
      .select("paper_set_id, attempt_items ( display_position, is_correct )")
      .eq("paper_id", paperId)
      .eq("institute_id", inst)
      .eq("student_id", session.userId)
      .maybeSingle()
      .returns<{ paper_set_id: string | null; attempt_items: { display_position: number | null; is_correct: boolean }[] } | null>(),
  ]);

  const setRows = setsRes.data ?? [];
  const setIds = setRows.map((s) => s.id);
  const pqs = pqRes.data ?? [];
  const blocks = blocksRes.data ?? [];

  const questionIds = [...new Set(pqs.map((q) => q.question_id))];
  const stimulusIds = [...new Set(blocks.map((b) => b.stimulus_id).filter((x): x is string => !!x))];

  const [itemsRes, questionsRes, stimuliRes] = await Promise.all([
    setIds.length
      ? supabase.from("paper_set_items").select("paper_set_id, paper_block_id, display_position").in("paper_set_id", setIds).eq("institute_id", inst)
      : Promise.resolve({ data: [] as { paper_set_id: string; paper_block_id: string; display_position: number }[] }),
    questionIds.length
      ? supabase
          .from("questions")
          .select("id, body, part_label, difficulty, topics ( name )")
          .in("id", questionIds)
          .returns<{ id: string; body: string; part_label: string | null; difficulty: string; topics: { name: string } | null }[]>()
      : Promise.resolve({ data: [] as { id: string; body: string; part_label: string | null; difficulty: string; topics: { name: string } | null }[] }),
    stimulusIds.length
      ? supabase.from("stimuli").select("id, body").in("id", stimulusIds)
      : Promise.resolve({ data: [] as { id: string; body: string | null }[] }),
  ]);

  const sectionById = new Map((sectionsRes.data ?? []).map((s) => [s.id, s]));
  const blockById = new Map(blocks.map((b) => [b.id, b]));
  const questionById = new Map((questionsRes.data ?? []).map((q) => [q.id, q]));
  const stimulusById = new Map((stimuliRes.data ?? []).map((s) => [s.id, s.body]));

  const sets: LogSet[] = setRows.map((s) => {
    const items = (itemsRes.data ?? [])
      .filter((it) => it.paper_set_id === s.id)
      .sort((a, b) => a.display_position - b.display_position);
    return {
      id: s.id,
      label: s.set_label,
      positions: items.map((it, i) => {
        const block = blockById.get(it.paper_block_id);
        const section = block ? sectionById.get(block.section_id) : undefined;
        const inBlock = pqs
          .filter((q) => q.block_id === it.paper_block_id)
          .sort((a, b) => a.within_block_order - b.within_block_order);
        return {
          position: it.display_position,
          number: i + 1,
          marks: inBlock.reduce((m, q) => m + q.marks, 0),
          sectionLabel: section?.label ?? "",
          // no pattern link (older paper) => treat as eligible rather than hide data
          practiceEligible: section?.pattern_sections?.practice_eligible ?? true,
          stimulus: block?.stimulus_id ? (stimulusById.get(block.stimulus_id) ?? null) : null,
          questions: inBlock.map((q) => {
            const row = questionById.get(q.question_id);
            return {
              body: row?.body ?? "",
              partLabel: row?.part_label ?? null,
              topic: row?.topics?.name ?? null,
              difficulty: row?.difficulty ?? "medium",
            };
          }),
        };
      }),
    };
  });

  const attempt = attemptRes.data;
  const wrongPositions = attempt
    ? [...new Set(attempt.attempt_items.filter((i) => !i.is_correct && i.display_position !== null).map((i) => i.display_position as number))]
    : [];

  return {
    id: paper.id,
    title: paper.title,
    classSubjectId: paper.class_subject_id,
    totalMarks: paper.total_marks ?? 0,
    createdAt: paper.created_at,
    sets,
    existing: attempt ? { setId: attempt.paper_set_id, wrongPositions } : null,
  };
}

// ---------------------------------------------------------------------------
// Practice and weak spots
// ---------------------------------------------------------------------------

export interface PracticeItemView {
  id: string;
  questionId: string;
  body: string;
  topic: string | null;
  difficulty: string;
  done: boolean;
  options: string[] | null;
}
export interface PracticeView {
  id: string;
  builtAt: string;
  items: PracticeItemView[];
}

type PracticeRow = {
  id: string;
  built_at: string;
  practice_set_items: {
    id: string;
    question_id: string;
    position: number;
    is_done: boolean;
    questions: { body: string; difficulty: string; options: unknown; topics: { name: string } | null } | null;
  }[];
};

export async function getPracticeSets(session: Session, classSubjectId: string): Promise<PracticeView[]> {
  if (!session.instituteId) return [];
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("practice_sets")
    .select("id, built_at, practice_set_items ( id, question_id, position, is_done, questions ( body, difficulty, options, topics ( name ) ) )")
    .eq("institute_id", session.instituteId)
    .eq("student_id", session.userId)
    .eq("class_subject_id", classSubjectId)
    .eq("status", "active")
    .order("built_at", { ascending: false })
    .limit(5)
    .returns<PracticeRow[]>();

  const { parseOptions } = await import("@/lib/options");
  return (data ?? []).map((s) => ({
    id: s.id,
    builtAt: s.built_at,
    items: [...s.practice_set_items]
      .sort((a, b) => a.position - b.position)
      .map((it) => {
        const opts = parseOptions((it.questions?.options ?? null) as Parameters<typeof parseOptions>[0]);
        return {
          id: it.id,
          questionId: it.question_id,
          body: it.questions?.body ?? "",
          topic: it.questions?.topics?.name ?? null,
          difficulty: it.questions?.difficulty ?? "medium",
          done: it.is_done,
          options: opts.length > 1 ? opts.map((o) => `(${o.key}) ${o.text}`) : null,
        };
      }),
  }));
}

export interface WeakTopicView {
  topic: string;
  correct: number;
  total: number;
  streak: number;
}

/**
 * Per-topic accuracy over the student's logged papers in one subject, counting
 * only practice-eligible sections: a per-topic score on "writing" or a map
 * would not mean anything (BUILD-PLAN 2.4).
 */
export async function getWeakSpots(session: Session, classSubjectId: string): Promise<{ topics: WeakTopicView[]; excludedSections: number }> {
  if (!session.instituteId) return { topics: [], excludedSections: 0 };
  const inst = session.instituteId;
  const supabase = await createServerSupabaseClient();

  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, paper_id, logged_at, papers!inner ( class_subject_id ), attempt_items ( question_id, is_correct )")
    .eq("institute_id", inst)
    .eq("student_id", session.userId)
    .eq("papers.class_subject_id", classSubjectId)
    .returns<{ id: string; paper_id: string; logged_at: string; attempt_items: { question_id: string; is_correct: boolean }[] }[]>();

  const rows = attempts ?? [];
  if (rows.length === 0) return { topics: [], excludedSections: 0 };

  const paperIds = rows.map((a) => a.paper_id);
  const { data: pqs } = await supabase
    .from("paper_questions")
    .select("paper_id, question_id, paper_blocks ( paper_sections ( pattern_sections ( practice_eligible ) ) )")
    .in("paper_id", paperIds)
    .eq("institute_id", inst)
    .returns<{ paper_id: string; question_id: string; paper_blocks: { paper_sections: { pattern_sections: { practice_eligible: boolean } | null } | null } | null }[]>();

  const eligible = new Map<string, boolean>();
  let excluded = 0;
  for (const r of pqs ?? []) {
    const ok = r.paper_blocks?.paper_sections?.pattern_sections?.practice_eligible ?? true;
    eligible.set(`${r.paper_id}:${r.question_id}`, ok);
    if (!ok) excluded++;
  }

  const questionIds = [...new Set(rows.flatMap((a) => a.attempt_items.map((i) => i.question_id)))];
  const { data: qs } = questionIds.length
    ? await supabase.from("questions").select("id, topics ( name )").in("id", questionIds).returns<{ id: string; topics: { name: string } | null }[]>()
    : { data: [] as { id: string; topics: { name: string } | null }[] };
  const topicById = new Map((qs ?? []).map((q) => [q.id, q.topics?.name ?? null]));

  const results: TopicResult[] = [];
  for (const a of rows) {
    const at = new Date(a.logged_at).getTime();
    for (const item of a.attempt_items) {
      if (eligible.get(`${a.paper_id}:${item.question_id}`) === false) continue;
      const topic = topicById.get(item.question_id);
      if (!topic) continue;
      results.push({ topicId: topic, isCorrect: item.is_correct, loggedAt: at });
    }
  }

  const acc = topicAccuracy(results);
  const streaks = consecutiveWrongStreak(results);
  const topics = [...acc.entries()]
    .map(([topic, v]) => ({ topic, correct: v.correct, total: v.total, streak: streaks.get(topic) ?? 0 }))
    .sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total);

  return { topics, excludedSections: excluded };
}
