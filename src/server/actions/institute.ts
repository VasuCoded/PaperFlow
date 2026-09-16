"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import type { ActionResult } from "@/server/actions/membership";

/**
 * Institute console mutations. The institute is always the session's — never a
 * parameter from the client. RLS and the definer functions enforce the same
 * rules again; the checks here exist to give a clear message.
 */
async function adminContext() {
  const session = await getSession();
  if (!session?.instituteId || session.role !== "institute_admin") return null;
  return { session, instituteId: session.instituteId, supabase: await createServerSupabaseClient() };
}

const DENIED: ActionResult = { ok: false, message: "Institute admin only." };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inviteMember(emailRaw: string, role: "teacher" | "student"): Promise<ActionResult> {
  const ctx = await adminContext();
  if (!ctx) return DENIED;
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, message: "Enter a valid email address." };
  if (role !== "teacher" && role !== "student") return { ok: false, message: "Choose teacher or student." };

  const { error } = await ctx.supabase.from("institute_invites").insert({
    institute_id: ctx.instituteId,
    email,
    role,
    invited_by: ctx.session.userId,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, message: `${email} has already been invited to this institute.` };
    return { ok: false, message: error.message };
  }
  revalidatePath("/institute/members");
  revalidatePath("/institute");
  return { ok: true };
}

export async function revokeInvite(inviteId: string): Promise<ActionResult> {
  const ctx = await adminContext();
  if (!ctx) return DENIED;
  const { error } = await ctx.supabase
    .from("institute_invites")
    .delete()
    .eq("id", inviteId)
    .eq("institute_id", ctx.instituteId)
    .is("accepted_at", null);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/institute/members");
  return { ok: true };
}

export async function changeMemberRole(
  targetEmail: string,
  typedConfirmation: string,
  newRole: "teacher" | "student",
): Promise<ActionResult> {
  const ctx = await adminContext();
  if (!ctx) return DENIED;
  const email = targetEmail.trim().toLowerCase();
  // The typed confirmation is re-checked here, not only in the browser.
  if (typedConfirmation.trim().toLowerCase() !== email) {
    return { ok: false, message: "Type the person's email exactly to confirm." };
  }
  const { error } = await ctx.supabase.rpc("set_member_role", {
    p_institute_id: ctx.instituteId,
    p_target_email: email,
    p_new_role: newRole,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/institute/members");
  revalidatePath("/institute/teachers");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const ctx = await adminContext();
  if (!ctx) return DENIED;
  const { error } = await ctx.supabase.rpc("remove_member", { p_institute_id: ctx.instituteId, p_user_id: userId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/institute/members");
  revalidatePath("/institute/teachers");
  return { ok: true };
}

export async function setTeacherSubject(teacherId: string, classSubjectId: string, assigned: boolean): Promise<ActionResult> {
  const ctx = await adminContext();
  if (!ctx) return DENIED;

  if (assigned) {
    // Only teachers of this institute, and only subjects it has active.
    const [{ data: member }, { data: active }] = await Promise.all([
      ctx.supabase
        .from("institute_members")
        .select("role")
        .eq("institute_id", ctx.instituteId)
        .eq("user_id", teacherId)
        .maybeSingle(),
      ctx.supabase
        .from("my_active_class_subjects")
        .select("class_subject_id")
        .eq("institute_id", ctx.instituteId)
        .eq("class_subject_id", classSubjectId)
        .maybeSingle(),
    ]);
    if (member?.role !== "teacher" && member?.role !== "institute_admin") {
      return { ok: false, message: "That person is not a teacher here." };
    }
    if (!active) return { ok: false, message: "That subject is not active for your institute." };

    const { error } = await ctx.supabase
      .from("teacher_subjects")
      .upsert(
        { institute_id: ctx.instituteId, teacher_id: teacherId, class_subject_id: classSubjectId },
        { onConflict: "institute_id,teacher_id,class_subject_id", ignoreDuplicates: true },
      );
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await ctx.supabase
      .from("teacher_subjects")
      .delete()
      .eq("institute_id", ctx.instituteId)
      .eq("teacher_id", teacherId)
      .eq("class_subject_id", classSubjectId);
    if (error) return { ok: false, message: error.message };
  }
  revalidatePath("/institute/teachers");
  return { ok: true };
}

export async function requestActivation(classSubjectId: string): Promise<ActionResult> {
  const ctx = await adminContext();
  if (!ctx) return DENIED;
  const { error } = await ctx.supabase.from("activation_requests").insert({
    institute_id: ctx.instituteId,
    class_subject_id: classSubjectId,
    requested_by: ctx.session.userId,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "You have already requested this subject. The platform will respond here." };
    return { ok: false, message: error.message };
  }
  revalidatePath("/institute/subjects");
  revalidatePath("/institute");
  return { ok: true };
}
