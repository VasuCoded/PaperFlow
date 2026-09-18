import "server-only";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { PLATFORM_INSTITUTE_ID, type Session } from "@/server/session";
import { parseOptions } from "@/lib/options";
import type { CanonBlock, CanonPaper, CanonQuestion } from "@/lib/print/compose";
import type { BuiltSet } from "@/server/sets";
import type { Script } from "@/lib/print/model";

export interface PaperListRow {
  id: string;
  title: string;
  classSubjectId: string;
  classSubjectLabel: string;
  batchId: string | null;
  batchName: string | null;
  batchStudents: number;
  createdAt: string;
  totalMarks: number;
  setCount: number;
  loggedCount: number;
  /** distinct chapters the paper draws from, in first-appearance order */
  chapters: string[];
}

type ListRow = {
  id: string;
  title: string;
  total_marks: number | null;
  created_at: string;
  class_subject_id: string;
  batch_id: string | null;
  teacher_id: string | null;
  paper_questions: { questions: { chapters: { name: string } | null } | null }[];
  class_subjects: { classes: { name: string } | null; subjects: { name: string } | null } | null;
  batches: { name: string; enrolments: { count: number }[] } | null;
  paper_sets: { count: number }[];
  attempts: { count: number }[];
};

/**
 * Paper history. A teacher sees their own papers; an institute admin sees every
 * paper in the institute. Always scoped to the session's institute.
 */
export async function listPapers(session: Session): Promise<PaperListRow[]> {
  if (!session.instituteId) return [];
  const supabase = await createServerSupabaseClient();

  let q = supabase
    .from("papers")
    .select(
      `id, title, total_marks, created_at, class_subject_id, batch_id, teacher_id,
       paper_questions ( questions ( chapters ( name ) ) ),
       class_subjects ( classes ( name ), subjects ( name ) ),
       batches ( name, enrolments ( count ) ),
       paper_sets ( count ),
       attempts ( count )`,
    )
    .eq("institute_id", session.instituteId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (session.role === "teacher") q = q.eq("teacher_id", session.userId);

  const { data } = await q.returns<ListRow[]>();
  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    classSubjectId: p.class_subject_id,
    classSubjectLabel: `Class ${p.class_subjects?.classes?.name ?? "?"} · ${p.class_subjects?.subjects?.name ?? "?"}`,
    batchId: p.batch_id,
    batchName: p.batches?.name ?? null,
    batchStudents: p.batches?.enrolments[0]?.count ?? 0,
    createdAt: p.created_at,
    totalMarks: p.total_marks ?? 0,
    setCount: p.paper_sets[0]?.count ?? 0,
    loggedCount: p.attempts[0]?.count ?? 0,
    chapters: [...new Set(p.paper_questions.map((pq) => pq.questions?.chapters?.name).filter((n): n is string => !!n))],
  }));
}

export interface LoadedPaper {
  id: string;
  title: string;
  instituteId: string;
  classSubjectId: string;
  classSubjectLabel: string;
  batchId: string | null;
  batchName: string | null;
  createdAt: string;
  totalMarks: number;
  canon: CanonPaper;
  sets: BuiltSet[];
  setIds: Record<string, string>;
}

/**
 * Load a saved paper as the print layer's canonical form plus its stored sets.
 *
 * Structure is read with the USER's client, so RLS decides whether they may see
 * the paper at all. Answers (answer, correct_option) are column-revoked from
 * client roles, so they are read with the service role — and that query is
 * pinned to exactly the question ids this paper uses AND to owners this
 * institute may read. A service-role query with no tenant predicate is a bug
 * (CLAUDE.md > Tenancy).
 *
 * Returns null when the paper does not exist or the caller may not see it; the
 * caller renders 404, never a hint that it exists.
 */
export async function loadPaper(
  session: Session,
  paperId: string,
  opts: { withAnswers: boolean },
): Promise<LoadedPaper | null> {
  if (!session.instituteId) return null;
  if (!/^[0-9a-f-]{36}$/i.test(paperId)) return null;
  const instituteId = session.instituteId;
  const supabase = await createServerSupabaseClient();

  const { data: paper } = await supabase
    .from("papers")
    .select(
      `id, title, institute_id, class_subject_id, batch_id, created_at, total_marks, duration_min,
       institutes ( name ),
       class_subjects ( classes ( name ), subjects ( name, script ) ),
       batches ( name )`,
    )
    .eq("id", paperId)
    .eq("institute_id", instituteId)
    .maybeSingle()
    .returns<{
      id: string;
      title: string;
      institute_id: string;
      class_subject_id: string;
      batch_id: string | null;
      created_at: string;
      total_marks: number | null;
      duration_min: number | null;
      institutes: { name: string } | null;
      class_subjects: { classes: { name: string } | null; subjects: { name: string; script: string } | null } | null;
      batches: { name: string } | null;
    }>();
  if (!paper) return null;

  const [sectionsRes, blocksRes, pqRes, setsRes] = await Promise.all([
    supabase.from("paper_sections").select("id, label, sort_order").eq("paper_id", paperId).eq("institute_id", instituteId),
    supabase.from("paper_blocks").select("id, section_id, canonical_position, stimulus_id, locked").eq("paper_id", paperId).eq("institute_id", instituteId),
    supabase.from("paper_questions").select("id, block_id, question_id, within_block_order, marks, is_choice_alternative").eq("paper_id", paperId).eq("institute_id", instituteId),
    supabase.from("paper_sets").select("id, set_label, copies_to_print").eq("paper_id", paperId).eq("institute_id", instituteId).order("set_label"),
  ]);

  const sections = [...(sectionsRes.data ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const blocks = [...(blocksRes.data ?? [])].sort((a, b) => a.canonical_position - b.canonical_position);
  const pqs = pqRes.data ?? [];
  const setRows = setsRes.data ?? [];

  const questionIds = [...new Set(pqs.map((r) => r.question_id))];
  const stimulusIds = [...new Set(blocks.map((b) => b.stimulus_id).filter((x): x is string => !!x))];

  const [questionsRes, stimuliRes] = await Promise.all([
    questionIds.length
      ? supabase.from("questions").select("id, body, options, options_shufflable, part_label, language").in("id", questionIds)
      : Promise.resolve({ data: [] as { id: string; body: string; options: unknown; options_shufflable: boolean; part_label: string | null; language: string }[] }),
    stimulusIds.length
      ? supabase.from("stimuli").select("id, body, kind").in("id", stimulusIds)
      : Promise.resolve({ data: [] as { id: string; body: string | null; kind: string }[] }),
  ]);
  const questionById = new Map((questionsRes.data ?? []).map((q) => [q.id, q]));
  const stimulusById = new Map((stimuliRes.data ?? []).map((s) => [s.id, s]));

  // --- answers, service role, tenant-pinned ---------------------------------
  const answerById = new Map<string, { answer: string | null; correct_option: string | null }>();
  if (opts.withAnswers && questionIds.length > 0) {
    if (session.role !== "teacher" && session.role !== "institute_admin") return null;
    const admin = createAdminClient();
    const { data: answers } = await admin
      .from("questions")
      .select("id, answer, correct_option")
      .in("id", questionIds)
      .in("owner_institute_id", [PLATFORM_INSTITUTE_ID, instituteId]);
    for (const a of answers ?? []) answerById.set(a.id, { answer: a.answer, correct_option: a.correct_option });
  }

  const script: Script = paper.class_subjects?.subjects?.script === "devanagari" ? "devanagari" : "latin";

  // --- canonical paper -------------------------------------------------------
  const canonBlocksBySection = new Map<string, CanonBlock[]>();
  for (const b of blocks) {
    const inBlock = pqs
      .filter((r) => r.block_id === b.id)
      .sort((x, y) => Number(x.is_choice_alternative) - Number(y.is_choice_alternative) || x.within_block_order - y.within_block_order);

    const questions: CanonQuestion[] = inBlock.map((r) => {
      const q = questionById.get(r.question_id);
      const ans = answerById.get(r.question_id);
      const options = parseOptions((q?.options ?? null) as Parameters<typeof parseOptions>[0]);
      return {
        body: q?.body ?? "",
        marks: r.marks,
        partLabel: q?.part_label ?? undefined,
        script,
        options: options.length > 1 ? options : undefined,
        correctOption: ans?.correct_option ?? undefined,
        optionsShufflable: q?.options_shufflable ?? false,
        answer: ans?.answer ?? undefined,
        isChoiceAlternative: r.is_choice_alternative,
      };
    });

    const stim = b.stimulus_id ? stimulusById.get(b.stimulus_id) : undefined;
    const canonBlock: CanonBlock = {
      key: b.id,
      positionLocked: false,
      stimulus: stim ? { kind: stim.kind, body: stim.body ?? "", script } : undefined,
      questions,
    };
    const arr = canonBlocksBySection.get(b.section_id) ?? [];
    arr.push(canonBlock);
    canonBlocksBySection.set(b.section_id, arr);
  }

  const canon: CanonPaper = {
    instituteName: paper.institutes?.name ?? "",
    instituteLogoUrl: null,
    className: paper.class_subjects?.classes?.name ?? "",
    subjectName: paper.class_subjects?.subjects?.name ?? "",
    title: paper.title,
    totalMarks: paper.total_marks ?? 0,
    durationMin: paper.duration_min ?? undefined,
    sections: sections.map((s) => ({ label: s.label, blocks: canonBlocksBySection.get(s.id) ?? [] })),
  };

  // --- stored sets -----------------------------------------------------------
  const setIdList = setRows.map((s) => s.id);
  const [itemsRes, optsRes] = await Promise.all([
    setIdList.length
      ? supabase.from("paper_set_items").select("paper_set_id, paper_block_id, display_position").in("paper_set_id", setIdList).eq("institute_id", instituteId)
      : Promise.resolve({ data: [] as { paper_set_id: string; paper_block_id: string; display_position: number }[] }),
    setIdList.length
      ? supabase.from("paper_set_options").select("paper_set_id, paper_question_id, option_order").in("paper_set_id", setIdList).eq("institute_id", instituteId)
      : Promise.resolve({ data: [] as { paper_set_id: string; paper_question_id: string; option_order: string[] }[] }),
  ]);

  // paper_questions.id -> "<blockId>#<index among the block's real questions>"
  const pqKey = new Map<string, string>();
  for (const b of blocks) {
    pqs
      .filter((r) => r.block_id === b.id && !r.is_choice_alternative)
      .sort((x, y) => x.within_block_order - y.within_block_order)
      .forEach((r, i) => pqKey.set(r.id, `${b.id}#${i}`));
  }

  const sets: BuiltSet[] = setRows.map((s) => ({
    setLabel: s.set_label,
    copiesToPrint: s.copies_to_print,
    items: (itemsRes.data ?? [])
      .filter((it) => it.paper_set_id === s.id)
      .map((it) => ({ blockKey: it.paper_block_id, displayPosition: it.display_position })),
    options: (optsRes.data ?? [])
      .filter((o) => o.paper_set_id === s.id && pqKey.has(o.paper_question_id))
      .map((o) => ({ questionKey: pqKey.get(o.paper_question_id)!, optionOrder: o.option_order })),
  }));

  return {
    id: paper.id,
    title: paper.title,
    instituteId: paper.institute_id,
    classSubjectId: paper.class_subject_id,
    classSubjectLabel: `Class ${canon.className} · ${canon.subjectName}`,
    batchId: paper.batch_id,
    batchName: paper.batches?.name ?? null,
    createdAt: paper.created_at,
    totalMarks: canon.totalMarks,
    canon,
    sets,
    setIds: Object.fromEntries(setRows.map((s) => [s.set_label, s.id])),
  };
}
