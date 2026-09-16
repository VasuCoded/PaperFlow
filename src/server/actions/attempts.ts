"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import type { ActionResult } from "@/server/actions/membership";

/**
 * Teacher override for a student who logged against the wrong set (BUILD-PLAN
 * 3.4). The remap, the set change and dropping the practice set built off the
 * wrong mapping all happen inside correct_attempt_set, in one transaction.
 */
export async function correctAttemptSet(attemptId: string, correctSetId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || (session.role !== "teacher" && session.role !== "institute_admin")) {
    return { ok: false, message: "Only a teacher can correct a set." };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("correct_attempt_set", {
    p_attempt_id: attemptId,
    p_correct_set_id: correctSetId,
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/teacher/papers", "layout");
  return { ok: true };
}
