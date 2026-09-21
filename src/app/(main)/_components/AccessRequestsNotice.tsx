import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { Session } from "@/server/session";

/**
 * "N people are asking to join" — for the platform owner on platform screens,
 * and for an institute admin on their console. A count only: the list itself
 * (names and notes) is on the page it links to.
 */
export async function AccessRequestsNotice({ session, area }: { session: Session; area: "platform" | "institute" | "teacher" }) {
  const supabase = await createServerSupabaseClient();
  let count = 0;
  let href = "";

  if (area === "platform" && session.isPlatformOwner) {
    const { data } = await supabase.rpc("platform_pending_access_count");
    count = data ?? 0;
    href = "/platform/accounts";
  } else if (area !== "platform" && session.role === "institute_admin" && session.instituteId) {
    const { count: n } = await supabase
      .from("access_requests")
      .select("id", { count: "exact", head: true })
      .eq("institute_id", session.instituteId)
      .eq("status", "pending");
    count = n ?? 0;
    href = "/institute/members#requests";
  }

  if (count === 0) return null;
  return (
    <div className="notice" role="status">
      <b>
        {count === 1 ? "1 person is" : `${count} people are`} asking to join.
      </b>{" "}
      <Link href={href} style={{ color: "var(--pen)" }}>
        Review {count === 1 ? "the request" : "them"} →
      </Link>
    </div>
  );
}
