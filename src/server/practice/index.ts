/**
 * Practice matcher + analytics (BUILD-PLAN C10). Pure functions — the DB layer
 * supplies the wrong items, the candidate pool and the student's exposure set,
 * and persists the returned practice_sets / practice_set_items / coverage_gaps.
 *
 * The loop is honest about where it does NOT apply (section 2.4): wrong items
 * from practice-ineligible sections are excluded, and if EVERY wrong item is
 * ineligible we return no set with a displayable reason rather than an empty set.
 */
import type { Difficulty } from "../generator/types";

const DIFF_INDEX: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

export interface WrongItem {
  questionId: string;
  topicId: string | null;
  chapterId: string;
  strandId: string | null;
  difficulty: Difficulty;
  practiceEligible: boolean;
}

export interface Candidate {
  id: string;
  ownerInstituteId: string;
  topicId: string | null;
  chapterId: string;
  strandId: string | null;
  difficulty: Difficulty;
  hasSolution: boolean;
  stimulusId: string | null;
}

export interface BuildPracticeInput {
  wrongItems: WrongItem[];
  candidates: Candidate[]; // already: approved, right class_subject, allowed owners, not flagged
  exposedQuestionIds: Set<string>;
  perWrongCap?: number; // default 3
  setCap?: number; // default 15
}

export interface PracticeItem {
  questionId: string;
  forWrongQuestionId: string;
  reason: "exact_topic" | "sibling_topic_chapter" | "sibling_strand" | "chapter_widened" | "nearest_difficulty";
  stimulusId: string | null;
}

export interface CoverageGap {
  topicId: string | null;
  chapterId: string;
  difficulty: Difficulty;
  severity: "normal" | "severe";
}

export type BuildPracticeResult =
  | { ok: true; items: PracticeItem[]; coverageGaps: CoverageGap[] }
  | { ok: false; reason: string };

function withinOneBand(a: Difficulty, b: Difficulty): boolean {
  return Math.abs(DIFF_INDEX[a] - DIFF_INDEX[b]) <= 1;
}

/**
 * Score a candidate for a wrong item. Higher is better. Exact topic beats
 * sibling topics in the same chapter, beats sibling topics in the same strand;
 * a written solution is a tiebreak (C10 item 3).
 */
function scoreCandidate(c: Candidate, w: WrongItem): number {
  let s = 0;
  if (w.topicId && c.topicId === w.topicId) s += 1000;
  else if (c.chapterId === w.chapterId) s += 500;
  else if (w.strandId && c.strandId === w.strandId) s += 200;
  else return -1; // not in scope for this wrong item
  s -= Math.abs(DIFF_INDEX[c.difficulty] - DIFF_INDEX[w.difficulty]) * 10;
  if (c.hasSolution) s += 5;
  return s;
}

export function buildPracticeSet(input: BuildPracticeInput): BuildPracticeResult {
  const perWrongCap = input.perWrongCap ?? 3;
  const setCap = input.setCap ?? 15;

  const eligible = input.wrongItems.filter((w) => w.practiceEligible);
  if (input.wrongItems.length > 0 && eligible.length === 0) {
    return {
      ok: false,
      reason: "All wrong answers were in sections without a practice loop (e.g. writing).",
    };
  }
  if (eligible.length === 0) {
    return { ok: false, reason: "No wrong answers to build practice from." };
  }

  const used = new Set<string>(); // question ids already placed
  const items: PracticeItem[] = [];
  const coverageGaps: CoverageGap[] = [];

  const pool = input.candidates.filter(
    (c) => !input.exposedQuestionIds.has(c.id),
  );

  for (const w of eligible) {
    if (items.length >= setCap) break;

    const pick = (
      predicate: (c: Candidate) => boolean,
      reason: PracticeItem["reason"],
      allowStimulus: boolean,
    ): number => {
      const matches = pool
        .filter(
          (c) =>
            !used.has(c.id) &&
            (allowStimulus || c.stimulusId === null) &&
            withinOneBand(c.difficulty, w.difficulty) &&
            predicate(c),
        )
        .sort((a, b) => scoreCandidate(b, w) - scoreCandidate(a, w));
      let added = 0;
      for (const c of matches) {
        if (added >= perWrongCap || items.length >= setCap) break;
        used.add(c.id);
        items.push({ questionId: c.id, forWrongQuestionId: w.questionId, reason, stimulusId: c.stimulusId });
        added++;
      }
      return added;
    };

    // 1. exact topic, non-stimulus
    let added = w.topicId
      ? pick((c) => c.topicId === w.topicId, "exact_topic", false)
      : 0;

    // 2. topic only has stimulus-bound questions -> serve the whole block (one pick)
    if (added === 0 && w.topicId) {
      const stim = pool.find(
        (c) =>
          !used.has(c.id) &&
          c.stimulusId !== null &&
          c.topicId === w.topicId &&
          withinOneBand(c.difficulty, w.difficulty),
      );
      if (stim) {
        // serve every question of that stimulus block, counted as one item toward caps
        for (const c of pool.filter((x) => x.stimulusId === stim.stimulusId && !used.has(x.id))) {
          used.add(c.id);
          items.push({ questionId: c.id, forWrongQuestionId: w.questionId, reason: "exact_topic", stimulusId: c.stimulusId });
        }
        added = 1;
      }
    }

    // 3. widen to chapter, log a coverage gap
    if (added === 0) {
      const chapterAdded = pick((c) => c.chapterId === w.chapterId, "chapter_widened", false);
      coverageGaps.push({
        topicId: w.topicId,
        chapterId: w.chapterId,
        difficulty: w.difficulty,
        severity: chapterAdded === 0 ? "severe" : "normal",
      });
      added = chapterAdded;
    }

    // 4. chapter also empty: serve nearest by difficulty (anything in the pool),
    //    already logged as a severe gap above.
    if (added === 0) {
      const nearest = pool
        .filter((c) => !used.has(c.id) && c.stimulusId === null)
        .sort(
          (a, b) =>
            Math.abs(DIFF_INDEX[a.difficulty] - DIFF_INDEX[w.difficulty]) -
            Math.abs(DIFF_INDEX[b.difficulty] - DIFF_INDEX[w.difficulty]),
        )
        .slice(0, perWrongCap);
      for (const c of nearest) {
        if (items.length >= setCap) break;
        used.add(c.id);
        items.push({ questionId: c.id, forWrongQuestionId: w.questionId, reason: "nearest_difficulty", stimulusId: c.stimulusId });
      }
    }
  }

  return { ok: true, items, coverageGaps };
}

// ---------------------------------------------------------------------------
// Analytics (tenant-scoped in the DB; pure aggregations here).
// ---------------------------------------------------------------------------
export interface TopicResult {
  topicId: string;
  isCorrect: boolean;
  loggedAt: number; // epoch ms, for ordering
}

/** Per-topic accuracy over eligible attempt items. */
export function topicAccuracy(results: TopicResult[]): Map<string, { correct: number; total: number; accuracy: number }> {
  const acc = new Map<string, { correct: number; total: number; accuracy: number }>();
  for (const r of results) {
    const e = acc.get(r.topicId) ?? { correct: 0, total: 0, accuracy: 0 };
    e.total++;
    if (r.isCorrect) e.correct++;
    acc.set(r.topicId, e);
  }
  for (const e of acc.values()) e.accuracy = e.total === 0 ? 0 : e.correct / e.total;
  return acc;
}

/** Longest run of consecutive wrong (most recent first) per topic. */
export function consecutiveWrongStreak(results: TopicResult[]): Map<string, number> {
  const byTopic = new Map<string, TopicResult[]>();
  for (const r of results) {
    const arr = byTopic.get(r.topicId) ?? [];
    arr.push(r);
    byTopic.set(r.topicId, arr);
  }
  const streaks = new Map<string, number>();
  for (const [topic, arr] of byTopic) {
    const ordered = arr.slice().sort((a, b) => b.loggedAt - a.loggedAt); // newest first
    let streak = 0;
    for (const r of ordered) {
      if (r.isCorrect) break;
      streak++;
    }
    streaks.set(topic, streak);
  }
  return streaks;
}
