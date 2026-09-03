import { describe, it, expect } from "vitest";
import {
  buildPracticeSet,
  topicAccuracy,
  consecutiveWrongStreak,
  type Candidate,
  type WrongItem,
} from "./index";
import type { Difficulty } from "../generator/types";

let cid = 0;
function cand(partial: Partial<Candidate> & { topicId: string | null; chapterId: string }): Candidate {
  return {
    id: `c${cid++}`,
    ownerInstituteId: "platform",
    strandId: null,
    difficulty: "medium",
    hasSolution: true,
    stimulusId: null,
    ...partial,
  };
}
function wrong(partial: Partial<WrongItem> & { chapterId: string }): WrongItem {
  return {
    questionId: `w${cid++}`,
    topicId: "t1",
    strandId: null,
    difficulty: "medium",
    practiceEligible: true,
    ...partial,
  };
}

describe("buildPracticeSet", () => {
  it("serves same-topic questions, capped at 3 per wrong answer", () => {
    const candidates = Array.from({ length: 10 }, () => cand({ topicId: "t1", chapterId: "ch1" }));
    const res = buildPracticeSet({
      wrongItems: [wrong({ topicId: "t1", chapterId: "ch1" })],
      candidates,
      exposedQuestionIds: new Set(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.items).toHaveLength(3);
    expect(res.items.every((i) => i.reason === "exact_topic")).toBe(true);
  });

  it("caps the whole set at 15", () => {
    const candidates = Array.from({ length: 100 }, () => cand({ topicId: "t1", chapterId: "ch1" }));
    const wrongs = Array.from({ length: 10 }, () => wrong({ topicId: "t1", chapterId: "ch1" }));
    const res = buildPracticeSet({ wrongItems: wrongs, candidates, exposedQuestionIds: new Set() });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.items.length).toBeLessThanOrEqual(15);
  });

  it("excludes questions the student has already been exposed to", () => {
    const c1 = cand({ id: "seen", topicId: "t1", chapterId: "ch1" });
    const c2 = cand({ id: "fresh", topicId: "t1", chapterId: "ch1" });
    const res = buildPracticeSet({
      wrongItems: [wrong({ topicId: "t1", chapterId: "ch1" })],
      candidates: [c1, c2],
      exposedQuestionIds: new Set(["seen"]),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.items.map((i) => i.questionId)).toEqual(["fresh"]);
  });

  it("returns no set when every wrong answer is from an ineligible section", () => {
    const res = buildPracticeSet({
      wrongItems: [wrong({ chapterId: "ch1", practiceEligible: false })],
      candidates: [cand({ topicId: "t1", chapterId: "ch1" })],
      exposedQuestionIds: new Set(),
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/writing|practice loop/i);
  });

  it("widens to the chapter and logs a coverage gap when the topic is empty", () => {
    const res = buildPracticeSet({
      wrongItems: [wrong({ topicId: "t-empty", chapterId: "ch1" })],
      candidates: [cand({ topicId: "t-other", chapterId: "ch1" })],
      exposedQuestionIds: new Set(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.items[0]!.reason).toBe("chapter_widened");
    expect(res.coverageGaps).toHaveLength(1);
    expect(res.coverageGaps[0]!.severity).toBe("normal");
  });

  it("logs a severe gap and serves nearest difficulty when the chapter is also empty", () => {
    const res = buildPracticeSet({
      wrongItems: [wrong({ topicId: "t-empty", chapterId: "ch-empty", difficulty: "easy" })],
      candidates: [cand({ topicId: "tX", chapterId: "chOther", difficulty: "medium" })],
      exposedQuestionIds: new Set(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.coverageGaps[0]!.severity).toBe("severe");
    expect(res.items[0]!.reason).toBe("nearest_difficulty");
  });

  it("serves a whole stimulus block when a topic only has stimulus-bound questions", () => {
    const candidates = [
      cand({ id: "p1", topicId: "t1", chapterId: "ch1", stimulusId: "S1" }),
      cand({ id: "p2", topicId: "t1", chapterId: "ch1", stimulusId: "S1" }),
      cand({ id: "p3", topicId: "t1", chapterId: "ch1", stimulusId: "S1" }),
    ];
    const res = buildPracticeSet({
      wrongItems: [wrong({ topicId: "t1", chapterId: "ch1" })],
      candidates,
      exposedQuestionIds: new Set(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // the whole block is served (all 3 questions), counted as one item
    expect(res.items.map((i) => i.questionId).sort()).toEqual(["p1", "p2", "p3"]);
    expect(res.items.every((i) => i.stimulusId === "S1")).toBe(true);
  });

  it("respects the one-band difficulty window", () => {
    // wrong is easy; a hard candidate is out of band, a medium one is in.
    const res = buildPracticeSet({
      wrongItems: [wrong({ topicId: "t1", chapterId: "ch1", difficulty: "easy" })],
      candidates: [
        cand({ id: "hard", topicId: "t1", chapterId: "ch1", difficulty: "hard" as Difficulty }),
        cand({ id: "med", topicId: "t1", chapterId: "ch1", difficulty: "medium" }),
      ],
      exposedQuestionIds: new Set(),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.items.map((i) => i.questionId)).toEqual(["med"]);
  });
});

describe("analytics", () => {
  it("computes per-topic accuracy", () => {
    const acc = topicAccuracy([
      { topicId: "t1", isCorrect: true, loggedAt: 1 },
      { topicId: "t1", isCorrect: false, loggedAt: 2 },
      { topicId: "t2", isCorrect: true, loggedAt: 3 },
    ]);
    expect(acc.get("t1")!.accuracy).toBeCloseTo(0.5);
    expect(acc.get("t2")!.accuracy).toBe(1);
  });

  it("computes the consecutive-wrong streak (newest first)", () => {
    const streaks = consecutiveWrongStreak([
      { topicId: "t1", isCorrect: true, loggedAt: 1 },
      { topicId: "t1", isCorrect: false, loggedAt: 2 },
      { topicId: "t1", isCorrect: false, loggedAt: 3 }, // most recent, wrong
    ]);
    expect(streaks.get("t1")).toBe(2);
  });
});
