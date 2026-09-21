"use server";

import { createAdminClient } from "@/lib/db/admin";
import { normaliseUsername, passwordProblem, usernameProblem, usernameToEmail } from "@/lib/identity";
import type { ActionResult } from "@/server/actions/membership";

/**
 * Create a username account (migration 0019). The account grants nothing: no
 * institute, no role. The new person then asks an institute for access, or
 * enters a batch join code.
 *
 * Created server-side with the service role so the synthetic address is
 * marked confirmed (it can never receive mail). The browser signs in right
 * after, from the user's own connection, so Supabase's per-IP sign-in limits
 * apply to the person and not to our server.
 */
export async function createAccount(input: {
  fullName: string;
  username: string;
  password: string;
  /** honeypot: a real person never fills this in */
  website?: string;
}): Promise<ActionResult> {
  if (input.website) return { ok: false, message: "Could not create the account." };

  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 2 || fullName.length > 80) return { ok: false, message: "Enter your full name." };
  const nameProblem = usernameProblem(input.username);
  if (nameProblem) return { ok: false, message: nameProblem };
  const pwProblem = passwordProblem(input.password);
  if (pwProblem) return { ok: false, message: pwProblem };

  const username = normaliseUsername(input.username);
  const admin = createAdminClient();

  const { data: taken } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken) return { ok: false, message: "That username is taken. Try another." };

  const { error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password: input.password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName },
  });
  if (error) {
    // A race with someone taking the same name a moment earlier lands here.
    if (/already|registered|exists|duplicate|unique/i.test(error.message)) {
      return { ok: false, message: "That username is taken. Try another." };
    }
    return { ok: false, message: "Could not create the account. Please try again." };
  }
  return { ok: true };
}
