"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession, INSTITUTE_COOKIE_NAME } from "@/server/session";

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/**
 * Switch which institute the session acts within. Only ever a preference among
 * institutes the caller already belongs to — validated here, and validated
 * again in getSession(), so it can never widen access.
 */
export async function switchInstitute(instituteId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Not signed in." };

  const allowed = session.memberships.some((m) => m.instituteId === instituteId);
  if (!allowed) return { ok: false, message: "You are not a member of that institute." };

  const jar = await cookies();
  jar.set(INSTITUTE_COOKIE_NAME, instituteId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOutAction(): Promise<never> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  const jar = await cookies();
  jar.delete(INSTITUTE_COOKIE_NAME);
  redirect("/login");
}

/** Accept an invitation. The RPC matches the caller's verified email itself. */
export async function acceptInvite(inviteId: string): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("accept_invite", { p_invite_id: inviteId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export interface JoinPreview {
  batchId: string;
  batchName: string;
  instituteId: string;
  instituteName: string;
  classSubjectId: string;
  subjectName: string;
  className: string;
  alreadyEnrolledBatch: string | null;
}

/**
 * Look up a join code WITHOUT joining. The institute name is echoed back before
 * the student confirms — that is what stops a mistyped code putting them in the
 * wrong institute (BUILD-PLAN C2 item 7).
 */
export async function peekJoinCode(
  code: string,
): Promise<{ ok: true; preview: JoinPreview } | { ok: false; message: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("peek_join_code", {
    p_code: code.trim().toUpperCase(),
  });
  if (error) return { ok: false, message: error.message };

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return { ok: false, message: "No active batch has that code. Check it with your teacher." };
  }
  return {
    ok: true,
    preview: {
      batchId: row.batch_id,
      batchName: row.batch_name,
      instituteId: row.institute_id,
      instituteName: row.institute_name,
      classSubjectId: row.class_subject_id,
      subjectName: row.subject_name,
      className: row.class_name,
      alreadyEnrolledBatch: row.already_enrolled_batch,
    },
  };
}

/** Commit the join. Writes the student membership and the enrolment. */
export async function joinBatch(code: string): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("join_batch", { p_code: code.trim().toUpperCase() });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
