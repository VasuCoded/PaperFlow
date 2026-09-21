import { describe, expect, it } from "vitest";
import { LP_CASES, LP_QUESTIONS, LP_TOPICS } from "../../scripts/staging/life-processes";
import { renderRich } from "@/lib/print/math";
import { buildBlocks, generatePaper, type GenQuestion, type Pattern } from "@/server/generator";
import board from "../../docs/patterns/cbse-10-science.json";

const CS = "cs-10-science";
const CH = "ch-life-processes";
const OWNER = "platform";

function asGen(): GenQuestion[] {
  const standalone = LP_QUESTIONS.map((q, i): GenQuestion => ({
    id: `q${String(i).padStart(3, "0")}`, ownerInstituteId: OWNER, classSubjectId: CS, chapterId: CH, topicId: q.topic,
    strandId: null, stimulusId: null, parentQuestionId: null, withinBlockOrder: i, difficulty: q.difficulty,
    marks: q.marks, questionType: q.type, optionsShufflable: q.shufflable, positionLocked: false,
  }));
  const parts = LP_CASES.flatMap((c) => c.parts.map((p, j): GenQuestion => ({
    id: `c-${c.key}-${j}`, ownerInstituteId: OWNER, classSubjectId: CS, chapterId: CH, topicId: c.topic,
    strandId: null, stimulusId: `s-${c.key}`, parentQuestionId: null, withinBlockOrder: j, difficulty: c.difficulty,
    marks: p.marks, questionType: "case_study", optionsShufflable: false, positionLocked: false,
  })));
  return [...standalone, ...parts];
}

const boardPattern: Pattern = {
  id: "board",
  name: board.name,
  totalMarks: board.total_marks,
  sections: board.sections.map((s) => ({
    label: s.label, questionCount: s.question_count, marksEach: s.marks_each, questionTypes: s.question_types,
    allowChoice: !!s.allow_choice, practiceEligible: s.practice_eligible, requiresStimulus: !!s.requires_stimulus,
  })),
};

describe("Life Processes staging set", () => {
  it("covers every topic, with no duplicate questions", () => {
    for (const t of LP_TOPICS) expect(LP_QUESTIONS.some((q) => q.topic === t.slug), t.slug).toBe(true);
    const bodies = [...LP_QUESTIONS.map((q) => q.body), ...LP_CASES.flatMap((c) => c.parts.map((p) => c.passage + p.body))];
    expect(new Set(bodies).size).toBe(bodies.length);
  });

  it("gives each type its board marks, and objective items a valid key", () => {
    const marks = { mcq: 1, assertion_reason: 1, vsa: 2, sa: 3, la: 5 };
    for (const q of LP_QUESTIONS) {
      expect(q.marks, q.body).toBe(marks[q.type]);
      if (q.type === "mcq" || q.type === "assertion_reason") {
        expect(q.options?.map((o) => o.key)).toEqual(["A", "B", "C", "D"]);
        expect(new Set(q.options!.map((o) => o.text)).size, q.body).toBe(4);
        expect(q.options!.some((o) => o.key === q.correct), q.body).toBe(true);
      } else {
        expect(q.options).toBeNull();
        expect(q.rubric, q.body).toBeTruthy();
      }
      expect(q.answer.length).toBeGreaterThan(0);
      expect(q.solution.length).toBeGreaterThan(0);
    }
    // assertion–reason options mean something in their order; never shuffle them
    expect(LP_QUESTIONS.filter((q) => q.type === "assertion_reason").every((q) => !q.shufflable)).toBe(true);
  });

  it("builds every case study as parts worth 1 + 1 + 2 = 4 marks", () => {
    for (const c of LP_CASES) {
      expect(c.parts.map((p) => p.label)).toEqual(["(a)", "(b)", "(c)"]);
      expect(c.parts.reduce((s, p) => s + p.marks, 0), c.key).toBe(4);
    }
  });

  it("renders every text without a KaTeX error", () => {
    const texts = [
      ...LP_QUESTIONS.flatMap((q) => [q.body, q.answer, q.solution, q.rubric ?? "", ...(q.options ?? []).map((o) => o.text)]),
      ...LP_CASES.flatMap((c) => [c.passage, ...c.parts.flatMap((p) => [p.body, p.answer, p.solution])]),
    ];
    for (const t of texts) expect(renderRich(t), t).not.toContain("katex-error");
  });

  it("is enough for the full 80-mark CBSE board pattern from this chapter alone, across seeds and mixes", () => {
    const blocks = buildBlocks(asGen());
    const mixes = [
      { easy: 0.3, medium: 0.5, hard: 0.2 },
      { easy: 0.4, medium: 0.4, hard: 0.2 },
      { easy: 0.2, medium: 0.5, hard: 0.3 },
      // a teacher's own, hard-heavy mix
      { easy: 0.1, medium: 0.3, hard: 0.6 },
    ];
    for (const difficultySplit of mixes) {
      for (const seed of [1, 2, 3, 42, 2026]) {
        const r = generatePaper({ instituteId: "i", classSubjectId: CS, allowedOwnerIds: [OWNER], difficultySplit, seed }, blocks, boardPattern);
        expect(r.ok, `${JSON.stringify(difficultySplit)} seed ${seed}: ${r.ok ? "" : r.reason}`).toBe(true);
        if (r.ok) expect(r.totalMarks).toBe(80);
      }
    }
  });
});
