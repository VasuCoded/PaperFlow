"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { buildPracticeSet, type Candidate, type WrongItem } from "@/server/practice";
import type { Difficulty } from "@/server/generator/types";
import { getStudentSubjects, SUBJECT_COOKIE } from "@/server/data/student";
import { parseOptions } from "@/lib/options";
import { renderRich } from "@/lib/print/math";
import type { ActionResult } from "@/server/actions/membership";

const asDifficulty = (d: string | null | undefined): Difficulty =>
  d === "easy" || d === "hard" ? d : "medium";

/** Remember the subject the student is looking at — only among their own. */
export async function chooseSubject(classSubjectId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Not signed in." };
  const subjects = await getStudentSubjects(session);
  if (!subjects.some((s) => s.classSubjectId === classSubjectId)) {
    return { ok: false, message: "You are not enrolled in that subject." };
  }
  const jar = await cookies();
  jar.set(SUBJECT_COOKIE, classSubjectId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  revalidatePath("/app", "layout");
  return { ok: true };
}

export type LogResult =
  | {
      ok: true;
      practice:
        | { built: true; count: number; topics: string[]; gaps: number }
        | { built: false; reason: string };
    }
  | { ok: false; message: string };

/**
 * Log a paper, then build the practice set from it.
 *
 * The client sends display POSITIONS and the set it says it wrote. log_attempt
 * resolves positions to questions through that set in the database, so the
 * client never names a question id.
 */
export async function logPaper(paperId: string, paperSetId: string | null, wrongPositions: number[]): Promise<LogResult> {
  const session = await getSession();
  if (!session?.instituteId || session.role !== "student") {
    return { ok: false, message: "Only a student can log their own paper." };
  }
  const positions = [...new Set(wrongPositions.filter((n) => Number.isInteger(n) && n >= 0 && n < 500))];

  const supabase = await createServerSupabaseClient();
  const { data: attemptId, error } = await supabase.rpc("log_attempt", {
    p_paper_id: paperId,
    p_paper_set_id: paperSetId ?? undefined,
    p_wrong_positions: positions,
  });
  if (error || !attemptId) {
    return {
      ok: false,
      message: /fetch|network/i.test(error?.message ?? "")
        ? "No connection. Logging needs the internet — nothing was saved, try again when you are online."
        : (error?.message ?? "Could not save."),
    };
  }

  const practice = await buildPracticeFor(attemptId, session.instituteId);
  revalidatePath("/app", "layout");
  return { ok: true, practice };
}

async function buildPracticeFor(
  attemptId: string,
  instituteId: string,
): Promise<{ built: true; count: number; topics: string[]; gaps: number } | { built: false; reason: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, paper_id, papers ( class_subject_id ), attempt_items ( question_id, is_correct )")
    .eq("id", attemptId)
    .eq("institute_id", instituteId)
    .maybeSingle()
    .returns<{ id: string; paper_id: string; papers: { class_subject_id: string } | null; attempt_items: { question_id: string; is_correct: boolean }[] } | null>();
  if (!attempt?.papers) return { built: false, reason: "Could not read the attempt back." };
  const classSubjectId = attempt.papers.class_subject_id;

  const wrongIds = attempt.attempt_items.filter((i) => !i.is_correct).map((i) => i.question_id);
  if (wrongIds.length === 0) {
    return { built: false, reason: "Nothing marked wrong, so there is nothing to practise from this paper." };
  }

  const [wrongQs, eligibility, pool, exposure] = await Promise.all([
    supabase
      .from("questions")
      .select("id, topic_id, chapter_id, strand_id, difficulty, topics ( name )")
      .in("id", wrongIds)
      .returns<{ id: string; topic_id: string | null; chapter_id: string | null; strand_id: string | null; difficulty: string; topics: { name: string } | null }[]>(),
    supabase
      .from("paper_questions")
      .select("question_id, paper_blocks ( paper_sections ( pattern_sections ( practice_eligible ) ) )")
      .eq("paper_id", attempt.paper_id)
      .eq("institute_id", instituteId)
      .in("question_id", wrongIds)
      .returns<{ question_id: string; paper_blocks: { paper_sections: { pattern_sections: { practice_eligible: boolean } | null } | null } | null }[]>(),
    supabase.rpc("eligible_questions", { p_institute_id: instituteId, p_class_subject_id: classSubjectId }),
    supabase.from("question_exposure").select("question_id").eq("institute_id", instituteId),
  ]);

  const eligibleById = new Map(
    (eligibility.data ?? []).map((r) => [r.question_id, r.paper_blocks?.paper_sections?.pattern_sections?.practice_eligible ?? true]),
  );

  const wrongItems: WrongItem[] = (wrongQs.data ?? []).map((q) => ({
    questionId: q.id,
    topicId: q.topic_id,
    chapterId: q.chapter_id ?? "",
    strandId: q.strand_id,
    difficulty: asDifficulty(q.difficulty),
    practiceEligible: eligibleById.get(q.id) ?? true,
  }));

  const candidates: Candidate[] = (pool.data ?? []).map((c) => ({
    id: c.id,
    ownerInstituteId: c.owner_institute_id,
    topicId: c.topic_id,
    chapterId: c.chapter_id ?? "",
    strandId: c.strand_id,
    difficulty: asDifficulty(c.difficulty),
    // `solution` is column-revoked from client roles; treat as present. It is a
    // tiebreak only, so this cannot change which topics are served.
    hasSolution: true,
    stimulusId: c.stimulus_id,
  }));

  const result = buildPracticeSet({
    wrongItems,
    candidates,
    exposedQuestionIds: new Set((exposure.data ?? []).map((e) => e.question_id)),
  });
  if (!result.ok) return { built: false, reason: result.reason };
  if (result.items.length === 0) {
    return { built: false, reason: "There are no fresh questions on those topics yet. Your teacher has been told the bank is thin there." };
  }

  const { error } = await supabase.rpc("save_practice_set", {
    p_attempt_id: attemptId,
    p_items: result.items.map((it, i) => ({ question_id: it.questionId, position: i })),
    p_gaps: result.coverageGaps.map((g) => ({ topic_id: g.topicId, difficulty: g.difficulty, severity: g.severity })),
  });
  if (error) return { built: false, reason: error.message };

  const topicNames = [...new Set((wrongQs.data ?? []).filter((q) => eligibleById.get(q.id) !== false).map((q) => q.topics?.name).filter((x): x is string => !!x))];
  return { built: true, count: result.items.length, topics: topicNames, gaps: result.coverageGaps.length };
}

export async function setPracticeItemDone(itemId: string, done: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.instituteId) return { ok: false, message: "Not signed in." };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("practice_set_items")
    .update({ is_done: done })
    .eq("id", itemId)
    .eq("institute_id", session.instituteId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/app/practice");
  return { ok: true };
}

/** Fields are HTML, rendered on the server (math included) and escaped. */
export type SolutionResult =
  | { ok: true; answerHtml: string | null; solutionHtml: string | null; rubricHtml: string | null; correctHtml: string | null }
  | { ok: false; message: string };

/**
 * Solutions are released only by get_question_solution(), which checks
 * can_read_solution() — an attempt on a paper containing the question, or a
 * practice item for it. Never a client-side filter (BUILD-PLAN 5.7 rule 3).
 */
export async function revealSolution(questionId: string): Promise<SolutionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Not signed in." };
  const supabase = await createServerSupabaseClient();
  const [{ data, error }, { data: q }] = await Promise.all([
    supabase.rpc("get_question_solution", { p_question_id: questionId }),
    supabase.from("questions").select("options").eq("id", questionId).maybeSingle(),
  ]);
  if (error) return { ok: false, message: error.message };
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { ok: false, message: "The solution unlocks once you have attempted this question." };

  const opts = parseOptions((q?.options ?? null) as Parameters<typeof parseOptions>[0]);
  const correctText = row.correct_option ? opts.find((o) => o.key === row.correct_option)?.text : undefined;
  const html = (t: string | null | undefined) => (t ? renderRich(t) : null);
  return {
    ok: true,
    answerHtml: html(row.answer),
    solutionHtml: html(row.solution),
    rubricHtml: html(row.rubric),
    correctHtml: row.correct_option
      ? html(`(${row.correct_option})${correctText ? ` ${correctText}` : ""}`)
      : null,
  };
}
