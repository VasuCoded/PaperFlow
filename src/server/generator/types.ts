export type Difficulty = "easy" | "medium" | "hard";

/** A question as the generator needs it (a projection of public.questions). */
export interface GenQuestion {
  id: string;
  ownerInstituteId: string;
  classSubjectId: string;
  chapterId: string;
  topicId: string | null;
  strandId: string | null;
  stimulusId: string | null;
  parentQuestionId: string | null;
  withinBlockOrder: number;
  difficulty: Difficulty;
  marks: number;
  questionType: string;
  optionsShufflable: boolean;
  positionLocked: boolean;
}

/**
 * A block is the unit of selection, shuffling and printing (BUILD-PLAN 5.4).
 * A standalone question is a block of one; a stimulus (passage/case/map) with
 * its questions is a block of many; multi-part 6(a)(b)(c) is a block.
 */
export interface Block {
  key: string;
  stimulusId: string | null;
  isStimulus: boolean;
  questions: GenQuestion[];
  chapterId: string;
  topicId: string | null;
  strandId: string | null;
  difficulty: Difficulty;
  totalMarks: number;
  ownerInstituteId: string;
  positionLocked: boolean;
}

export interface PatternSection {
  label: string;
  /** number of blocks (display positions) to place in this section */
  questionCount: number;
  /** marks carried by each block/position in this section */
  marksEach: number;
  questionTypes: string[];
  allowChoice: boolean;
  practiceEligible: boolean;
  requiresStimulus: boolean;
}

export interface Pattern {
  id: string;
  name: string;
  totalMarks: number;
  sections: PatternSection[];
}

export interface DifficultySplit {
  easy: number;
  medium: number;
  hard: number;
}

export interface GenerateInput {
  instituteId: string;
  classSubjectId: string;
  /** the only owners a selected block may belong to: [platformId, instituteId] */
  allowedOwnerIds: string[];
  difficultySplit: DifficultySplit;
  /** optional strandId -> weight fraction (Social Science) */
  strandWeights?: Record<string, number>;
  seed: number;
  /**
   * Blocks the teacher locked. They are placed first in their section and
   * survive a regenerate with a different seed (BUILD-PLAN C8: "Locked blocks
   * survive a regenerate"). A pinned key that no longer fits any section, or is
   * no longer in the pool, is ignored rather than failing the paper.
   */
  pinnedBlockKeys?: string[];
  /**
   * Rules the TEACHER chose to relax after a shortfall (C8: "each relaxation
   * option with what it would yield. The teacher chooses. Never auto-relax.").
   * Absent means every rule applies.
   */
  relax?: Partial<Record<Exclude<RelaxKind, "repeat_guard">, boolean>>;
}

export interface PlacedBlock {
  block: Block;
  positionMarks: number;
  /** internal-choice alternative, matched on marks and chapter */
  choiceAlternative?: Block;
}

export interface GeneratedSection {
  label: string;
  practiceEligible: boolean;
  blocks: PlacedBlock[];
}

export interface Shortfall {
  section: string;
  marks: number;
  needed: number;
  available: number;
}

export type RelaxKind =
  | "repeat_guard"
  | "difficulty"
  | "topic_spread"
  | "strand_balance";

export interface Suggestion {
  relax: RelaxKind;
  would_yield: number;
}

export interface GeneratedPaper {
  ok: true;
  patternId: string;
  sections: GeneratedSection[];
  totalMarks: number;
  difficultyActual: DifficultySplit;
  forcedTopicRepeats: number;
  seed: number;
}

export interface GenerateFailure {
  ok: false;
  reason: string;
  shortfall: Shortfall[];
  suggestions: Suggestion[];
}

export type GenerateResult = GeneratedPaper | GenerateFailure;
