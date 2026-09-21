"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession, PLATFORM_INSTITUTE_ID, type Session } from "@/server/session";
import { buildBlocks, generatePaper, swapBlock } from "@/server/generator";
import type {
  Block,
  Difficulty,
  GenQuestion,
  GeneratedPaper,
  Pattern,
} from "@/server/generator/types";
import { buildSets, type BuildSetsResult } from "@/server/sets";
import { getPatterns } from "@/server/data/teacher";
import { parseOptions } from "@/lib/options";
import { renderRich } from "@/lib/print/math";
import {
  defaultInstructions,
  sectionLabel,
  validateLayout,
  type AvailabilityRow,
  type CustomLayout,
  type LayoutSection,
} from "@/lib/paper-layout";

/**
 * Paper generation, in two steps:
 *
 *   previewPaper  runs the engines and returns what the paper would be. No writes.
 *   savePaper     rebuilds the SAME paper on the server and persists it.
 *
 * The browser never sends question ids. It sends the seed it was shown, the
 * blocks it locked and the swaps it made; the server replays those against the
 * pool it fetches itself. The generator is deterministic for a given seed and
 * pool order, so the saved paper is the previewed paper — and a crafted request
 * cannot smuggle in a question the teacher is not allowed to draw from.
 *
 * The LAYOUT is either a stored pattern (by id) or a template / custom layout
 * sent as data. A layout sent as data is validated here (lib/paper-layout.ts)
 * and again by the database when the paper is saved.
 */

export type LayoutChoice =
  | { kind: "pattern"; patternId: string }
  | { kind: "custom"; layout: CustomLayout; saveAsTemplate?: boolean };

export interface PaperRequest {
  classSubjectId: string;
  layout: LayoutChoice;
  chapterIds: string[];
  difficulty: { easy: number; medium: number; hard: number };
  setCount: number;
  batchId: string | null;
  excludeRecentPapers: number;
  title: string;
  seed: number;
  lockedBlockKeys: string[];
  /** replayed in order; each names the block key current at that moment */
  swaps: { blockKey: string; sectionLabel: string }[];
  /** rules the teacher chose to relax after a shortfall; never applied unasked */
  relax?: ("difficulty" | "topic_spread" | "strand_balance")[];
  /** strandId -> share of question positions (0..1, summing to 1); Social Science */
  strandWeights?: Record<string, number>;
}

export interface PreviewQuestion {
  id: string;
  body: string;
  /** body with its TeX rendered by KaTeX on the server (text is escaped) */
  html: string;
  source: string | null;
  marks: number;
}
export interface PreviewBlock {
  key: string;
  marks: number;
  difficulty: string;
  isStimulus: boolean;
  /** the passage / case / source, rendered once above its questions */
  stimulusHtml: string | null;
  isPrivate: boolean;
  chapterName: string;
  choice: PreviewQuestion[] | null;
  questions: PreviewQuestion[];
}
export interface PreviewSection {
  label: string;
  marksEach: number;
  instructions: string | null;
  blocks: PreviewBlock[];
}
export interface ShortfallRow {
  section: string;
  marks: number;
  needed: number;
  available: number;
}

export type PreviewResponse =
  | {
      ok: true;
      seed: number;
      totalMarks: number;
      durationMin: number | null;
      generalInstructions: string;
      difficultyActual: { easy: number; medium: number; hard: number };
      forcedTopicRepeats: number;
      poolSize: number;
      sections: PreviewSection[];
      copies: number[];
      warnings: { section: string; blocks: number }[];
      overlap: number;
      unappliedSwaps: number;
      /** what the chosen chapters hold, by kind and marks — for the layout editor */
      availability: AvailabilityRow[];
    }
  | {
      ok: false;
      reason: string;
      shortfall: ShortfallRow[];
      suggestions: { relax: string; would_yield: number }[];
      availability: AvailabilityRow[];
    };

export type SaveResponse = { ok: true; paperId: string; code: string } | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// shared build
// ---------------------------------------------------------------------------

type PoolRow = {
  id: string;
  owner_institute_id: string;
  class_subject_id: string;
  chapter_id: string | null;
  topic_id: string | null;
  strand_id: string | null;
  stimulus_id: string | null;
  parent_question_id: string | null;
  part_label: string | null;
  body: string;
  question_type: string;
  marks: number;
  difficulty: string;
  source: string | null;
  options_shufflable: boolean;
  position_locked: boolean;
};

/** The layout a paper is built from, however it was chosen. */
interface ResolvedLayout {
  name: string;
  durationMin: number | null;
  generalInstructions: string;
  sections: LayoutSection[];
  /** set when the layout is a stored pattern; otherwise it is stored on save */
  stored: { patternId: string; sectionIds: string[] } | null;
  saveAsTemplate: boolean;
}

type Draft =
  | {
      ok: true;
      session: Session;
      instituteId: string;
      layout: ResolvedLayout;
      paper: GeneratedPaper;
      pool: Map<string, PoolRow>;
      poolSize: number;
      chapterNames: Map<string, string>;
      sets: BuildSetsResult;
      unappliedSwaps: number;
      availability: AvailabilityRow[];
    }
  | { ok: false; response: Extract<PreviewResponse, { ok: false }> };

function fail(reason: string, availability: AvailabilityRow[] = []): Draft {
  return { ok: false, response: { ok: false, reason, shortfall: [], suggestions: [], availability } };
}

async function resolveLayout(
  choice: LayoutChoice | undefined,
  instituteId: string,
  classSubjectId: string,
): Promise<ResolvedLayout | string> {
  if (choice?.kind === "pattern") {
    const patterns = await getPatterns(instituteId, classSubjectId);
    const p = patterns.find((x) => x.id === choice.patternId);
    if (!p) return "That paper layout is not available for this subject.";
    return {
      name: p.name,
      durationMin: p.durationMin,
      generalInstructions: p.generalInstructions ?? "",
      sections: p.sections.map((s, i) => ({
        questionTypes: s.questionTypes,
        requiresStimulus: s.requiresStimulus,
        questionCount: s.questionCount,
        marksEach: s.marksEach,
        allowChoice: s.allowChoice,
        practiceEligible: s.practiceEligible,
        instructions: p.sectionInstructions[i] ?? defaultInstructions(s),
      })),
      stored: { patternId: p.id, sectionIds: p.sectionIds },
      saveAsTemplate: false,
    };
  }
  if (choice?.kind === "custom") {
    const v = validateLayout(choice.layout);
    if (!v.ok) return v.message;
    return { ...v.layout, stored: null, saveAsTemplate: choice.saveAsTemplate === true };
  }
  return "Choose a paper layout.";
}

/** Whole questions in the pool, grouped the way a layout section asks for them. */
function availabilityOf(blocks: readonly Block[]): AvailabilityRow[] {
  const byKey = new Map<string, AvailabilityRow>();
  for (const b of blocks) {
    const types = [...new Set(b.questions.map((q) => q.questionType))].sort();
    const key = `${types.join(",")}|${b.totalMarks}|${b.isStimulus}`;
    const row = byKey.get(key);
    if (row) row.count++;
    else byKey.set(key, { types, marks: b.totalMarks, stimulus: b.isStimulus, count: 1 });
  }
  return [...byKey.values()];
}

async function buildDraft(req: PaperRequest, kind: "preview" | "save"): Promise<Draft> {
  const session = await getSession();
  if (!session?.instituteId) return fail("You are not signed in.");
  const instituteId = session.instituteId;
  const supabase = await createServerSupabaseClient();

  // A teacher generates only for an assigned class-subject. RLS enforces this
  // on write as well; checking here gives a readable message instead of a
  // policy violation halfway through a save.
  if (session.role === "teacher") {
    const { count } = await supabase
      .from("teacher_subjects")
      .select("class_subject_id", { count: "exact", head: true })
      .eq("institute_id", instituteId)
      .eq("teacher_id", session.userId)
      .eq("class_subject_id", req.classSubjectId);
    if (!count) return fail("You are not assigned to that class and subject.");
  } else if (session.role !== "institute_admin") {
    return fail("Only a teacher or an institute admin can set a paper.");
  }

  // Rate limit before any expensive work (C12 item 6). Counted in the database,
  // per person and per institute, because serverless instances share no memory.
  const { error: limitError } = await supabase.rpc("note_generation", { p_institute_id: instituteId, p_kind: kind });
  if (limitError) {
    return fail(
      /rate limit: your institute/.test(limitError.message)
        ? "Your institute has generated a great many papers in the last ten minutes. Try again in a few minutes."
        : /rate limit/.test(limitError.message)
          ? "You have generated a great many papers in the last ten minutes. Wait a few minutes and try again."
          : limitError.message,
    );
  }

  // The difficulty mix is the teacher's own choice now, so it is checked like
  // any other input: three shares between 0 and 1 that add up to the paper.
  const d = req.difficulty;
  const shares = d ? [d.easy, d.medium, d.hard] : [];
  if (shares.length !== 3 || shares.some((x) => typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 1) || Math.abs(shares.reduce((a, b) => a + b, 0) - 1) > 0.011) {
    return fail("The easy / medium / hard mix must add up to 100%.");
  }

  // Strand weights, if given, must name this class-subject's strands and add
  // up to the whole paper; anything else is refused rather than guessed at.
  let strandWeights: Record<string, number> | undefined;
  if (req.strandWeights && Object.keys(req.strandWeights).length > 0) {
    const { data: strands } = await supabase.from("strands").select("id").eq("class_subject_id", req.classSubjectId);
    const valid = new Set((strands ?? []).map((s) => s.id));
    const entries = Object.entries(req.strandWeights);
    const sum = entries.reduce((n, [, w]) => n + w, 0);
    if (entries.some(([id, w]) => !valid.has(id) || !Number.isFinite(w) || w < 0 || w > 1) || Math.abs(sum - 1) > 0.011) {
      return fail("Strand shares must name this subject's strands and add up to 100%.");
    }
    strandWeights = Object.fromEntries(entries);
  }

  const [layout, poolResult, chaptersResult] = await Promise.all([
    resolveLayout(req.layout, instituteId, req.classSubjectId),
    supabase.rpc("eligible_questions", {
      p_institute_id: instituteId,
      p_class_subject_id: req.classSubjectId,
      p_chapter_ids: req.chapterIds.length > 0 ? req.chapterIds : undefined,
      p_teacher_id: session.userId,
      p_exclude_recent_papers: Math.max(0, Math.min(10, req.excludeRecentPapers)),
    }),
    supabase.from("chapters").select("id, name").eq("class_subject_id", req.classSubjectId),
  ]);
  if (poolResult.error) return fail(poolResult.error.message);

  // The RPC has no ORDER BY, and generation is only reproducible for a stable
  // pool order — so order it here, deterministically.
  const rows = [...((poolResult.data ?? []) as PoolRow[])].sort((a, b) =>
    (a.stimulus_id ?? "").localeCompare(b.stimulus_id ?? "") ||
    (a.parent_question_id ?? "").localeCompare(b.parent_question_id ?? "") ||
    (a.part_label ?? "").localeCompare(b.part_label ?? "") ||
    a.id.localeCompare(b.id),
  );

  const genQuestions: GenQuestion[] = rows.map((q, i) => ({
    id: q.id,
    ownerInstituteId: q.owner_institute_id,
    classSubjectId: q.class_subject_id,
    chapterId: q.chapter_id ?? "",
    topicId: q.topic_id,
    strandId: q.strand_id,
    stimulusId: q.stimulus_id,
    parentQuestionId: q.parent_question_id,
    withinBlockOrder: i,
    difficulty: (["easy", "medium", "hard"].includes(q.difficulty)
      ? q.difficulty
      : "medium") as Difficulty,
    marks: q.marks,
    questionType: q.question_type,
    optionsShufflable: q.options_shufflable,
    positionLocked: q.position_locked,
  }));
  const blocks = buildBlocks(genQuestions);
  const availability = availabilityOf(blocks);

  if (typeof layout === "string") return fail(layout, availability);
  if (rows.length === 0) return fail("There are no approved questions in those chapters yet.", availability);

  const input = {
    instituteId,
    classSubjectId: req.classSubjectId,
    allowedOwnerIds: [PLATFORM_INSTITUTE_ID, instituteId],
    difficultySplit: req.difficulty,
    seed: req.seed,
    pinnedBlockKeys: req.lockedBlockKeys,
    strandWeights,
    relax: {
      difficulty: req.relax?.includes("difficulty") ?? false,
      topic_spread: req.relax?.includes("topic_spread") ?? false,
      strand_balance: req.relax?.includes("strand_balance") ?? false,
    },
  };
  const genPattern: Pattern = {
    id: layout.stored?.patternId ?? "custom",
    name: layout.name,
    totalMarks: layout.sections.reduce((n, s) => n + s.questionCount * s.marksEach, 0),
    sections: layout.sections.map((s, i) => ({
      label: sectionLabel(i),
      questionCount: s.questionCount,
      marksEach: s.marksEach,
      questionTypes: s.questionTypes,
      allowChoice: s.allowChoice,
      practiceEligible: s.practiceEligible,
      requiresStimulus: s.requiresStimulus,
    })),
  };

  const result = generatePaper(input, blocks, genPattern);
  if (!result.ok) {
    return {
      ok: false,
      response: {
        ok: false,
        reason: result.reason,
        shortfall: result.shortfall,
        suggestions: result.suggestions,
        availability,
      },
    };
  }

  // Replay swaps. A swap that no longer applies (its block is gone because a
  // chapter was unticked, say) is skipped and counted, never fatal.
  let paper: GeneratedPaper = result;
  let unappliedSwaps = 0;
  const locked = new Set(req.lockedBlockKeys);
  for (const swap of req.swaps.slice(0, 200)) {
    if (locked.has(swap.blockKey)) {
      unappliedSwaps++;
      continue;
    }
    const r = swapBlock(paper, swap.sectionLabel, swap.blockKey, blocks, input);
    if (r.ok) paper = r.paper;
    else unappliedSwaps++;
  }

  // Real option keys for the questions actually placed. Shuffling "A-D" when a
  // question really has three options, or keys named otherwise, would write an
  // option order the answer key cannot resolve — and a wrong key marks correct
  // answers wrong (C7 item 2). `options` is readable; correct_option is not.
  const placedIds = paper.sections.flatMap((s) => s.blocks.flatMap((pb) => pb.block.questions.map((q) => q.id)));
  const [{ data: optionRows }, batchSize] = await Promise.all([
    supabase
      .from("questions")
      .select("id, options")
      .in("id", placedIds.length > 0 ? placedIds : ["00000000-0000-0000-0000-000000000000"]),
    batchSize_(req.batchId, instituteId),
  ]);
  const optionKeysById = new Map(
    (optionRows ?? []).map((r) => [r.id, parseOptions(r.options).map((o) => o.key)]),
  );

  const setCount = Math.max(1, Math.min(4, req.setCount));
  const sets = buildSets(
    {
      sections: paper.sections.map((s) => ({
        label: s.label,
        blocks: s.blocks.map((pb) => ({
          key: pb.block.key,
          marks: pb.positionMarks,
          positionLocked: pb.block.positionLocked,
          questions: pb.block.questions.map((q) => {
            const keys = optionKeysById.get(q.id) ?? [];
            return {
              key: q.id,
              optionsShufflable: q.optionsShufflable && keys.length > 1,
              optionKeys: keys.length > 1 ? keys : null,
            };
          }),
        })),
      })),
    },
    setCount,
    batchSize,
    req.seed,
  );

  return {
    ok: true,
    session,
    instituteId,
    layout,
    paper,
    pool: new Map(rows.map((r) => [r.id, r])),
    poolSize: rows.length,
    chapterNames: new Map((chaptersResult.data ?? []).map((c) => [c.id, c.name])),
    sets,
    unappliedSwaps,
    availability,
  };
}

async function batchSize_(batchId: string | null, instituteId: string): Promise<number> {
  if (!batchId) return 40;
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("enrolments")
    .select("student_id", { count: "exact", head: true })
    .eq("institute_id", instituteId)
    .eq("batch_id", batchId);
  return count && count > 0 ? count : 40;
}

// ---------------------------------------------------------------------------
// actions
// ---------------------------------------------------------------------------

export async function previewPaper(req: PaperRequest): Promise<PreviewResponse> {
  const draft = await buildDraft(req, "preview");
  if (!draft.ok) return draft.response;

  // Passages for the stimulus blocks actually placed, read under RLS (shared
  // bank plus this institute's own).
  const stimulusIds = [
    ...new Set(draft.paper.sections.flatMap((s) => s.blocks.map((pb) => pb.block.stimulusId).filter((x): x is string => !!x))),
  ];
  const stimulusHtml = new Map<string, string>();
  if (stimulusIds.length > 0) {
    const supabase = await createServerSupabaseClient();
    const { data: stimuli } = await supabase.from("stimuli").select("id, body").in("id", stimulusIds);
    for (const st of stimuli ?? []) if (st.body) stimulusHtml.set(st.id, renderRich(st.body));
  }

  const q = (id: string): PreviewQuestion => {
    const row = draft.pool.get(id);
    return {
      id,
      body: row?.body ?? "",
      html: renderRich(row?.body ?? ""),
      source: row?.source ?? null,
      marks: row?.marks ?? 0,
    };
  };

  return {
    ok: true,
    seed: req.seed,
    totalMarks: draft.paper.totalMarks,
    durationMin: draft.layout.durationMin,
    generalInstructions: draft.layout.generalInstructions,
    difficultyActual: draft.paper.difficultyActual,
    forcedTopicRepeats: draft.paper.forcedTopicRepeats,
    poolSize: draft.poolSize,
    sections: draft.paper.sections.map((s, i) => ({
      label: s.label,
      marksEach: s.blocks[0]?.positionMarks ?? draft.layout.sections[i]?.marksEach ?? 0,
      instructions: draft.layout.sections[i]?.instructions ?? null,
      blocks: s.blocks.map((pb) => ({
        key: pb.block.key,
        marks: pb.positionMarks,
        difficulty: pb.block.difficulty,
        isStimulus: pb.block.isStimulus,
        stimulusHtml: pb.block.stimulusId ? (stimulusHtml.get(pb.block.stimulusId) ?? null) : null,
        isPrivate: pb.block.ownerInstituteId !== PLATFORM_INSTITUTE_ID,
        chapterName: draft.chapterNames.get(pb.block.chapterId) ?? "",
        choice: pb.choiceAlternative ? pb.choiceAlternative.questions.map((x) => q(x.id)) : null,
        questions: pb.block.questions.map((x) => q(x.id)),
      })),
    })),
    copies: draft.sets.sets.map((s) => s.copiesToPrint),
    warnings: draft.sets.warnings.map((w) => ({ section: w.section, blocks: w.blocks })),
    overlap: draft.sets.pairwiseOverlap,
    unappliedSwaps: draft.unappliedSwaps,
    availability: draft.availability,
  };
}

export async function savePaper(req: PaperRequest): Promise<SaveResponse> {
  const draft = await buildDraft(req, "save");
  if (!draft.ok) return { ok: false, reason: draft.response.reason };

  const { instituteId, session, paper, sets, layout } = draft;
  const title = req.title.trim().slice(0, 120) || layout.name;
  const supabase = await createServerSupabaseClient();

  // A batch, when given, must belong to this institute and this class-subject.
  if (req.batchId) {
    const { data: batch } = await supabase
      .from("batches")
      .select("id")
      .eq("id", req.batchId)
      .eq("institute_id", instituteId)
      .eq("class_subject_id", req.classSubjectId)
      .maybeSingle();
    if (!batch) return { ok: false, reason: "That batch does not belong to this subject." };
  }

  // A template or custom layout is stored first, so the paper points at the
  // exact layout it was built from (and practice eligibility per section).
  let stored = layout.stored;
  if (!stored) {
    const { data: patternId, error: layoutErr } = await supabase.rpc("create_paper_layout", {
      p_institute_id: instituteId,
      p_class_subject_id: req.classSubjectId,
      p_name: layout.name,
      ...(layout.durationMin != null ? { p_duration_min: layout.durationMin } : {}),
      p_general_instructions: layout.generalInstructions,
      p_sections: layout.sections.map((s) => ({
        question_count: s.questionCount,
        marks_each: s.marksEach,
        question_types: s.questionTypes,
        allow_choice: s.allowChoice,
        practice_eligible: s.practiceEligible,
        requires_stimulus: s.requiresStimulus,
        instructions: s.instructions,
      })),
      p_listed: layout.saveAsTemplate,
    });
    if (layoutErr || !patternId) return { ok: false, reason: layoutErr?.message ?? "Could not save the paper layout." };
    const { data: secRows } = await supabase
      .from("pattern_sections")
      .select("id, sort_order")
      .eq("pattern_id", patternId)
      .order("sort_order");
    stored = { patternId, sectionIds: (secRows ?? []).map((s) => s.id) };
  }

  const { data: saved, error: paperErr } = await supabase
    .from("papers")
    .insert({
      institute_id: instituteId,
      teacher_id: session.userId,
      batch_id: req.batchId,
      class_subject_id: req.classSubjectId,
      pattern_id: stored.patternId,
      title,
      total_marks: paper.totalMarks,
      duration_min: layout.durationMin,
      instructions: layout.generalInstructions || null,
      status: "generated",
      seed: req.seed,
      generated_at: new Date().toISOString(),
    })
    .select("id, code")
    .single();
  if (paperErr || !saved) {
    return { ok: false, reason: paperErr?.message ?? "Could not save the paper." };
  }
  const paperId = saved.id;

  // Rows go in a handful of bulk inserts, not one round trip per question: a
  // 100-question paper must save as fast as a 10-question one.
  const { data: secRows, error: secErr } = await supabase
    .from("paper_sections")
    .insert(
      paper.sections.map((section, index) => ({
        institute_id: instituteId,
        paper_id: paperId,
        // which pattern section this came from: practice eligibility lives there
        pattern_section_id: stored.sectionIds[index] ?? null,
        label: section.label,
        sort_order: index,
      })),
    )
    .select("id, sort_order");
  if (secErr || !secRows) return { ok: false, reason: secErr?.message ?? "Could not save the sections." };
  const sectionIdByIndex = new Map(secRows.map((s) => [s.sort_order, s.id]));

  const placedBlocks = paper.sections.flatMap((section, index) =>
    section.blocks.map((placed) => ({ placed, sectionId: sectionIdByIndex.get(index)! })),
  );
  const { data: blkRows, error: blkErr } = await supabase
    .from("paper_blocks")
    .insert(
      placedBlocks.map(({ placed, sectionId }, i) => ({
        institute_id: instituteId,
        paper_id: paperId,
        section_id: sectionId,
        canonical_position: i + 1,
        stimulus_id: placed.block.stimulusId,
        locked: req.lockedBlockKeys.includes(placed.block.key),
      })),
    )
    .select("id, canonical_position");
  if (blkErr || !blkRows) return { ok: false, reason: blkErr?.message ?? "Could not save the questions." };
  const blockIdByPosition = new Map(blkRows.map((b) => [b.canonical_position, b.id]));
  const blockIds = new Map(placedBlocks.map(({ placed }, i) => [placed.block.key, blockIdByPosition.get(i + 1)!]));

  const pqInsert = placedBlocks.flatMap(({ placed }) => {
    const blockId = blockIds.get(placed.block.key)!;
    return [
      ...placed.block.questions.map((qq, i) => ({
        institute_id: instituteId,
        paper_id: paperId,
        block_id: blockId,
        question_id: qq.id,
        within_block_order: i,
        marks: qq.marks,
        is_choice_alternative: false,
      })),
      ...(placed.choiceAlternative?.questions ?? []).map((qq, i) => ({
        institute_id: instituteId,
        paper_id: paperId,
        block_id: blockId,
        question_id: qq.id,
        within_block_order: 100 + i,
        marks: qq.marks,
        is_choice_alternative: true,
      })),
    ];
  });
  const { data: pqRows, error: pqErr } = await supabase
    .from("paper_questions")
    .insert(pqInsert)
    .select("id, question_id, is_choice_alternative");
  if (pqErr) return { ok: false, reason: pqErr.message };
  /** question_id -> paper_questions.id, for the option-order rows */
  const paperQuestionIds = new Map<string, string>();
  for (const r of pqRows ?? []) {
    if (!r.is_choice_alternative) paperQuestionIds.set(r.question_id, r.id);
  }

  const { data: setRows, error: psErr } = await supabase
    .from("paper_sets")
    .insert(
      sets.sets.map((set) => ({
        institute_id: instituteId,
        paper_id: paperId,
        set_label: set.setLabel,
        copies_to_print: set.copiesToPrint,
      })),
    )
    .select("id, set_label");
  if (psErr || !setRows) return { ok: false, reason: psErr?.message ?? "Could not save the printed sets." };
  const setIdByLabel = new Map(setRows.map((s) => [s.set_label, s.id]));

  const items = sets.sets.flatMap((set) =>
    set.items.flatMap((it) => {
      const blockId = blockIds.get(it.blockKey);
      return blockId
        ? [{ institute_id: instituteId, paper_set_id: setIdByLabel.get(set.setLabel)!, paper_block_id: blockId, display_position: it.displayPosition }]
        : [];
    }),
  );
  // marks-per-position is re-checked by a database trigger on every insert
  const { error: itErr } = await supabase.from("paper_set_items").insert(items);
  if (itErr) return { ok: false, reason: itErr.message };

  // Stored as rows, never re-derived from the seed: reprinting Set B months
  // later must be byte-identical even if a library changes (BUILD-PLAN 3.1).
  const optionRows = sets.sets.flatMap((set) =>
    set.options.flatMap((o) => {
      const pqId = paperQuestionIds.get(o.questionKey);
      return pqId
        ? [{ institute_id: instituteId, paper_set_id: setIdByLabel.get(set.setLabel)!, paper_question_id: pqId, option_order: o.optionOrder }]
        : [];
    }),
  );
  if (optionRows.length > 0) {
    const { error: optErr } = await supabase.from("paper_set_options").insert(optionRows);
    if (optErr) return { ok: false, reason: optErr.message };
  }

  revalidatePath("/teacher/papers");
  return { ok: true, paperId, code: saved.code };
}

/** Take a saved template off the institute's list (its creator or an admin). */
export async function removeSavedLayout(patternId: string): Promise<{ ok: boolean; message?: string }> {
  const session = await getSession();
  if (!session?.instituteId) return { ok: false, message: "You are not signed in." };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("unlist_paper_layout", { p_pattern_id: patternId });
  if (error) return { ok: false, message: /not allowed/.test(error.message) ? "Only whoever saved it, or an institute admin, can remove it." : error.message };
  revalidatePath("/teacher/generate");
  return { ok: true };
}
