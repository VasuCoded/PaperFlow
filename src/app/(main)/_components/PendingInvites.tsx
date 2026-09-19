import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/db/server";

/**
 * Someone who already belongs to one institute and is invited to another would
 * otherwise never see the invitation: /welcome sends members to their home
 * screen. This notice appears on every signed-in screen until it is dealt with.
 * my_pending_invites is a definer function matched on the verified email.
 */
export async function PendingInvitesNotice({ variant = "console" }: { variant?: "console" | "student" }) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("my_pending_invites");
  const invites = data ?? [];
  if (invites.length === 0) return null;

  const names = [...new Set(invites.map((i) => i.institute_name))];
  const text = (
    <>
      <b>
        {invites.length === 1 ? "An invitation is" : `${invites.length} invitations are`} waiting
      </b>{" "}
      from {names.join(", ")}.{" "}
      <Link href="/welcome?join=1" style={{ color: "var(--pen)" }}>
        Review {invites.length === 1 ? "it" : "them"} →
      </Link>
    </>
  );
  return variant === "student" ? (
    <div className="m-banner" role="status">{text}</div>
  ) : (
    <div className="notice" role="status">{text}</div>
  );
}
