"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import type { ActionResult } from "@/server/actions/membership";

function deskRole(role: string | null): boolean {
  return role === "teacher" || role === "institute_admin";
}

/**
 * Create a batch. The class-subject must be one this person teaches (RLS on
 * batches enforces the same rule); the join code is generated in the database
 * so it is unique across every institute.
 */
export async function createBatch(name: string, classSubjectId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };

  const clean = name.trim().slice(0, 60);
  if (clean.length < 2) return { ok: false, message: "Give the batch a name." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("batches").insert({
    institute_id: session.instituteId,
    name: clean,
    class_subject_id: classSubjectId,
    teacher_id: session.userId,
    join_code: "", // replaced by the batches_set_join_code trigger
    active: true,
  });
  if (error) {
    return {
      ok: false,
      message: error.code === "42501"
        ? "You can only create batches for subjects you are assigned."
        : error.message,
    };
  }
  revalidatePath("/teacher/batches");
  return { ok: true };
}

export async function rotateJoinCode(batchId: string): Promise<ActionResult & { code?: string }> {
  const session = await getSession();
  if (!session?.instituteId || !deskRole(session.role)) return { ok: false, message: "Not allowed." };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("rotate_join_code", { p_batch_id: batchId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/teacher/batches");
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
