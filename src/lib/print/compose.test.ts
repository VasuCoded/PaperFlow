import { describe, it, expect } from "vitest";
import {
  toShufflePaper,
  composeSetPaper,
  composeSetKey,
  composeMapping,
  blockMarks,
} from "./compose";
import { SAMPLE_SCIENCE_PAPER as CANON } from "./sample-paper";
import { buildSets } from "@/server/sets";
import type { PaperPrintModel } from "./model";

const SEED = 20260903;
const SET_COUNT = 3;
const built = buildSets(toShufflePaper(CANON), SET_COUNT, 40, SEED);

/** Question bodies in printed order, across the whole paper. */
function bodyOrder(m: PaperPrintModel): string[] {
  return m.sections.flatMap((s) => s.blocks.flatMap((b) => b.questions.map((q) => q.body)));
}
/** Printed numbers in order, one per question. */
function numberOrder(m: PaperPrintModel): string[] {
  return m.sections.flatMap((s) =>
    s.blocks.flatMap((b) => b.questions.map((q) => q.displayNumber)),
  );
}

describe("composeSetPaper", () => {
  const papers = built.sets.map((s) => composeSetPaper(CANON, s, SET_COUNT));

  it("gives every set exactly the same questions", () => {
    const canonical = [...bodyOrder(papers[0]!)].sort();
    for (const p of papers) {
      expect([...bodyOrder(p)].sort()).toEqual(canonical);
    }
  });

  it("actually shuffles — the sets are NOT in the same order", () => {
    // the bug this test exists for: three "sets" that differ only by the
    // letter printed in the header offer no protection at all.
    const orders = papers.map((p) => bodyOrder(p).join("|"));
    const distinct = new Set(orders);
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("numbers each set sequentially in its own display order", () => {
    for (const p of papers) {
      const nums = numberOrder(p).map(Number);
      // strictly non-decreasing, starting at 1, no gaps between distinct values
      expect(nums[0]).toBe(1);
      const distinct = [...new Set(nums)];
      expect(distinct).toEqual(distinct.map((_, i) => i + 1));
    }
  });

  it("keeps a multi-part block under one number and in order", () => {
    for (const p of papers) {
      const caseBlock = p.sections
        .flatMap((s) => s.blocks)
        .find((b) => b.questions.length > 1)!;
      const nums = new Set(caseBlock.questions.map((q) => q.displayNumber));
      expect(nums.size).toBe(1); // one number for the whole block
      expect(caseBlock.questions.map((q) => q.partLabel)).toEqual(["(a)", "(b)", "(c)"]);
    }
  });

  it("preserves marks per printed position across all sets", () => {
    const perSet = papers.map((p) =>
      p.sections.flatMap((s) => s.blocks.map((b) => b.questions.reduce((t, q) => t + q.marks, 0))),
    );
    for (const marks of perSet) expect(marks).toEqual(perSet[0]);
  });

  it("totals the canonical marks in every set", () => {
    for (const p of papers) {
      const total = p.sections.flatMap((s) => s.blocks).reduce(
        (t, b) => t + b.questions.reduce((x, q) => x + q.marks, 0),
        0,
      );
      expect(total).toBe(CANON.totalMarks);
    }
  });
});

describe("composeSetKey", () => {
  it("marks the right answer in every set, following shuffled option letters", () => {
    // The failure this guards: a key that says (A) when this set printed the
    // correct option as (C) marks correct answers wrong.
    for (const set of built.sets) {
      const paper = composeSetPaper(CANON, set, SET_COUNT);
      const key = composeSetKey(CANON, set);
      const printed = paper.sections.flatMap((s) =>
        s.blocks.flatMap((b) => b.questions.map((q) => q)),
      );

      key.entries.forEach((entry, i) => {
        const q = printed[i]!;
        // key is numbered in the same order as the printed paper
        expect(entry.displayNumber).toBe(q.displayNumber);
        expect(entry.partLabel).toBe(q.partLabel);

        if (q.options) {
          const m = /^\(([A-Z])\)\s*([\s\S]*)$/.exec(entry.answer);
          expect(m).not.toBeNull();
          const [, letter, text] = m!;
          // the letter the key names must be the option printed on THIS set's
          // paper carrying that exact text
          const printedOption = q.options.find((o) => o.letter === letter);
          expect(printedOption).toBeDefined();
          expect(printedOption!.text).toBe(text);
        }
      });
    }
  });

  it("resolves to the same underlying correct option text in every set", () => {
    const answerTextsPerSet = built.sets.map((set) => {
      const key = composeSetKey(CANON, set);
      const paper = composeSetPaper(CANON, set, SET_COUNT);
      const printed = paper.sections.flatMap((s) => s.blocks.flatMap((b) => b.questions));
      // pair each MCQ's body with the answer text, then sort by body
      return key.entries
        .map((e, i) => ({ body: printed[i]!.body, answer: e.answer.replace(/^\([A-Z]\)\s*/, "") }))
        .filter((_, i) => printed[i]!.options != null)
        .sort((a, b) => a.body.localeCompare(b.body))
        .map((x) => `${x.body}=>${x.answer}`);
    });
    for (const a of answerTextsPerSet) expect(a).toEqual(answerTextsPerSet[0]);
  });

  it("leaves non-shufflable options in canonical order", () => {
    // a2 has optionsShufflable: false — its printed options must stay A,B,C,D
    // matching the canonical text order in every set.
    const canonA2 = CANON.sections[0]!.blocks.find((b) => b.key === "a2")!;
    const canonTexts = canonA2.questions[0]!.options!.map((o) => o.text);
    for (const set of built.sets) {
      const paper = composeSetPaper(CANON, set, SET_COUNT);
      const q = paper.sections
        .flatMap((s) => s.blocks)
        .flatMap((b) => b.questions)
        .find((x) => x.body === canonA2.questions[0]!.body)!;
      expect(q.options!.map((o) => o.text)).toEqual(canonTexts);
    }
  });
});

describe("composeMapping", () => {
  it("reports each canonical question's real position in every set", () => {
    const mapping = composeMapping(CANON, built.sets);
    const canonicalBlocks = CANON.sections.flatMap((s) => s.blocks);
    expect(mapping.rows).toHaveLength(canonicalBlocks.length);

    for (const set of built.sets) {
      const paper = composeSetPaper(CANON, set, SET_COUNT);
      const numbers = paper.sections.flatMap((s) =>
        s.blocks.map((b) => Number(b.questions[0]!.displayNumber)),
      );
      // every number claimed by the mapping sheet for this set is one the
      // printed paper actually uses
      const claimed = mapping.rows.map((r) => r.positionInSet[set.setLabel]!);
      expect([...claimed].sort((a, b) => a - b)).toEqual([...numbers].sort((a, b) => a - b));
    }
  });

  it("carries the copies breakdown for the batch", () => {
    const mapping = composeMapping(CANON, built.sets);
    const total = Object.values(mapping.copies).reduce((a, b) => a + b, 0);
    expect(total).toBe(40);
  });

  it("reports canonical block marks", () => {
    const mapping = composeMapping(CANON, built.sets);
    const canonicalBlocks = CANON.sections.flatMap((s) => s.blocks);
    mapping.rows.forEach((r, i) => {
      expect(r.marks).toBe(blockMarks(canonicalBlocks[i]!));
    });
  });
});

describe("internal choice alternatives", () => {
  const canon: import("./compose").CanonPaper = {
    instituteName: "Test Institute",
    className: "10",
    subjectName: "Science",
    title: "Choice test",
    totalMarks: 6,
    sections: [
      {
        label: "D",
        blocks: [
          {
            key: "blk1",
            questions: [
              {
                body: "Pick the metal.",
                marks: 5,
                correctOption: "B",
                optionsShufflable: true,
                options: [
                  { key: "A", text: "Sulphur" },
                  { key: "B", text: "Copper" },
                  { key: "C", text: "Carbon" },
                ],
              },
              { body: "Describe the extraction of zinc.", marks: 5, answer: "roasting then reduction", isChoiceAlternative: true },
            ],
          },
          { key: "blk2", questions: [{ body: "One mark.", marks: 1, answer: "x" }] },
        ],
      },
    ],
  };

  it("does not count an alternative toward the block's marks", () => {
    expect(blockMarks(canon.sections[0]!.blocks[0]!)).toBe(5);
  });

  it("excludes alternatives from the shuffle input", () => {
    const sp = toShufflePaper(canon);
    expect(sp.sections[0]!.blocks[0]!.questions).toHaveLength(1);
    expect(sp.sections[0]!.blocks[0]!.marks).toBe(5);
  });

  it("prints the alternative under OR and keys the real question's shuffled letter", () => {
    const set = {
      setLabel: "A",
      copiesToPrint: 10,
      items: [
        { blockKey: "blk1", displayPosition: 0 },
        { blockKey: "blk2", displayPosition: 1 },
      ],
      // the real question's options were stored shuffled: C, B, A
      options: [{ questionKey: "blk1#0", optionOrder: ["C", "B", "A"] }],
    };
    const paper = composeSetPaper(canon, set, 2);
    const block = paper.sections[0]!.blocks.find((b) => b.questions.length === 2)!;
    expect(block.questions[1]!.partLabel).toBe("OR");

    const key = composeSetKey(canon, set);
    // Copper was key B; in order C,B,A it is printed as (B) — position 2
    expect(key.entries[0]!.answer).toBe("(B) Copper");
    expect(key.entries[1]!.partLabel).toBe("OR");
    expect(key.entries[1]!.answer).toBe("roasting then reduction");
  });
});
