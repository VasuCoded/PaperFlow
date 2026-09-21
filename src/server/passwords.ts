import "server-only";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/db/admin";
import { isUsernameEmail, passwordProblem } from "@/lib/identity";

// No 0/o, 1/l/i: a temporary password is read aloud or copied off a screen.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** A readable temporary password like "kq7m-4tx9-pw2d" (always has a letter and a digit). */
export function temporaryPassword(): string {
  for (;;) {
    const groups = Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""));
    const pw = groups.join("-");
    if (passwordProblem(pw) === null) return pw;
  }
}

/**
 * Set a new password for a username account and log who did it. Callers must
 * have authorised the reset (institute admin of a member, or the platform
 * owner). Google accounts have no PaperFlow password and are refused.
 */
export async function resetPassword(opts: {
  userId: string;
  targetEmail: string;
  actorId: string;
  instituteId: string | null;
  action: "password_reset_by_institute_admin" | "password_reset_by_platform";
}): Promise<{ ok: true; password: string } | { ok: false; message: string }> {
  if (!isUsernameEmail(opts.targetEmail)) {
    return { ok: false, message: "This person signs in with Google, so there is no PaperFlow password to reset." };
  }
  const admin = createAdminClient();
  const password = temporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(opts.userId, { password });
  if (error) return { ok: false, message: "Could not reset the password. Please try again." };
  await admin.from("platform_access_log").insert({
    actor: opts.actorId,
    institute_id: opts.instituteId,
    action: opts.action,
    target_table: "auth.users",
    target_id: opts.userId,
    detail: "temporary password issued",
  });
  return { ok: true, password };
}
