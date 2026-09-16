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
