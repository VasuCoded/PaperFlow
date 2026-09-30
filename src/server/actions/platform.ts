"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import type { ActionResult } from "@/server/actions/membership";
import { confirmsIdentity, loginToEmail, usernameProblem } from "@/lib/identity";
import { createAdminClient } from "@/lib/db/admin";
import { resetPassword } from "@/server/passwords";
import { FIGURE_TOKEN, figureToken } from "@/lib/print/math";

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
  // A username (username account) or an email (Google account).
  const adminRaw = input.firstAdminEmail.trim();
  const adminIsEmail = adminRaw.includes("@") && !adminRaw.startsWith("@");
  if (adminIsEmail ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminRaw) : usernameProblem(adminRaw) !== null) {
    return { ok: false, message: "Enter the first admin's username (or Google email)." };
  }
  const admin = loginToEmail(adminRaw);
  if (name.length < 2) return { ok: false, message: "Give the institute a name." };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { ok: false, message: "The slug may contain lowercase letters, digits and single hyphens." };

  const { data, error } = await supabase.rpc("create_institute", {
    p_name: name,
    p_slug: slug,
    p_contact_email: input.contactEmail.trim() || (adminIsEmail ? admin : ""),
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

/**
 * Rename an institute or change its contact. The owner's update policy on
 * institutes allows it (institutes_update_platform); the code printed on its
 * papers never changes with the name.
 */
export async function updateInstituteAction(instituteId: string, name: string, contactEmail: string): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const clean = name.trim().replace(/\s+/g, " ");
  const contact = contactEmail.trim();
  if (clean.length < 2 || clean.length > 120) return { ok: false, message: "Give the institute a name (2 to 120 characters)." };
  if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return { ok: false, message: "That contact email does not look right." };
  const { data, error } = await supabase
    .from("institutes")
    .update({ name: clean, contact_email: contact || null })
    .eq("id", instituteId)
    .eq("kind", "institute")
    .select("id");
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: "Institute not found." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Remove someone from an institute (remove_member lets the owner remove anyone but an owner). */
export async function platformRemoveMemberAction(instituteId: string, userId: string): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const { error } = await supabase.rpc("remove_member", { p_institute_id: instituteId, p_user_id: userId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
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
  // the activation page, the institute's own page, and the institute's consoles
  revalidatePath("/", "layout");
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
    class_subject_id: string | null;
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
  if (!email.trim()) return { ok: false, message: "Enter a username or an email address." };
  const clean = loginToEmail(email);
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
  // the change shows on other screens; drop this browser's cached copies (next.config staleTimes)
  revalidatePath("/", "layout");
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
  // the change shows on other screens; drop this browser's cached copies (next.config staleTimes)
  revalidatePath("/", "layout");
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
  const { error } = await supabase.rpc("platform_invite", { p_institute_id: instituteId, p_email: loginToEmail(email), p_role: role });
  if (error) return { ok: false, message: error.message };
  // the change shows on other screens; drop this browser's cached copies (next.config staleTimes)
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function platformRevokeInviteAction(inviteId: string): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const { error } = await supabase.rpc("platform_revoke_invite", { p_invite_id: inviteId });
  if (error) return { ok: false, message: error.message };
  // the change shows on other screens; drop this browser's cached copies (next.config staleTimes)
  revalidatePath("/", "layout");
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
  if (!confirmsIdentity(typedConfirmation, email)) {
    return { ok: false, message: "Type the person's username (or email) exactly to confirm." };
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

/** Answer any access request, including making someone an institute admin (migration 0019). */
export async function platformDecideAccessRequest(
  requestId: string,
  approve: boolean,
  role: "institute_admin" | "teacher" | "student" | null,
  reason: string,
): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  if (approve && !role) return { ok: false, message: "Choose a role." };
  if (!approve && reason.trim().length < 3) return { ok: false, message: "Give a reason they will see." };
  const { error } = await supabase.rpc("decide_access_request", {
    p_request_id: requestId,
    p_approve: approve,
    p_role: approve ? (role ?? undefined) : undefined,
    p_reason: approve ? undefined : reason.trim().slice(0, 500),
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/platform/accounts");
  return { ok: true };
}

/** Platform: a temporary password for any username account, looked up by username. */
export async function platformResetPassword(login: string, typedConfirmation: string): Promise<ActionResult & { password?: string }> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const session = await getSession();
  const email = loginToEmail(login);
  if (!confirmsIdentity(typedConfirmation, email)) return { ok: false, message: "Type the person's username exactly to confirm." };
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id, email").eq("email", email).maybeSingle();
  if (!profile) return { ok: false, message: "No account with that username." };
  const res = await resetPassword({
    userId: profile.id,
    targetEmail: profile.email,
    actorId: session!.userId,
    instituteId: null,
    action: "password_reset_by_platform",
  });
  return res.ok ? { ok: true, password: res.password } : { ok: false, message: res.message };
}

const FIGURE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const FIGURE_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Attach a figure (graph, diagram) to a question. The file goes to the private
 * question-assets bucket; a question_assets row records it (RLS: platform owner
 * only); and a [[fig:id]] marker is placed in the body, before or after the
 * text, which is where every screen and the printed paper show it.
 */
export async function attachFigureAction(formData: FormData): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const questionId = String(formData.get("questionId") ?? "");
  const place = formData.get("place") === "before" ? "before" : "after";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose an image file." };
  const ext = FIGURE_TYPES[file.type];
  if (!ext) return { ok: false, message: "Use a PNG, JPG or WebP image." };
  if (file.size > FIGURE_MAX_BYTES) return { ok: false, message: "The image must be 2 MB or smaller." };

  const { data: q } = await supabase.from("questions").select("id, owner_institute_id, body").eq("id", questionId).maybeSingle();
  if (!q) return { ok: false, message: "Question not found." };

  const assetId = crypto.randomUUID();
  const path = `${q.owner_institute_id}/${q.id}/${assetId}.${ext}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage.from("question-assets").upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { ok: false, message: upErr.message };

  const { error: rowErr } = await supabase
    .from("question_assets")
    .insert({ id: assetId, owner_institute_id: q.owner_institute_id, question_id: q.id, storage_path: path, kind: "figure" });
  if (rowErr) {
    await admin.storage.from("question-assets").remove([path]);
    return { ok: false, message: rowErr.message };
  }
  const token = figureToken(assetId);
  const body = place === "before" ? `${token}\n${q.body}` : `${q.body}\n${token}`;
  const { error: qErr } = await supabase.from("questions").update({ body }).eq("id", q.id);
  if (qErr) return { ok: false, message: qErr.message };
  revalidatePath("/platform/questions");
  return { ok: true };
}

/** Remove a figure: its marker from the body, its row, and its file. */
export async function removeFigureAction(assetId: string): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const { data: asset } = await supabase.from("question_assets").select("id, question_id, storage_path").eq("id", assetId).maybeSingle();
  if (!asset) return { ok: false, message: "Figure not found." };
  const { data: q } = await supabase.from("questions").select("id, body").eq("id", asset.question_id).maybeSingle();
  if (q) {
    const body = q.body
      .replace(new RegExp(FIGURE_TOKEN.source, "gi"), (m, id: string) => (id.toLowerCase() === assetId.toLowerCase() ? "" : m))
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const { error } = await supabase.from("questions").update({ body }).eq("id", q.id);
    if (error) return { ok: false, message: error.message };
  }
  const { error: delErr } = await supabase.from("question_assets").delete().eq("id", asset.id);
  if (delErr) return { ok: false, message: delErr.message };
  await createAdminClient().storage.from("question-assets").remove([asset.storage_path]);
  revalidatePath("/platform/questions");
  return { ok: true };
}

/**
 * Delete an institute for good: platform owner, suspended institute, slug
 * typed (platform_delete_institute checks all three). Its private question
 * figures are removed from storage afterwards; paths are read first, pinned
 * to this institute, because the rows go with it.
 */
export async function deleteInstituteAction(instituteId: string, typedSlug: string): Promise<ActionResult> {
  const supabase = await ownerClient();
  if (!supabase) return DENIED;
  const admin = createAdminClient();
  const { data: assets } = await admin.from("question_assets").select("storage_path").eq("owner_institute_id", instituteId);
  const { error } = await supabase.rpc("platform_delete_institute", { p_institute_id: instituteId, p_confirm_slug: typedSlug });
  if (error) return { ok: false, message: error.message };
  const paths = (assets ?? []).map((a) => a.storage_path);
  if (paths.length) await admin.storage.from("question-assets").remove(paths);
  revalidatePath("/", "layout");
  return { ok: true };
}
