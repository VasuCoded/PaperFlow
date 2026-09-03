/**
 * Multi-set shuffle engine (BUILD-PLAN C6 / section 3). Turns one paper into N
 * printable orderings a neighbour cannot copy from, WITHOUT breaking marking,
 * blocks, or mistake logging.
 *
 * Decoupled from the generator: the DB layer maps a generated paper plus each
 * question's option keys into the ShufflePaper shape below.
 */
import { makeRng, shuffle, type Rng } from "../generator/rng";

export interface ShuffleQuestion {
  key: string;
  optionsShufflable: boolean;
  optionKeys: string[] | null;
}
export interface ShuffleBlock {
  key: string;
  marks: number;
  positionLocked: boolean;
  questions: ShuffleQuestion[];
}
export interface ShuffleSection {
  label: string;
  blocks: ShuffleBlock[]; // canonical order
}
export interface ShufflePaper {
  sections: ShuffleSection[];
}

export interface SetItem {
  blockKey: string;
  displayPosition: number; // global position across the paper, 0-based
}
export interface SetOption {
  questionKey: string;
  optionOrder: string[];
}
export interface BuiltSet {
  setLabel: string;
  copiesToPrint: number;
  items: SetItem[];
  options: SetOption[];
}
export interface ShortSectionWarning {
  section: string;
  blocks: number;
  sets: number;
  note: string;
}
export interface BuildSetsResult {
  sets: BuiltSet[];
  warnings: ShortSectionWarning[];
  pairwiseOverlap: number; // measured mean fraction of shared (block, position)
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** even split, remainder to the earlier sets. copiesBreakdown(40,3) => [14,13,13] */
export function copiesBreakdown(batchSize: number, setCount: number): number[] {
  const base = Math.floor(batchSize / setCount);
  const rem = batchSize % setCount;
  return Array.from({ length: setCount }, (_, i) => base + (i < rem ? 1 : 0));
}

/**
 * Permute one section's blocks: locked blocks hold their slot; other blocks are
 * permuted only WITHIN their mark-value group so every slot keeps its marks
 * value. Returns a new ordering of the section's blocks.
 */
function permuteSection(blocks: readonly ShuffleBlock[], rng: Rng): ShuffleBlock[] {
  const result = blocks.slice();
  const groups = new Map<number, number[]>(); // marks -> non-locked slot indices
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i]!.positionLocked) continue;
    const m = blocks[i]!.marks;
    const g = groups.get(m);
    if (g) g.push(i);
    else groups.set(m, [i]);
  }
  for (const indices of groups.values()) {
    const picked = indices.map((i) => blocks[i]!);
    const shuffled = shuffle(picked, rng);
    indices.forEach((slot, k) => {
      result[slot] = shuffled[k]!;
    });
  }
  return result;
}

/** Max distinct orderings a section can produce (product of group factorials). */
function maxDistinctOrderings(blocks: readonly ShuffleBlock[]): number {
  const groups = new Map<number, number>();
  for (const b of blocks) {
    if (b.positionLocked) continue;
    groups.set(b.marks, (groups.get(b.marks) ?? 0) + 1);
  }
  let total = 1;
  for (const size of groups.values()) total *= factorial(size);
  return total;
}

function overlap(a: SetItem[], b: SetItem[]): number {
  const byPosB = new Map<number, string>();
  for (const it of b) byPosB.set(it.displayPosition, it.blockKey);
  let same = 0;
  for (const it of a) if (byPosB.get(it.displayPosition) === it.blockKey) same++;
  return a.length === 0 ? 0 : same / a.length;
}

function buildOneSetItems(paper: ShufflePaper, rng: Rng): SetItem[] {
  const items: SetItem[] = [];
  let pos = 0;
  for (const section of paper.sections) {
    const ordered = permuteSection(section.blocks, rng);
    for (const block of ordered) items.push({ blockKey: block.key, displayPosition: pos++ });
  }
  return items;
}

function buildOptions(paper: ShufflePaper, rng: Rng): SetOption[] {
  const options: SetOption[] = [];
  for (const section of paper.sections) {
    for (const block of section.blocks) {
      for (const q of block.questions) {
        // Only shuffle where opted-in; otherwise write NOTHING (canonical order).
        if (q.optionsShufflable && q.optionKeys && q.optionKeys.length > 1) {
          options.push({ questionKey: q.key, optionOrder: shuffle(q.optionKeys, rng) });
        }
      }
    }
  }
  return options;
}

/**
 * buildSets — deterministic given (paper, setCount, batchSize, seed). The
 * permutations are returned as explicit rows, never a seed regenerated on
 * demand, so reprinting a set months later is byte-identical.
 */
export function buildSets(
  paper: ShufflePaper,
  setCount: number,
  batchSize: number,
  seed: number,
): BuildSetsResult {
  const copies = copiesBreakdown(batchSize, setCount);

  // Warn where a section cannot produce enough distinct orderings.
  const warnings: ShortSectionWarning[] = [];
  for (const section of paper.sections) {
    if (maxDistinctOrderings(section.blocks) < setCount) {
      warnings.push({
        section: section.label,
        blocks: section.blocks.length,
        sets: setCount,
        note: `not enough distinct orderings; some sets must share ordering in section ${section.label}`,
      });
    }
  }

  const sets: BuiltSet[] = [];
  const chosenItems: SetItem[][] = [];

  for (let k = 0; k < setCount; k++) {
    let best: SetItem[] | null = null;
    let bestScore = Infinity;
    // Try several candidate permutations and keep the one most dispersed from
    // the sets already chosen (maximise positional dispersion, C6 item 8).
    const CANDIDATES = 24;
    for (let c = 0; c < CANDIDATES; c++) {
      const rng = makeRng(seed + k * 1000 + c);
      const items = buildOneSetItems(paper, rng);
      const score = chosenItems.reduce((mx, prev) => Math.max(mx, overlap(items, prev)), 0);
      if (score < bestScore) {
        bestScore = score;
        best = items;
      }
      if (bestScore === 0) break;
    }
    const items = best!;
    chosenItems.push(items);
    const optRng = makeRng(seed + k * 1000 + 999);
    sets.push({
      setLabel: LETTERS[k] ?? `S${k + 1}`,
      copiesToPrint: copies[k] ?? 0,
      items,
      options: buildOptions(paper, optRng),
    });
  }

  // Mean pairwise overlap across all set pairs.
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < chosenItems.length; i++) {
    for (let j = i + 1; j < chosenItems.length; j++) {
      sum += overlap(chosenItems[i]!, chosenItems[j]!);
      pairs++;
    }
  }
  const pairwiseOverlap = pairs === 0 ? 0 : sum / pairs;

  return { sets, warnings, pairwiseOverlap };
}
