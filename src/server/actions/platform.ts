"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import type { ActionResult } from "@/server/actions/membership";

/**
 * Platform console mutations. Each checks the platform owner here for a clear
 * message; the database functions check again, and they are the ones that
 * count.
 */
async function ownerClient() {
  const session = await getSession();
  if (!session?.isPlatformOwner) return null;
  return createServerSupabaseClient();
}

const DENIED: ActionResult = { ok: false, message: "Platform owner only." };

export async function createInstituteAction(input: {
  name: string;
  slug: string;
  contactEmail: string;
  firstAdminEmail: string;
}): Promise<ActionResult & { instituteId?: string }> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;

  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  const admin = input.firstAdminEmail.trim().toLowerCase();
  if (name.length < 2) return { ok: false, message: "Give the institute a name." };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { ok: false, message: "The slug may contain lowercase letters, digits and single hyphens." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin)) return { ok: false, message: "Enter the first admin's email address." };

  const { data, error } = await supabase.rpc("create_institute", {
    p_name: name,
    p_slug: slug,
    p_contact_email: input.contactEmail.trim() || admin,
    p_first_admin_email: admin,
  });
  if (error) {
    return { ok: false, message: /duplicate|unique/i.test(error.message) ? "That slug is already taken." : error.message };
  }
  revalidatePath("/platform/institutes");
  return { ok: true, instituteId: data ?? undefined };
}

export async function setInstituteStatusAction(instituteId: string, status: "active" | "suspended"): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const { error } = await supabase.rpc("platform_set_institute_status", { p_institute_id: instituteId, p_status: status });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/platform/institutes", "layout");
  return { ok: true };
}

export async function reviewQuestionAction(
  questionId: string,
  decision: "approve" | "reject" | "retire",
  promoteToShared = false,
): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const { error } = await supabase.rpc("platform_review_question", {
    p_question_id: questionId,
    p_decision: decision,
    p_promote_to_shared: promoteToShared,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/platform/bank");
  return { ok: true };
}

export async function setActivationAction(instituteId: string, classSubjectId: string, active: boolean): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const { error } = await supabase.rpc("platform_set_activation", {
    p_institute_id: instituteId,
    p_class_subject_id: classSubjectId,
    p_active: active,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/platform/activation");
  return { ok: true };
}

export async function setBankStatusAction(classSubjectId: string, status: "planned" | "seeding" | "ready"): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const { error } = await supabase.from("class_subjects").update({ bank_status: status }).eq("id", classSubjectId);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/platform/activation");
  return { ok: true };
}

export async function decideRequestAction(requestId: string, approve: boolean, reason: string): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  if (!approve && reason.trim().length < 5) {
    return { ok: false, message: "Give the institute a reason they can act on." };
  }
  const { error } = await supabase.rpc("decide_activation_request", {
    p_request_id: requestId,
    p_approve: approve,
    p_reason: approve ? undefined : reason.trim().slice(0, 500),
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/platform/requests");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Support (C2b item 6). Every function below is audited in the database and
// requires a reason there; the checks here only give a clearer message.
// ---------------------------------------------------------------------------

export interface SupportLookup {
  user: { id: string; email: string; full_name: string | null } | null;
  memberships: { institute_id: string; institute_name: string; institute_status: string; role: string; since: string }[];
  enrolments: {
    institute_id: string;
    institute_name: string;
    batch_id: string;
    batch_name: string;
    class_subject_id: string;
    label: string;
    other_batches: { id: string; name: string }[];
  }[];
  attempts: {
    id: string;
    institute_id: string;
    institute_name: string;
    paper_id: string;
    paper_title: string;
    set_id: string | null;
    set_label: string | null;
    logged_at: string;
    wrong: number;
    sets: { id: string; label: string }[];
  }[];
  invites: { id: string; institute_id: string; institute_name: string; role: string; created_at: string }[];
}

const REASON_MIN = 5;
const needsReason = (reason: string): ActionResult | null =>
  reason.trim().length < REASON_MIN ? { ok: false, message: "Give a reason (at least five characters). It is stored in the audit log." } : null;

export async function supportLookupAction(email: string): Promise<ActionResult & { result?: SupportLookup }> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { ok: false, message: "Enter a full email address." };
  const { data, error } = await supabase.rpc("platform_support_lookup", { p_email: clean });
  if (error) return { ok: false, message: error.message };
  return { ok: true, result: data as unknown as SupportLookup };
}

export async function correctAttemptSetAction(attemptId: string, correctSetId: string, reason: string): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const missing = needsReason(reason);
  if (missing) return missing;
  const { error } = await supabase.rpc("platform_correct_attempt_set", {
    p_attempt_id: attemptId,
    p_correct_set_id: correctSetId,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function moveStudentAction(instituteId: string, studentId: string, toBatchId: string, reason: string): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const missing = needsReason(reason);
  if (missing) return missing;
  const { error } = await supabase.rpc("platform_move_student", {
    p_institute_id: instituteId,
    p_student_id: studentId,
    p_to_batch_id: toBatchId,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function retireQuestionAction(questionId: string, reason: string): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(questionId.trim())) {
    return { ok: false, message: "Paste the question's id (a UUID)." };
  }
  const missing = needsReason(reason);
  if (missing) return missing;
  const { error } = await supabase.rpc("platform_retire_question", { p_question_id: questionId.trim(), p_reason: reason.trim() });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/platform/support");
  return { ok: true };
}

export async function resolveFlagAction(flagId: string, status: "resolved" | "dismissed", note: string): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const missing = needsReason(note);
  if (missing) return missing;
  const { error } = await supabase.rpc("platform_resolve_flag", { p_flag_id: flagId, p_status: status, p_note: note.trim() });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/platform/support");
  return { ok: true };
}

export async function listInvitesAction(
  instituteId: string,
): Promise<ActionResult & { invites?: { id: string; email: string; role: string; created_at: string }[] }> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const { data, error } = await supabase.rpc("platform_list_invites", { p_institute_id: instituteId });
  if (error) return { ok: false, message: error.message };
  return { ok: true, invites: data ?? [] };
}

export async function platformInviteAction(
  instituteId: string,
  email: string,
  role: "institute_admin" | "teacher" | "student",
): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const { error } = await supabase.rpc("platform_invite", { p_institute_id: instituteId, p_email: email, p_role: role });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function platformRevokeInviteAction(inviteId: string): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const { error } = await supabase.rpc("platform_revoke_invite", { p_invite_id: inviteId });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** Role change by the platform owner (the only way to make an institute admin of an existing member). */
export async function platformSetRoleAction(
  instituteId: string,
  email: string,
  typedConfirmation: string,
  role: "institute_admin" | "teacher" | "student",
): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  if (typedConfirmation.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return { ok: false, message: "Type the person's email exactly to confirm." };
  }
  const { error } = await supabase.rpc("set_member_role", {
    p_institute_id: instituteId,
    p_target_email: email.trim().toLowerCase(),
    p_new_role: role,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/platform/institutes/${instituteId}`);
  return { ok: true };
}
