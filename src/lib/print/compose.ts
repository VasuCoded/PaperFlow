/**
 * Composition layer: canonical paper + a built set -> printable models.
 *
 * This is the glue between the C6 shuffle engine and the C7 print output, and
 * it is where three failure modes from the plan are actually prevented:
 *
 *  - Sets must differ in ORDER (§3). A "set" that only changes the header
 *    letter is worse than one set, because it implies protection that isn't
 *    there.
 *  - Each set is renumbered in ITS OWN display order, and the answer key is
 *    numbered the same way (§C7 item 2).
 *  - Where option order was shuffled, the key shows the SHUFFLED letter.
 *    Getting this wrong hands the teacher a key that marks correct answers
 *    wrong (§C7 item 2).
 */
import type {
  AnswerKeyEntry,
  AnswerKeyModel,
  MappingRow,
  MappingSheetModel,
  PaperPrintModel,
  PrintBlock,
  PrintQuestion,
  PrintSection,
  PrintStimulus,
  Script,
} from "./model";
import type { BuiltSet, ShufflePaper } from "@/server/sets";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface CanonOption {
  key: string; // canonical letter
  text: string;
}
export interface CanonQuestion {
  body: string;
  marks: number;
  partLabel?: string;
  script?: Script;
  options?: CanonOption[];
  /** canonical option key that is correct (MCQ only) */
  correctOption?: string;
  optionsShufflable?: boolean;
  /** answer for non-MCQ questions */
  answer?: string;
}
export interface CanonBlock {
  key: string;
  positionLocked?: boolean;
  stimulus?: PrintStimulus;
  questions: CanonQuestion[];
}
export interface CanonSection {
  label: string;
  instructions?: string;
  blocks: CanonBlock[];
}
export interface CanonPaper {
  instituteName: string;
  instituteLogoUrl?: string | null;
  className: string;
  subjectName: string;
  title: string;
  totalMarks: number;
  durationMin?: number;
  sections: CanonSection[];
}

export function blockMarks(b: CanonBlock): number {
  return b.questions.reduce((s, q) => s + q.marks, 0);
}

/** Project the canonical paper into the shuffle engine's input shape. */
export function toShufflePaper(canon: CanonPaper): ShufflePaper {
  return {
    sections: canon.sections.map((s) => ({
      label: s.label,
      blocks: s.blocks.map((b) => ({
        key: b.key,
        marks: blockMarks(b),
        positionLocked: b.positionLocked ?? false,
        questions: b.questions.map((q, i) => ({
          key: questionKey(b.key, i),
          optionsShufflable: q.optionsShufflable ?? false,
          optionKeys: q.options ? q.options.map((o) => o.key) : null,
        })),
      })),
    })),
  };
}

export function questionKey(blockKey: string, index: number): string {
  return `${blockKey}#${index}`;
}

/** blockKey -> display position, from a built set. */
function positionMap(set: BuiltSet): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of set.items) m.set(it.blockKey, it.displayPosition);
  return m;
}

/** questionKey -> shuffled option order, from a built set. */
function optionMap(set: BuiltSet): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const o of set.options) m.set(o.questionKey, o.optionOrder);
  return m;
}

/**
 * Blocks of each section, reordered into this set's display order, with the
 * running 1-based question number each block takes in this set. A block is one
 * display position, so multi-part 6(a)(b)(c) shares one number.
 */
function orderedBlocks(
  canon: CanonPaper,
  set: BuiltSet,
): { section: CanonSection; blocks: { block: CanonBlock; number: number }[] }[] {
  const pos = positionMap(set);
  const out: { section: CanonSection; blocks: { block: CanonBlock; number: number }[] }[] = [];
  let counter = 0;
  for (const section of canon.sections) {
    const sorted = section.blocks
      .slice()
      .sort((a, b) => (pos.get(a.key) ?? 0) - (pos.get(b.key) ?? 0));
    out.push({
      section,
      blocks: sorted.map((block) => ({ block, number: ++counter })),
    });
  }
  return out;
}

/** Options relabelled A,B,C,D by their position in this set. */
function shuffledOptions(
  q: CanonQuestion,
  qKey: string,
  opts: Map<string, string[]>,
): { options: PrintQuestion["options"]; correctLetter?: string } {
  if (!q.options) return { options: undefined };
  const order = opts.get(qKey);
  const keysInOrder = order ?? q.options.map((o) => o.key);
  const byKey = new Map(q.options.map((o) => [o.key, o]));

  const options = keysInOrder.map((k, i) => ({
    letter: LETTERS[i] ?? String(i + 1),
    text: byKey.get(k)?.text ?? "",
  }));

  let correctLetter: string | undefined;
  if (q.correctOption) {
    const idx = keysInOrder.indexOf(q.correctOption);
    if (idx >= 0) correctLetter = LETTERS[idx] ?? String(idx + 1);
  }
  return { options, correctLetter };
}

export function composeSetPaper(
  canon: CanonPaper,
  set: BuiltSet,
  setCount: number,
): PaperPrintModel {
  const opts = optionMap(set);
  const sections: PrintSection[] = orderedBlocks(canon, set).map(({ section, blocks }) => ({
    label: section.label,
    instructions: section.instructions,
    blocks: blocks.map(({ block, number }): PrintBlock => ({
      stimulus: block.stimulus,
      positionLocked: block.positionLocked,
      questions: block.questions.map((q, i): PrintQuestion => {
        const { options } = shuffledOptions(q, questionKey(block.key, i), opts);
        return {
          displayNumber: String(number),
          partLabel: q.partLabel,
          body: q.body,
          marks: q.marks,
          options,
          script: q.script,
        };
      }),
    })),
  }));

  return {
    instituteName: canon.instituteName,
    instituteLogoUrl: canon.instituteLogoUrl ?? null,
    className: canon.className,
    subjectName: canon.subjectName,
    title: canon.title,
    totalMarks: canon.totalMarks,
    durationMin: canon.durationMin,
    setLabel: set.setLabel,
    setCount,
    sections,
  };
}

export function composeSetKey(canon: CanonPaper, set: BuiltSet): AnswerKeyModel {
  const opts = optionMap(set);
  const entries: AnswerKeyEntry[] = [];
  for (const { blocks } of orderedBlocks(canon, set)) {
    for (const { block, number } of blocks) {
      block.questions.forEach((q, i) => {
        const { options, correctLetter } = shuffledOptions(q, questionKey(block.key, i), opts);
        const answer =
          correctLetter != null
            ? `(${correctLetter}) ${options?.find((o) => o.letter === correctLetter)?.text ?? ""}`
            : (q.answer ?? "");
        entries.push({
          displayNumber: String(number),
          partLabel: q.partLabel,
          answer,
          marks: q.marks,
          script: q.script,
        });
      });
    }
  }
  return {
    instituteName: canon.instituteName,
    title: canon.title,
    setLabel: set.setLabel,
    entries,
  };
}

export function composeMapping(canon: CanonPaper, sets: BuiltSet[]): MappingSheetModel {
  // canonical numbering: order of blocks as authored
  const canonicalOrder: CanonBlock[] = canon.sections.flatMap((s) => s.blocks);
  const numberInSet = sets.map((set) => {
    const map = new Map<string, number>();
    for (const { blocks } of orderedBlocks(canon, set)) {
      for (const { block, number } of blocks) map.set(block.key, number);
    }
    return { label: set.setLabel, map };
  });

  const rows: MappingRow[] = canonicalOrder.map((block, i) => {
    const positionInSet: Record<string, number> = {};
    for (const { label, map } of numberInSet) positionInSet[label] = map.get(block.key) ?? 0;

    const single = block.questions.length === 1 ? block.questions[0] : undefined;
    let answer = "see key";
    if (single) {
      if (single.correctOption) {
        // report the canonical answer text; per-set letters live on each key
        answer = single.options?.find((o) => o.key === single.correctOption)?.text ?? "see key";
        if (answer.length > 28) answer = "see key";
      } else if (single.answer) {
        answer = single.answer.length > 28 ? "see key" : single.answer;
      }
    }

    return {
      canonicalNumber: i + 1,
      positionInSet,
      answer,
      marks: blockMarks(block),
    };
  });

  const copies: Record<string, number> = {};
  for (const s of sets) copies[s.setLabel] = s.copiesToPrint;

  return {
    instituteName: canon.instituteName,
    title: canon.title,
    setLabels: sets.map((s) => s.setLabel),
    rows,
    copies,
  };
}
