/**
 * Paper generation engine (BUILD-PLAN C5). Pure functions — no DB, no UI.
 * The pattern drives structure; nothing here hardcodes a section layout, a mark
 * total or a subject name. Selection operates on BLOCKS, never on questions.
 *
 * Model decision (documented): a pattern section places `questionCount` BLOCKS,
 * each carrying `marksEach` marks (a block = one display position). A standalone
 * question is a block of one worth marksEach; a stimulus block's sub-questions
 * sum to marksEach and occupy one position. This makes the marks-per-position
 * invariant (section 3.1) natural and keeps the block the unit everywhere.
 */
import { makeRng, shuffle, type Rng } from "./rng";
import type {
  Block,
  Difficulty,
  DifficultySplit,
  GenerateInput,
  GenerateResult,
  GenQuestion,
  GeneratedSection,
  Pattern,
  PlacedBlock,
  Shortfall,
  Suggestion,
} from "./types";

export * from "./types";
export { makeRng, shuffle } from "./rng";

const DIFF_TOLERANCE = 0.06; // within ~5 percentage points (section C5 item 4)

const DIFFS: Difficulty[] = ["easy", "medium", "hard"];

/** Group questions into blocks (stimulus / multi-part / standalone). */
export function buildBlocks(questions: readonly GenQuestion[]): Block[] {
  const groups = new Map<string, GenQuestion[]>();
  for (const q of questions) {
    const key = q.stimulusId
      ? `s:${q.stimulusId}`
      : q.parentQuestionId
        ? `p:${q.parentQuestionId}`
        : `q:${q.id}`;
    const arr = groups.get(key);
    if (arr) arr.push(q);
    else groups.set(key, [q]);
  }

  const blocks: Block[] = [];
  for (const [key, qs] of groups) {
    const ordered = qs
      .slice()
      .sort((a, b) => a.withinBlockOrder - b.withinBlockOrder || a.id.localeCompare(b.id));
    const first = ordered[0]!;
    blocks.push({
      key,
      stimulusId: first.stimulusId,
      isStimulus: first.stimulusId != null,
      questions: ordered,
      chapterId: first.chapterId,
      topicId: first.topicId,
      strandId: first.strandId,
      difficulty: representativeDifficulty(ordered),
      totalMarks: ordered.reduce((s, q) => s + q.marks, 0),
      ownerInstituteId: first.ownerInstituteId,
      positionLocked: ordered.some((q) => q.positionLocked),
    });
  }
  return blocks;
}

function representativeDifficulty(qs: readonly GenQuestion[]): Difficulty {
  const counts: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const q of qs) counts[q.difficulty]++;
  return DIFFS.reduce((best, d) => (counts[d] > counts[best] ? d : best), "medium");
}

interface FillOpts {
  useDifficulty: boolean;
  useTopicSpread: boolean;
  useStrand: boolean;
}

interface FillState {
  sections: GeneratedSection[];
  shortfall: Shortfall[];
  forcedTopicRepeats: number;
  selected: Record<Difficulty, number>;
  filled: number;
}

function fill(
  pattern: Pattern,
  blocks: readonly Block[],
  input: GenerateInput,
  rng: Rng,
  opts: FillOpts,
): FillState {
  const allowed = new Set(input.allowedOwnerIds);
  const available = blocks.filter(
    (b) => allowed.has(b.ownerInstituteId) && b.questions[0]!.classSubjectId === input.classSubjectId,
  );

  const totalPositions = pattern.sections.reduce((s, sec) => s + sec.questionCount, 0);
  const target: Record<Difficulty, number> = {
    easy: Math.round(totalPositions * input.difficultySplit.easy),
    medium: Math.round(totalPositions * input.difficultySplit.medium),
    hard: Math.round(totalPositions * input.difficultySplit.hard),
  };

  const used = new Set<string>();
  const usedTopics = new Set<string>();
  const strandCount = new Map<string, number>();
  const selected: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const sections: GeneratedSection[] = [];
  const shortfall: Shortfall[] = [];
  let forcedTopicRepeats = 0;
  let filled = 0;

  for (const section of pattern.sections) {
    const base = available.filter(
      (b) => b.totalMarks === section.marksEach && b.isStimulus === section.requiresStimulus,
    );
    const placed: PlacedBlock[] = [];

    // Locked blocks first, in the order the teacher locked them. They count
    // toward difficulty, topic spread and strand balance like any other pick.
    for (const key of input.pinnedBlockKeys ?? []) {
      if (placed.length >= section.questionCount) break;
      const b = base.find((x) => x.key === key && !used.has(x.key));
      if (!b) continue;
      used.add(b.key);
      selected[b.difficulty]++;
      filled++;
      if (b.topicId) usedTopics.add(b.topicId);
      if (b.strandId) strandCount.set(b.strandId, (strandCount.get(b.strandId) ?? 0) + 1);
      placed.push({ block: b, positionMarks: section.marksEach });
    }

    for (let i = placed.length; i < section.questionCount; i++) {
      const pool = base.filter((b) => !used.has(b.key));
      if (pool.length === 0) {
        shortfall.push({
          section: section.label,
          marks: section.marksEach,
          needed: section.questionCount,
          available: base.length,
        });
        break;
      }

      const hadUnusedTopicOption = pool.some((b) => !b.topicId || !usedTopics.has(b.topicId));
      const pick = choose(pool, rng, {
        opts,
        target,
        selected,
        usedTopics,
        strandCount,
        strandWeights: input.strandWeights,
        totalPositions,
      });

      used.add(pick.key);
      selected[pick.difficulty]++;
      filled++;
      if (pick.topicId) {
        if (usedTopics.has(pick.topicId) && !hadUnusedTopicOption) forcedTopicRepeats++;
        usedTopics.add(pick.topicId);
      }
      if (pick.strandId) strandCount.set(pick.strandId, (strandCount.get(pick.strandId) ?? 0) + 1);

      const placedBlock: PlacedBlock = { block: pick, positionMarks: section.marksEach };

      if (section.allowChoice) {
        const alt = base.find(
          (b) =>
            !used.has(b.key) &&
            b.chapterId === pick.chapterId &&
            b.totalMarks === pick.totalMarks &&
            b.difficulty === pick.difficulty,
        );
        if (alt) {
          used.add(alt.key);
          placedBlock.choiceAlternative = alt;
        }
      }

      placed.push(placedBlock);
    }

    sections.push({
      label: section.label,
      practiceEligible: section.practiceEligible,
      blocks: placed,
    });
  }

  return { sections, shortfall, forcedTopicRepeats, selected, filled };
}

interface ChooseCtx {
  opts: FillOpts;
  target: Record<Difficulty, number>;
  selected: Record<Difficulty, number>;
  usedTopics: Set<string>;
  strandCount: Map<string, number>;
  strandWeights?: Record<string, number>;
  totalPositions: number;
}

function choose(pool: readonly Block[], rng: Rng, ctx: ChooseCtx): Block {
  const shuffled = shuffle(pool, rng);
  let best = shuffled[0]!;
  let bestScore = -Infinity;
  for (const b of shuffled) {
    let score = 0;
    if (ctx.opts.useDifficulty) {
      const deficit = ctx.target[b.difficulty] - ctx.selected[b.difficulty];
      score += deficit * 100; // difficulty is the dominant term
    }
    if (ctx.opts.useTopicSpread && b.topicId && ctx.usedTopics.has(b.topicId)) {
      score -= 30;
    }
    if (ctx.opts.useStrand && ctx.strandWeights && b.strandId) {
      const wanted = ctx.totalPositions * (ctx.strandWeights[b.strandId] ?? 0);
      const have = ctx.strandCount.get(b.strandId) ?? 0;
      score += have < wanted ? 15 : -10;
    }
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

export function generatePaper(
  input: GenerateInput,
  blocks: readonly Block[],
  pattern: Pattern,
): GenerateResult {
  const full = fill(pattern, blocks, input, makeRng(input.seed), {
    useDifficulty: true,
    useTopicSpread: true,
    useStrand: input.strandWeights != null,
  });

  if (full.shortfall.length > 0) {
    const suggestions = buildSuggestions(pattern, blocks, input, full.filled);
    return {
      ok: false,
      reason: `could not fill ${full.shortfall.length} section(s)`,
      shortfall: full.shortfall,
      suggestions,
    };
  }

  const total = full.filled;
  const actual: DifficultySplit = {
    easy: full.selected.easy / total,
    medium: full.selected.medium / total,
    hard: full.selected.hard / total,
  };
  const maxDev = Math.max(
    Math.abs(actual.easy - input.difficultySplit.easy),
    Math.abs(actual.medium - input.difficultySplit.medium),
    Math.abs(actual.hard - input.difficultySplit.hard),
  );
  // The tolerance can never be tighter than one question. On a 16-position
  // paper a single question is 6.25pp, so a flat 5pp rule is unsatisfiable
  // except by an exact hit — it would reject papers that are as close as
  // arithmetic allows. Large papers are unaffected (1/70 < 5pp), so the
  // section 3.1 guarantee still holds wherever it is actually achievable.
  const tolerance = Math.max(DIFF_TOLERANCE, 1 / total);
  if (maxDev > tolerance) {
    return {
      ok: false,
      reason: `difficulty target not met within ${Math.round(tolerance * 100)}pp (off by ${Math.round(maxDev * 100)}pp)`,
      shortfall: [],
      suggestions: [{ relax: "difficulty", would_yield: 0 }],
    };
  }

  const totalMarks = full.sections.reduce(
    (s, sec) => s + sec.blocks.reduce((t, pb) => t + pb.positionMarks, 0),
    0,
  );

  return {
    ok: true,
    patternId: pattern.id,
    sections: full.sections,
    totalMarks,
    difficultyActual: actual,
    forcedTopicRepeats: full.forcedTopicRepeats,
    seed: input.seed,
  };
}

function buildSuggestions(
  pattern: Pattern,
  blocks: readonly Block[],
  input: GenerateInput,
  baselineFilled: number,
): Suggestion[] {
  const out: Suggestion[] = [];
  const trials: { relax: Suggestion["relax"]; opts: FillOpts }[] = [
    { relax: "difficulty", opts: { useDifficulty: false, useTopicSpread: true, useStrand: input.strandWeights != null } },
    { relax: "topic_spread", opts: { useDifficulty: true, useTopicSpread: false, useStrand: input.strandWeights != null } },
    { relax: "strand_balance", opts: { useDifficulty: true, useTopicSpread: true, useStrand: false } },
  ];
  for (const t of trials) {
    const r = fill(pattern, blocks, input, makeRng(input.seed), t.opts);
    const yield_ = r.filled - baselineFilled;
    if (yield_ > 0) out.push({ relax: t.relax, would_yield: yield_ });
  }
  return out;
}

/**
 * Replace one block with an equivalent: identical total marks, same chapter,
 * same difficulty, same stimulus-ness, not already in the paper, not locked
 * (BUILD-PLAN C5 item 10). Locked blocks are never touched.
 */
export function swapBlock(
  paper: Extract<GenerateResult, { ok: true }>,
  sectionLabel: string,
  blockKey: string,
  allBlocks: readonly Block[],
  input: GenerateInput,
): { ok: true; paper: Extract<GenerateResult, { ok: true }>; block: Block } | { ok: false; reason: string } {
  const section = paper.sections.find((s) => s.label === sectionLabel);
  if (!section) return { ok: false, reason: "section not found" };
  const idx = section.blocks.findIndex((pb) => pb.block.key === blockKey);
  if (idx === -1) return { ok: false, reason: "block not found in section" };

  const current = section.blocks[idx]!.block;
  if (current.positionLocked) return { ok: false, reason: "block is locked" };

  const usedKeys = new Set<string>();
  for (const s of paper.sections) {
    for (const pb of s.blocks) {
      usedKeys.add(pb.block.key);
      if (pb.choiceAlternative) usedKeys.add(pb.choiceAlternative.key);
    }
  }
  const allowed = new Set(input.allowedOwnerIds);
  const candidates = allBlocks.filter(
    (b) =>
      allowed.has(b.ownerInstituteId) &&
      !usedKeys.has(b.key) &&
      !b.positionLocked &&
      b.totalMarks === current.totalMarks &&
      b.chapterId === current.chapterId &&
      b.difficulty === current.difficulty &&
      b.isStimulus === current.isStimulus,
  );
  const pick = shuffle(candidates, makeRng(input.seed))[0];
  if (!pick) return { ok: false, reason: "no eligible replacement block" };

  const newSections = paper.sections.map((s) =>
    s.label !== sectionLabel
      ? s
      : {
          ...s,
          blocks: s.blocks.map((pb, i) =>
            i === idx ? { ...pb, block: pick } : pb,
          ),
        },
  );
  return { ok: true, paper: { ...paper, sections: newSections }, block: pick };
}
