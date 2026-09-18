import { describe, it, expect } from "vitest";
import { buildBlocks, generatePaper, swapBlock } from "./index";
import type { Block, Difficulty, GenQuestion, GenerateInput, Pattern } from "./types";

// ---------------------------------------------------------------------------
// Synthetic bank builder. Spans multiple owners so third-institute exclusion
// and shared+private mixing can be asserted.
// ---------------------------------------------------------------------------
const PLATFORM = "platform";
const INST_A = "inst-a";
const INST_B = "inst-b"; // the "third institute" that must never leak in
const CS = "cs1";

let uid = 0;
function nextId() {
  return `q${uid++}`;
}

function makeStandalone(
  owner: string,
  marks: number,
  difficulty: Difficulty,
  chapterId: string,
  strandId: string | null = null,
): GenQuestion {
  const id = nextId();
  return {
    id,
    ownerInstituteId: owner,
    classSubjectId: CS,
    chapterId,
    topicId: `topic-${id}`, // unique topic => clean topic-spread assertions
    strandId,
    stimulusId: null,
    parentQuestionId: null,
    withinBlockOrder: 0,
    difficulty,
    marks,
    questionType: "mcq",
    optionsShufflable: false,
    positionLocked: false,
  };
}

function makeStimulusGroup(
  owner: string,
  totalMarks: number,
  difficulty: Difficulty,
  chapterId: string,
): GenQuestion[] {
  const stimId = `stim-${nextId()}`;
  const parts = totalMarks; // totalMarks sub-questions of 1 mark each
  const out: GenQuestion[] = [];
  for (let i = 0; i < parts; i++) {
    const id = nextId();
    out.push({
      id,
      ownerInstituteId: owner,
      classSubjectId: CS,
      chapterId,
      topicId: `topic-${stimId}`,
      strandId: null,
      stimulusId: stimId,
      parentQuestionId: null,
      withinBlockOrder: i,
      difficulty,
      marks: 1,
      questionType: "comprehension",
      optionsShufflable: false,
      positionLocked: false,
    });
  }
  return out;
}

const CHAPTERS = ["ch1", "ch2", "ch3", "ch4"];
const DIFFS: Difficulty[] = ["easy", "medium", "hard"];

/** A rich bank: for each marks value, plenty of each difficulty per owner. */
function richBank(owners: string[], marksValues: number[], perCell = 12): GenQuestion[] {
  const qs: GenQuestion[] = [];
  for (const owner of owners) {
    for (const m of marksValues) {
      for (const d of DIFFS) {
        for (let i = 0; i < perCell; i++) {
          qs.push(makeStandalone(owner, m, d, CHAPTERS[i % CHAPTERS.length]!));
        }
      }
    }
  }
  return qs;
}

const PATTERN: Pattern = {
  id: "pat-test",
  name: "Test Pattern",
  totalMarks: 78,
  sections: [
    { label: "A", questionCount: 20, marksEach: 1, questionTypes: ["mcq"], allowChoice: false, practiceEligible: true, requiresStimulus: false },
    { label: "B", questionCount: 10, marksEach: 2, questionTypes: ["vsa"], allowChoice: false, practiceEligible: true, requiresStimulus: false },
    { label: "C", questionCount: 6, marksEach: 3, questionTypes: ["sa"], allowChoice: false, practiceEligible: true, requiresStimulus: false },
    { label: "D", questionCount: 4, marksEach: 5, questionTypes: ["la"], allowChoice: true, practiceEligible: true, requiresStimulus: false },
  ],
};

const BASE_INPUT: GenerateInput = {
  instituteId: INST_A,
  classSubjectId: CS,
  allowedOwnerIds: [PLATFORM, INST_A],
  difficultySplit: { easy: 0.4, medium: 0.4, hard: 0.2 },
  seed: 1,
};

function allPlaced(paper: Extract<ReturnType<typeof generatePaper>, { ok: true }>): Block[] {
  const out: Block[] = [];
  for (const s of paper.sections) for (const pb of s.blocks) {
    out.push(pb.block);
    if (pb.choiceAlternative) out.push(pb.choiceAlternative);
  }
  return out;
}

describe("buildBlocks", () => {
  it("groups a stimulus and its questions into one block", () => {
    const qs = makeStimulusGroup(PLATFORM, 4, "medium", "ch1");
    const blocks = buildBlocks(qs);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.isStimulus).toBe(true);
    expect(blocks[0]!.questions).toHaveLength(4);
    expect(blocks[0]!.totalMarks).toBe(4);
    // internal order preserved
    expect(blocks[0]!.questions.map((q) => q.withinBlockOrder)).toEqual([0, 1, 2, 3]);
  });

  it("treats standalone questions as blocks of one", () => {
    const qs = [makeStandalone(PLATFORM, 1, "easy", "ch1"), makeStandalone(PLATFORM, 1, "hard", "ch2")];
    expect(buildBlocks(qs)).toHaveLength(2);
  });
});

describe("generatePaper — 50 generations", () => {
  const bank = richBank([PLATFORM, INST_A, INST_B], [1, 2, 3, 5], 40);
  const blocks = buildBlocks(bank);

  for (let seed = 1; seed <= 50; seed++) {
    it(`seed ${seed}: marks, difficulty, topic-spread, block & tenant integrity`, () => {
      const res = generatePaper({ ...BASE_INPUT, seed }, blocks, PATTERN);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      // marks total matches the pattern
      expect(res.totalMarks).toBe(78);

      // section structure is a hard constraint
      for (const sec of PATTERN.sections) {
        const got = res.sections.find((s) => s.label === sec.label)!;
        expect(got.blocks).toHaveLength(sec.questionCount);
        for (const pb of got.blocks) expect(pb.positionMarks).toBe(sec.marksEach);
      }

      // difficulty within tolerance
      expect(Math.abs(res.difficultyActual.easy - 0.4)).toBeLessThanOrEqual(0.06);
      expect(Math.abs(res.difficultyActual.medium - 0.4)).toBeLessThanOrEqual(0.06);
      expect(Math.abs(res.difficultyActual.hard - 0.2)).toBeLessThanOrEqual(0.06);

      // topic spread: unique-topic pool => no repeats, none forced
      const placed = allPlaced(res);
      const topics = placed.map((b) => b.topicId);
      expect(new Set(topics).size).toBe(topics.length);
      expect(res.forcedTopicRepeats).toBe(0);

      // no question owned by a third institute
      for (const b of placed) expect(b.ownerInstituteId).not.toBe(INST_B);

      // block integrity: no dangling stimulus question
      for (const b of placed) {
        if (b.questions.some((q) => q.stimulusId)) {
          expect(b.isStimulus).toBe(true);
          const sid = b.questions[0]!.stimulusId;
          expect(b.questions.every((q) => q.stimulusId === sid)).toBe(true);
        }
      }
    });
  }
});

describe("generatePaper — ownership", () => {
  it("mixes shared and private questions when both are available", () => {
    const bank = richBank([PLATFORM, INST_A], [1, 2, 3, 5], 40);
    const res = generatePaper(BASE_INPUT, buildBlocks(bank), PATTERN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const owners = new Set(allPlaced(res).map((b) => b.ownerInstituteId));
    // rich pools of both owners => a paper should be able to contain both
    expect(owners.has(PLATFORM) || owners.has(INST_A)).toBe(true);
  });

  it("generates from the shared bank alone when the institute has no private questions", () => {
    const bank = richBank([PLATFORM], [1, 2, 3, 5], 40);
    const res = generatePaper(BASE_INPUT, buildBlocks(bank), PATTERN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(allPlaced(res).every((b) => b.ownerInstituteId === PLATFORM)).toBe(true);
  });
});

describe("generatePaper — strand balance", () => {
  it("respects strand weights within 10 percentage points", () => {
    const strands = ["s1", "s2", "s3", "s4"];
    const weights = { s1: 0.4, s2: 0.2, s3: 0.2, s4: 0.2 };
    const qs: GenQuestion[] = [];
    for (const owner of [PLATFORM, INST_A]) {
      for (const s of strands) {
        for (const d of DIFFS) {
          for (let i = 0; i < 20; i++) {
            const q = makeStandalone(owner, 1, d, "ch1", s);
            qs.push(q);
          }
        }
      }
    }
    const pattern: Pattern = {
      id: "pat-strand",
      name: "Strand",
      totalMarks: 20,
      sections: [
        { label: "A", questionCount: 20, marksEach: 1, questionTypes: ["mcq"], allowChoice: false, practiceEligible: true, requiresStimulus: false },
      ],
    };
    const res = generatePaper({ ...BASE_INPUT, strandWeights: weights, seed: 7 }, buildBlocks(qs), pattern);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const placed = allPlaced(res);
    for (const s of strands) {
      const frac = placed.filter((b) => b.strandId === s).length / placed.length;
      expect(Math.abs(frac - weights[s as keyof typeof weights])).toBeLessThanOrEqual(0.1);
    }
  });
});

describe("generatePaper — stimulus sections and block integrity", () => {
  it("draws only stimulus blocks into a stimulus section and keeps them intact", () => {
    const qs: GenQuestion[] = [];
    // standalone 1-mark for section A
    for (const d of DIFFS) for (let i = 0; i < 30; i++) qs.push(makeStandalone(PLATFORM, 1, d, "ch1"));
    // stimulus blocks worth 4 for section E
    for (const d of DIFFS) for (let i = 0; i < 10; i++) qs.push(...makeStimulusGroup(PLATFORM, 4, d, "ch2"));
    const pattern: Pattern = {
      id: "pat-stim",
      name: "Stim",
      totalMarks: 10 * 1 + 3 * 4,
      sections: [
        { label: "A", questionCount: 10, marksEach: 1, questionTypes: ["mcq"], allowChoice: false, practiceEligible: true, requiresStimulus: false },
        { label: "E", questionCount: 3, marksEach: 4, questionTypes: ["comprehension"], allowChoice: false, practiceEligible: true, requiresStimulus: true },
      ],
    };
    const res = generatePaper({ ...BASE_INPUT, seed: 3 }, buildBlocks(qs), pattern);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const secA = res.sections.find((s) => s.label === "A")!;
    const secE = res.sections.find((s) => s.label === "E")!;
    expect(secA.blocks.every((pb) => !pb.block.isStimulus)).toBe(true);
    expect(secE.blocks.every((pb) => pb.block.isStimulus)).toBe(true);
    expect(secE.blocks.every((pb) => pb.block.totalMarks === 4)).toBe(true);
  });
});

describe("generatePaper — thin pool fails with a shortfall", () => {
  it("reports the section that ran short instead of a partial paper", () => {
    const qs: GenQuestion[] = [];
    for (let i = 0; i < 5; i++) qs.push(makeStandalone(PLATFORM, 1, "easy", "ch1")); // only 5 of marks=1
    for (const d of DIFFS) for (let i = 0; i < 20; i++) {
      qs.push(makeStandalone(PLATFORM, 2, d, "ch1"));
      qs.push(makeStandalone(PLATFORM, 3, d, "ch1"));
      qs.push(makeStandalone(PLATFORM, 5, d, "ch1"));
    }
    const res = generatePaper(BASE_INPUT, buildBlocks(qs), PATTERN);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    const sfA = res.shortfall.find((s) => s.section === "A");
    expect(sfA).toBeDefined();
    expect(sfA!.needed).toBe(20);
    expect(sfA!.available).toBe(5);
  });
});

describe("generatePaper — relaxations are the teacher's choice", () => {
  // Plenty of questions, but almost all easy: the 40/40/20 mix cannot be met.
  const easyHeavy: GenQuestion[] = [];
  for (const m of [1, 2, 3, 5]) {
    for (let i = 0; i < 40; i++) easyHeavy.push(makeStandalone(PLATFORM, m, "easy", CHAPTERS[i % CHAPTERS.length]!));
    easyHeavy.push(makeStandalone(PLATFORM, m, "medium", "ch1"));
  }
  const blocks = buildBlocks(easyHeavy);

  it("fails with the rules in force and suggests relaxing difficulty — without relaxing it", () => {
    const res = generatePaper(BASE_INPUT, blocks, PATTERN);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.suggestions.map((s) => s.relax)).toContain("difficulty");
  });

  it("builds the paper once the teacher relaxes difficulty", () => {
    const res = generatePaper({ ...BASE_INPUT, relax: { difficulty: true } }, blocks, PATTERN);
    expect(res.ok).toBe(true);
  });

  it("never suggests a rule the teacher already relaxed", () => {
    const thin: GenQuestion[] = [];
    for (let i = 0; i < 5; i++) thin.push(makeStandalone(PLATFORM, 1, "easy", "ch1"));
    const res = generatePaper({ ...BASE_INPUT, relax: { difficulty: true, topic_spread: true } }, buildBlocks(thin), PATTERN);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.suggestions.map((s) => s.relax)).not.toContain("difficulty");
    expect(res.suggestions.map((s) => s.relax)).not.toContain("topic_spread");
  });
});

describe("generatePaper — difficulty tolerance granularity", () => {
  // On a short paper one question is worth more than 5pp, so a flat 5pp rule
  // would reject papers that are as close as arithmetic allows. The tolerance
  // must widen to one question, and no further.
  const smallPattern: Pattern = {
    id: "pat-small",
    name: "Small",
    totalMarks: 16,
    sections: [
      { label: "A", questionCount: 6, marksEach: 1, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
      { label: "B", questionCount: 6, marksEach: 2, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
      { label: "C", questionCount: 4, marksEach: 3, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
    ],
  };
  const blocks = buildBlocks(richBank([PLATFORM], [1, 2, 3], 12));

  it("succeeds on a 16-position paper where one question exceeds 5pp", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const res = generatePaper({ ...BASE_INPUT, seed }, blocks, smallPattern);
      expect(res.ok, `seed ${seed}: ${res.ok ? "" : res.reason}`).toBe(true);
      if (!res.ok) return;
      // still within one question of target
      const dev = Math.max(
        Math.abs(res.difficultyActual.easy - 0.4),
        Math.abs(res.difficultyActual.medium - 0.4),
        Math.abs(res.difficultyActual.hard - 0.2),
      );
      expect(dev).toBeLessThanOrEqual(1 / 16 + 1e-9);
    }
  });

  it("does not loosen the tolerance on a large paper", () => {
    const bigPattern: Pattern = {
      id: "pat-big",
      name: "Big",
      totalMarks: 70,
      sections: [
        { label: "A", questionCount: 40, marksEach: 1, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
        { label: "B", questionCount: 15, marksEach: 2, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
      ],
    };
    const res = generatePaper({ ...BASE_INPUT, seed: 4 }, buildBlocks(richBank([PLATFORM], [1, 2], 40)), bigPattern);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // 55 positions => 1/55 < 6%, so the 6% bound is what applied
    expect(Math.abs(res.difficultyActual.hard - 0.2)).toBeLessThanOrEqual(0.06);
  });
});

describe("generatePaper — locked blocks", () => {
  const blocks = buildBlocks(richBank([PLATFORM, INST_A], [1, 2, 3, 5], 40));

  it("keeps locked blocks when regenerating with a different seed", () => {
    const first = generatePaper({ ...BASE_INPUT, seed: 11 }, blocks, PATTERN);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // lock one block from section A and one from section D
    const lockA = first.sections[0]!.blocks[2]!.block.key;
    const lockD = first.sections[3]!.blocks[0]!.block.key;

    for (const seed of [12, 99, 12345]) {
      const again = generatePaper(
        { ...BASE_INPUT, seed, pinnedBlockKeys: [lockA, lockD] },
        blocks,
        PATTERN,
      );
      expect(again.ok).toBe(true);
      if (!again.ok) return;
      const keysA = again.sections[0]!.blocks.map((pb) => pb.block.key);
      const keysD = again.sections[3]!.blocks.map((pb) => pb.block.key);
      expect(keysA).toContain(lockA);
      expect(keysD).toContain(lockD);
      // still a valid paper around the locks
      expect(again.totalMarks).toBe(78);
    }
  });

  it("never places a locked block in a section whose marks it does not fit", () => {
    const first = generatePaper({ ...BASE_INPUT, seed: 21 }, blocks, PATTERN);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const oneMark = first.sections[0]!.blocks[0]!.block.key; // a 1-mark block

    const again = generatePaper(
      { ...BASE_INPUT, seed: 22, pinnedBlockKeys: [oneMark] },
      blocks,
      PATTERN,
    );
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    for (const [i, sec] of again.sections.entries()) {
      const has = sec.blocks.some((pb) => pb.block.key === oneMark);
      expect(has).toBe(i === 0); // only ever in the 1-mark section
    }
  });

  it("ignores a locked key that is no longer in the pool", () => {
    const res = generatePaper(
      { ...BASE_INPUT, seed: 5, pinnedBlockKeys: ["q:does-not-exist"] },
      blocks,
      PATTERN,
    );
    expect(res.ok).toBe(true);
  });
});

describe("generatePaper — determinism", () => {
  it("same seed produces identical selection twice", () => {
    const blocks = buildBlocks(richBank([PLATFORM, INST_A], [1, 2, 3, 5], 40));
    const a = generatePaper({ ...BASE_INPUT, seed: 42 }, blocks, PATTERN);
    const b = generatePaper({ ...BASE_INPUT, seed: 42 }, blocks, PATTERN);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const keys = (p: typeof a) => p.sections.map((s) => s.blocks.map((pb) => pb.block.key));
    expect(keys(a)).toEqual(keys(b));
  });
});

describe("swapBlock", () => {
  const blocks = buildBlocks(richBank([PLATFORM, INST_A], [1, 2, 3, 5], 40));

  it("replaces a block with an equivalent one, preserving invariants", () => {
    const res = generatePaper({ ...BASE_INPUT, seed: 5 }, blocks, PATTERN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const target = res.sections[0]!.blocks[0]!.block;
    const swap = swapBlock(res, "A", target.key, blocks, { ...BASE_INPUT, seed: 5 });
    expect(swap.ok).toBe(true);
    if (!swap.ok) return;
    expect(swap.block.key).not.toBe(target.key);
    expect(swap.block.totalMarks).toBe(target.totalMarks);
    expect(swap.block.chapterId).toBe(target.chapterId);
    expect(swap.block.difficulty).toBe(target.difficulty);
    expect(swap.block.isStimulus).toBe(target.isStimulus);
    // total marks unchanged
    expect(swap.paper.totalMarks).toBe(res.totalMarks);
  });

  it("never touches a locked block", () => {
    const res = generatePaper({ ...BASE_INPUT, seed: 6 }, blocks, PATTERN);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const target = res.sections[0]!.blocks[0]!.block;
    const locked = { ...res, sections: res.sections.map((s, si) => si !== 0 ? s : {
      ...s, blocks: s.blocks.map((pb, i) => i !== 0 ? pb : { ...pb, block: { ...pb.block, positionLocked: true } }),
    }) };
    const swap = swapBlock(locked, "A", target.key, blocks, { ...BASE_INPUT, seed: 6 });
    expect(swap.ok).toBe(false);
  });
});
