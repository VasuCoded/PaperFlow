"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import type { ActionResult } from "@/server/actions/membership";

function deskRole(role: string | null): boolean {
  return role === "teacher" || role === "institute_admin";
}

/**
 * Create a batch: a group of students with any number of subjects (a coaching
 * batch usually studies several). A teacher may pick only subjects they teach;
 * an admin any active subject. RLS on batches and batch_subjects enforces the
 * same; the join code is generated in the database, unique everywhere.
 */
export async function createBatch(input: { name: string; note: string; subjectIds: string[] }): Promise<ActionResult & { batchId?: string }> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };

  const clean = input.name.trim().slice(0, 60);
  if (clean.length < 2) return { ok: false, message: "Give the batch a name." };
  const subjectIds = [...new Set(input.subjectIds)];
  if (subjectIds.length === 0) return { ok: false, message: "Choose at least one subject." };

  const supabase = await createServerSupabaseClient();
  const { data: batch, error } = await supabase
    .from("batches")
    .insert({
      institute_id: session.instituteId,
      name: clean,
      note: input.note.trim().slice(0, 120) || null,
      teacher_id: session.userId,
      join_code: "", // replaced by the batches_set_join_code trigger
      active: true,
    })
    .select("id")
    .single();
  if (error || !batch) return { ok: false, message: error?.message ?? "Could not create the batch." };

  const { error: subErr } = await supabase
    .from("batch_subjects")
    .insert(subjectIds.map((cs) => ({ institute_id: session.instituteId!, batch_id: batch.id, class_subject_id: cs })));
  if (subErr) {
    await supabase.from("batches").delete().eq("id", batch.id).eq("institute_id", session.instituteId);
    return {
      ok: false,
      message: subErr.code === "42501" ? "You can only add subjects you teach." : subErr.message,
    };
  }
  revalidatePath("/", "layout");
  return { ok: true, batchId: batch.id };
}

/** Rename a batch or change its note (timing, room, anything). */
export async function updateBatch(batchId: string, name: string, note: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };
  const clean = name.trim().slice(0, 60);
  if (clean.length < 2) return { ok: false, message: "Give the batch a name." };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("batches")
    .update({ name: clean, note: note.trim().slice(0, 120) || null })
    .eq("id", batchId)
    .eq("institute_id", session.instituteId)
    .select("id");
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: "You can only change batches you run." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Add a subject to a batch, or take one off (papers already set are kept). */
export async function setBatchSubject(batchId: string, classSubjectId: string, on: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };
  const supabase = await createServerSupabaseClient();
  if (on) {
    const { error } = await supabase
      .from("batch_subjects")
      .insert({ institute_id: session.instituteId, batch_id: batchId, class_subject_id: classSubjectId });
    if (error && error.code !== "23505") {
      return { ok: false, message: error.code === "42501" ? "You can only add subjects you teach, to batches you run." : error.message };
    }
  } else {
    const { data, error } = await supabase
      .from("batch_subjects")
      .delete()
      .eq("institute_id", session.instituteId)
      .eq("batch_id", batchId)
      .eq("class_subject_id", classSubjectId)
      .select("batch_id");
    if (error) return { ok: false, message: error.message };
    if (!data?.length) return { ok: false, message: "You can only remove subjects you teach." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Admin: who teaches this subject in this batch (shown on the batch). */
export async function setBatchSubjectTeacher(batchId: string, classSubjectId: string, teacherId: string | null): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.instituteId || session.role !== "institute_admin") return { ok: false, message: "Institute admins only." };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("batch_subjects")
    .update({ teacher_id: teacherId })
    .eq("institute_id", session.instituteId)
    .eq("batch_id", batchId)
    .eq("class_subject_id", classSubjectId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/teacher/batches");
  return { ok: true };
}

/** Put students of the institute straight into a batch (no code needed). */
export async function addStudentsToBatch(batchId: string, studentIds: string[]): Promise<ActionResult & { added?: number }> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };
  if (studentIds.length === 0) return { ok: false, message: "Choose at least one student." };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("batch_add_students", { p_batch_id: batchId, p_student_ids: studentIds });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true, added: data ?? 0 };
}

export async function removeStudentFromBatch(batchId: string, studentId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("batch_remove_student", { p_batch_id: batchId, p_student_id: studentId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function rotateJoinCode(batchId: string): Promise<ActionResult & { code?: string }> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("rotate_join_code", { p_batch_id: batchId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true, code: data ?? undefined };
}

export async function setBatchActive(batchId: string, active: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("batches")
    .update({ active })
    .eq("id", batchId)
    .eq("institute_id", session.instituteId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/teacher/batches");
  return { ok: true };
}

/**
 * Flag a question. Per BUILD-PLAN 5.3 a flag suppresses the question for THIS
 * institute only, straight away; it never changes the shared question's status.
 */
export async function flagQuestion(questionId: string, reason: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };
  const why = reason.trim().slice(0, 500);
  if (why.length < 3) return { ok: false, message: "Say briefly what is wrong with it." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("question_flags").insert({
    institute_id: session.instituteId,
    question_id: questionId,
    raised_by: session.userId,
    reason: why,
    status: "open",
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/teacher/flagged");
  return { ok: true };
}

export async function withdrawFlag(flagId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("withdraw_flag", { p_flag_id: flagId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/teacher/flagged");
  return { ok: true };
}

/**
 * Show a paper to its students, or hide it again. A paper is saved hidden
 * (released_at null) because it is usually set days before the test; the
 * teacher releases it once the test has been conducted. can_access_paper()
 * enforces it for students; the papers_write policy decides who may change it.
 * Hiding is refused once anyone has logged the paper.
 */
export async function setPaperReleased(paperId: string, released: boolean): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };
  const supabase = await createServerSupabaseClient();
  if (!released) {
    const { count } = await supabase
      .from("attempts")
      .select("id", { count: "exact", head: true })
      .eq("institute_id", session.instituteId)
      .eq("paper_id", paperId);
    if ((count ?? 0) > 0) return { ok: false, message: "Students have already logged this paper, so it stays visible." };
  }
  const { data, error } = await supabase
    .from("papers")
    .update({ released_at: released ? new Date().toISOString() : null })
    .eq("id", paperId)
    .eq("institute_id", session.instituteId)
    .select("id");
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: "Paper not found, or not yours to change." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Delete a batch (an admin, or a teacher who runs it). Its students leave it;
 * its papers are kept for the record but taken out of students' view (see
 * delete_batch). Returns how many papers were kept.
 */
export async function deleteBatch(batchId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("delete_batch", { p_batch_id: batchId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Delete a paper (an admin, or the teacher who set it). Once students have
 * logged it their logs go too, so the paper's printed code must be typed.
 */
export async function deletePaper(paperId: string, confirmCode?: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("delete_paper", { p_paper_id: paperId, p_confirm_code: confirmCode ?? undefined });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
