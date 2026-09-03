import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildSets,
  copiesBreakdown,
  type ShufflePaper,
  type ShuffleBlock,
} from "./index";

// ---------------------------------------------------------------------------
// Arbitrary paper with globally-unique block/question keys.
// ---------------------------------------------------------------------------
interface SectionSpec {
  len: number;
  marks: number[];
  lockFirst: boolean;
  shufflableOptions: boolean;
}

function buildPaper(specs: SectionSpec[]): ShufflePaper {
  let b = 0;
  let q = 0;
  return {
    sections: specs.map((spec, si) => {
      const blocks: ShuffleBlock[] = [];
      for (let i = 0; i < spec.len; i++) {
        const marks = spec.marks[i % spec.marks.length]!;
        blocks.push({
          key: `b${b++}`,
          marks,
          positionLocked: spec.lockFirst && i === 0,
          questions: [
            {
              key: `q${q++}`,
              optionsShufflable: spec.shufflableOptions,
              optionKeys: spec.shufflableOptions ? ["A", "B", "C", "D"] : null,
            },
          ],
        });
      }
      return { label: `S${si}`, blocks };
    }),
  };
}

const sectionSpecArb = fc.record({
  len: fc.integer({ min: 1, max: 6 }),
  marks: fc.array(fc.constantFrom(1, 2, 3, 5), { minLength: 1, maxLength: 4 }),
  lockFirst: fc.boolean(),
  shufflableOptions: fc.boolean(),
});

const paperArb = fc
  .array(sectionSpecArb, { minLength: 1, maxLength: 4 })
  .map((specs) => buildPaper(specs));

function sectionRanges(paper: ShufflePaper): Map<string, [number, number]> {
  // blockKey -> [sectionStart, sectionEnd) canonical position range
  const ranges = new Map<string, [number, number]>();
  let pos = 0;
  for (const s of paper.sections) {
    const start = pos;
    const end = pos + s.blocks.length;
    for (const blk of s.blocks) ranges.set(blk.key, [start, end]);
    pos = end;
  }
  return ranges;
}

function marksByBlock(paper: ShufflePaper): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of paper.sections) for (const b of s.blocks) m.set(b.key, b.marks);
  return m;
}

describe("copiesBreakdown", () => {
  it("splits evenly, remainder to earlier sets", () => {
    expect(copiesBreakdown(40, 3)).toEqual([14, 13, 13]);
    expect(copiesBreakdown(39, 3)).toEqual([13, 13, 13]);
    expect(copiesBreakdown(10, 4)).toEqual([3, 3, 2, 2]);
  });
});

describe("buildSets — property invariants", () => {
  it("holds every hard constraint across random papers", () => {
    fc.assert(
      fc.property(
        paperArb,
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 60 }),
        fc.integer({ min: 0, max: 100000 }),
        (paper, setCount, batch, seed) => {
          const res = buildSets(paper, setCount, batch, seed);
          const canonicalKeys = paper.sections.flatMap((s) => s.blocks.map((b) => b.key));
          const totalBlocks = canonicalKeys.length;
          const ranges = sectionRanges(paper);
          const marks = marksByBlock(paper);

          expect(res.sets).toHaveLength(setCount);

          // 1. same questions/blocks, only order differs; no block split.
          for (const set of res.sets) {
            expect(set.items).toHaveLength(totalBlocks);
            const keys = set.items.map((it) => it.blockKey);
            expect(new Set(keys).size).toBe(totalBlocks);
            expect(new Set(keys)).toEqual(new Set(canonicalKeys));
            const positions = set.items.map((it) => it.displayPosition);
            expect(new Set(positions).size).toBe(totalBlocks);
          }

          // 3/4-cross-section + marks-per-position.
          const marksAtPos: Map<number, number>[] = [];
          for (const set of res.sets) {
            const posMap = new Map<number, number>();
            for (const it of set.items) {
              // no cross-section movement
              const [start, end] = ranges.get(it.blockKey)!;
              expect(it.displayPosition).toBeGreaterThanOrEqual(start);
              expect(it.displayPosition).toBeLessThan(end);
              posMap.set(it.displayPosition, marks.get(it.blockKey)!);
            }
            marksAtPos.push(posMap);
          }
          // every display_position carries the same marks in every set
          for (let p = 0; p < totalBlocks; p++) {
            const vals = marksAtPos.map((m) => m.get(p));
            expect(new Set(vals).size).toBe(1);
          }

          // 5. locked blocks never move.
          for (const s of paper.sections) {
            for (const blk of s.blocks) {
              if (!blk.positionLocked) continue;
              const canonPos = res.sets[0]!.items.find((i) => i.blockKey === blk.key)!.displayPosition;
              for (const set of res.sets) {
                const it = set.items.find((i) => i.blockKey === blk.key)!;
                expect(it.displayPosition).toBe(canonPos);
              }
            }
          }

          // 6. option rows only for shufflable, multi-option questions.
          const shufflable = new Set<string>();
          for (const s of paper.sections)
            for (const b of s.blocks)
              for (const q of b.questions)
                if (q.optionsShufflable && q.optionKeys && q.optionKeys.length > 1)
                  shufflable.add(q.key);
          for (const set of res.sets) {
            for (const opt of set.options) {
              expect(shufflable.has(opt.questionKey)).toBe(true);
              expect(new Set(opt.optionOrder)).toEqual(new Set(["A", "B", "C", "D"]));
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("is idempotent: same inputs produce identical output", () => {
    fc.assert(
      fc.property(paperArb, fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 60 }), fc.integer({ min: 0, max: 100000 }), (paper, setCount, batch, seed) => {
        const a = buildSets(paper, setCount, batch, seed);
        const b = buildSets(paper, setCount, batch, seed);
        expect(a).toEqual(b);
      }),
      { numRuns: 100 },
    );
  });
});

describe("buildSets — explicit cases", () => {
  it("keeps a stimulus block's questions intact and in one position", () => {
    const paper: ShufflePaper = {
      sections: [
        {
          label: "A",
          blocks: Array.from({ length: 8 }, (_, i) => ({
            key: `b${i}`,
            marks: 1,
            positionLocked: false,
            questions: [{ key: `q${i}`, optionsShufflable: false, optionKeys: null }],
          })),
        },
        {
          label: "E",
          blocks: [
            {
              key: "stim1",
              marks: 4,
              positionLocked: false,
              questions: [
                { key: "s1q1", optionsShufflable: false, optionKeys: null },
                { key: "s1q2", optionsShufflable: false, optionKeys: null },
                { key: "s1q3", optionsShufflable: false, optionKeys: null },
                { key: "s1q4", optionsShufflable: false, optionKeys: null },
              ],
            },
            {
              key: "stim2",
              marks: 4,
              positionLocked: false,
              questions: [
                { key: "s2q1", optionsShufflable: false, optionKeys: null },
                { key: "s2q2", optionsShufflable: false, optionKeys: null },
              ],
            },
          ],
        },
      ],
    };
    const res = buildSets(paper, 3, 30, 99);
    for (const set of res.sets) {
      // each stimulus block appears exactly once (one position)
      expect(set.items.filter((i) => i.blockKey === "stim1")).toHaveLength(1);
      expect(set.items.filter((i) => i.blockKey === "stim2")).toHaveLength(1);
    }
  });

  it("warns when a section is too short to vary across sets", () => {
    const paper: ShufflePaper = {
      sections: [
        {
          label: "E",
          blocks: [
            { key: "e1", marks: 5, positionLocked: false, questions: [{ key: "q1", optionsShufflable: false, optionKeys: null }] },
            { key: "e2", marks: 5, positionLocked: false, questions: [{ key: "q2", optionsShufflable: false, optionKeys: null }] },
          ],
        },
      ],
    };
    const res = buildSets(paper, 3, 30, 1); // 2 blocks => 2 orderings < 3 sets
    expect(res.warnings.some((w) => w.section === "E")).toBe(true);
  });

  it("achieves low positional overlap on a long section", () => {
    const paper: ShufflePaper = {
      sections: [
        {
          label: "A",
          blocks: Array.from({ length: 20 }, (_, i) => ({
            key: `b${i}`,
            marks: 1,
            positionLocked: false,
            questions: [{ key: `q${i}`, optionsShufflable: false, optionKeys: null }],
          })),
        },
      ],
    };
    const res = buildSets(paper, 3, 40, 7);
    expect(res.pairwiseOverlap).toBeLessThanOrEqual(0.15);
  });

  it("a position-locked block never moves", () => {
    const paper: ShufflePaper = {
      sections: [
        {
          label: "D",
          blocks: [
            { key: "map", marks: 5, positionLocked: true, questions: [{ key: "mq", optionsShufflable: false, optionKeys: null }] },
            { key: "d1", marks: 5, positionLocked: false, questions: [{ key: "q1", optionsShufflable: false, optionKeys: null }] },
            { key: "d2", marks: 5, positionLocked: false, questions: [{ key: "q2", optionsShufflable: false, optionKeys: null }] },
            { key: "d3", marks: 5, positionLocked: false, questions: [{ key: "q3", optionsShufflable: false, optionKeys: null }] },
          ],
        },
      ],
    };
    const res = buildSets(paper, 3, 30, 5);
    for (const set of res.sets) {
      expect(set.items.find((i) => i.blockKey === "map")!.displayPosition).toBe(0);
    }
  });
});
