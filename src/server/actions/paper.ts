"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession, PLATFORM_INSTITUTE_ID, type Session } from "@/server/session";
import { buildBlocks, generatePaper, swapBlock } from "@/server/generator";
import type {
  Difficulty,
  GenQuestion,
  GeneratedPaper,
  Pattern,
} from "@/server/generator/types";
import { buildSets, type BuildSetsResult } from "@/server/sets";
import { getPatterns, type PatternWithSections } from "@/server/data/teacher";
import { parseOptions } from "@/lib/options";
import { renderRich } from "@/lib/print/math";

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
 */

export interface PaperRequest {
  classSubjectId: string;
  patternId: string;
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
      difficultyActual: { easy: number; medium: number; hard: number };
      forcedTopicRepeats: number;
      poolSize: number;
      sections: PreviewSection[];
      copies: number[];
      warnings: { section: string; blocks: number }[];
      overlap: number;
      unappliedSwaps: number;
    }
  | {
      ok: false;
      reason: string;
      shortfall: ShortfallRow[];
      suggestions: { relax: string; would_yield: number }[];
    };

export type SaveResponse = { ok: true; paperId: string } | { ok: false; reason: string };

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

type Draft =
  | {
      ok: true;
      session: Session;
      instituteId: string;
      pattern: PatternWithSections;
      paper: GeneratedPaper;
      pool: Map<string, PoolRow>;
      poolSize: number;
      chapterNames: Map<string, string>;
      sets: BuildSetsResult;
      unappliedSwaps: number;
    }
  | { ok: false; response: Extract<PreviewResponse, { ok: false }> };

function fail(reason: string): Draft {
  return { ok: false, response: { ok: false, reason, shortfall: [], suggestions: [] } };
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

  const patterns = await getPatterns(instituteId, req.classSubjectId);
  const pattern = patterns.find((p) => p.id === req.patternId);
  if (!pattern) return fail("That paper pattern is not available for this subject.");

  const { data: poolData, error } = await supabase.rpc("eligible_questions", {
    p_institute_id: instituteId,
    p_class_subject_id: req.classSubjectId,
    p_chapter_ids: req.chapterIds.length > 0 ? req.chapterIds : undefined,
    p_teacher_id: session.userId,
    p_exclude_recent_papers: Math.max(0, Math.min(10, req.excludeRecentPapers)),
  });
  if (error) return fail(error.message);

  // The RPC has no ORDER BY, and generation is only reproducible for a stable
  // pool order — so order it here, deterministically.
  const rows = [...((poolData ?? []) as PoolRow[])].sort((a, b) =>
    (a.stimulus_id ?? "").localeCompare(b.stimulus_id ?? "") ||
    (a.parent_question_id ?? "").localeCompare(b.parent_question_id ?? "") ||
    (a.part_label ?? "").localeCompare(b.part_label ?? "") ||
    a.id.localeCompare(b.id),
  );
  if (rows.length === 0) {
    return fail("There are no approved questions in those chapters yet.");
  }

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
    id: pattern.id,
    name: pattern.name,
    totalMarks: pattern.totalMarks,
    sections: pattern.sections,
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
  const { data: optionRows } = await supabase
    .from("questions")
    .select("id, options")
    .in("id", placedIds.length > 0 ? placedIds : ["00000000-0000-0000-0000-000000000000"]);
  const optionKeysById = new Map(
    (optionRows ?? []).map((r) => [r.id, parseOptions(r.options).map((o) => o.key)]),
  );

  const setCount = Math.max(1, Math.min(4, req.setCount));
  const batchSize = await batchSize_(req.batchId, instituteId);
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

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, name")
    .eq("class_subject_id", req.classSubjectId);

  return {
    ok: true,
    session,
    instituteId,
    pattern,
    paper,
    pool: new Map(rows.map((r) => [r.id, r])),
    poolSize: rows.length,
    chapterNames: new Map((chapters ?? []).map((c) => [c.id, c.name])),
    sets,
    unappliedSwaps,
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
    durationMin: draft.pattern.durationMin,
    difficultyActual: draft.paper.difficultyActual,
    forcedTopicRepeats: draft.paper.forcedTopicRepeats,
    poolSize: draft.poolSize,
    sections: draft.paper.sections.map((s, i) => ({
      label: s.label,
      marksEach: s.blocks[0]?.positionMarks ?? draft.pattern.sections[i]?.marksEach ?? 0,
      instructions: null,
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
  };
}

export async function savePaper(req: PaperRequest): Promise<SaveResponse> {
  const draft = await buildDraft(req, "save");
  if (!draft.ok) return { ok: false, reason: draft.response.reason };

  const title = req.title.trim().slice(0, 120) || draft.pattern.name;
  const { instituteId, session, paper, sets, pattern } = draft;
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

  const { data: saved, error: paperErr } = await supabase
    .from("papers")
    .insert({
      institute_id: instituteId,
      teacher_id: session.userId,
      batch_id: req.batchId,
      class_subject_id: req.classSubjectId,
      pattern_id: pattern.id,
      title,
      total_marks: paper.totalMarks,
      duration_min: pattern.durationMin,
      status: "generated",
      seed: req.seed,
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (paperErr || !saved) {
    return { ok: false, reason: paperErr?.message ?? "Could not save the paper." };
  }
  const paperId = saved.id;

  const blockIds = new Map<string, string>();
  /** question_id -> paper_questions.id, for the option-order rows */
  const paperQuestionIds = new Map<string, string>();
  let canonical = 0;

  for (const [index, section] of paper.sections.entries()) {
    const { data: sec, error: secErr } = await supabase
      .from("paper_sections")
      .insert({
        institute_id: instituteId,
        paper_id: paperId,
        // which pattern section this came from: practice eligibility lives there
        pattern_section_id: pattern.sectionIds[index] ?? null,
        label: section.label,
        sort_order: index,
      })
      .select("id")
      .single();
    if (secErr || !sec) return { ok: false, reason: secErr?.message ?? "Could not save a section." };

    for (const placed of section.blocks) {
      canonical += 1;
      const { data: blk, error: blkErr } = await supabase
        .from("paper_blocks")
        .insert({
          institute_id: instituteId,
          paper_id: paperId,
          section_id: sec.id,
          canonical_position: canonical,
          stimulus_id: placed.block.stimulusId,
          locked: req.lockedBlockKeys.includes(placed.block.key),
        })
        .select("id")
        .single();
      if (blkErr || !blk) return { ok: false, reason: blkErr?.message ?? "Could not save a block." };
      blockIds.set(placed.block.key, blk.id);

      const rows = [
        ...placed.block.questions.map((qq, i) => ({
          institute_id: instituteId,
          paper_id: paperId,
          block_id: blk.id,
          question_id: qq.id,
          within_block_order: i,
          marks: qq.marks,
          is_choice_alternative: false,
        })),
        ...(placed.choiceAlternative?.questions ?? []).map((qq, i) => ({
          institute_id: instituteId,
          paper_id: paperId,
          block_id: blk.id,
          question_id: qq.id,
          within_block_order: 100 + i,
          marks: qq.marks,
          is_choice_alternative: true,
        })),
      ];
      const { data: pqRows, error: pqErr } = await supabase
        .from("paper_questions")
        .insert(rows)
        .select("id, question_id, is_choice_alternative");
      if (pqErr) return { ok: false, reason: pqErr.message };
      for (const r of pqRows ?? []) {
        if (!r.is_choice_alternative) paperQuestionIds.set(r.question_id, r.id);
      }
    }
  }

  for (const set of sets.sets) {
    const { data: ps, error: psErr } = await supabase
      .from("paper_sets")
      .insert({
        institute_id: instituteId,
        paper_id: paperId,
        set_label: set.setLabel,
        copies_to_print: set.copiesToPrint,
      })
      .select("id")
      .single();
    if (psErr || !ps) return { ok: false, reason: psErr?.message ?? "Could not save a printed set." };

    const items = set.items.flatMap((it) => {
      const blockId = blockIds.get(it.blockKey);
      return blockId
        ? [{ institute_id: instituteId, paper_set_id: ps.id, paper_block_id: blockId, display_position: it.displayPosition }]
        : [];
    });
    // marks-per-position is re-checked by a database trigger on every insert
    const { error: itErr } = await supabase.from("paper_set_items").insert(items);
    if (itErr) return { ok: false, reason: itErr.message };

    // Stored as rows, never re-derived from the seed: reprinting Set B months
    // later must be byte-identical even if a library changes (BUILD-PLAN 3.1).
    const optionRows = set.options.flatMap((o) => {
      const pqId = paperQuestionIds.get(o.questionKey);
      return pqId
        ? [{ institute_id: instituteId, paper_set_id: ps.id, paper_question_id: pqId, option_order: o.optionOrder }]
        : [];
    });
    if (optionRows.length > 0) {
      const { error: optErr } = await supabase.from("paper_set_options").insert(optionRows);
      if (optErr) return { ok: false, reason: optErr.message };
    }
  }

  revalidatePath("/teacher/papers");
  return { ok: true, paperId };
}
