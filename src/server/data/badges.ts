import "server-only";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { Area } from "@/lib/nav";
import type { Session } from "@/server/session";

export type NavBadges = Record<string, number>;

/**
 * The counts beside menu items ("Review queue 12"). The console frame starts
 * this without waiting for it and hands the promise to the menu, which shows
 * each count when it arrives: the page never waits on these. Any failure just
 * means no count.
 */
export async function getNavBadges(session: Session, area: Area): Promise<NavBadges> {
  try {
    const supabase = await createServerSupabaseClient();
    if (area === "platform" && session.isPlatformOwner) {
      const [access, requests, review] = await Promise.all([
        supabase.rpc("platform_pending_access_count"),
        supabase.rpc("platform_activation_requests"),
        supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", "staging"),
      ]);
      return {
        access: access.data ?? 0,
        subjects: (requests.data ?? []).filter((r) => r.status === "pending").length,
        review: review.count ?? 0,
      };
    }
    if (session.role === "institute_admin" && session.instituteId) {
      const { count } = await supabase
        .from("access_requests")
        .select("id", { count: "exact", head: true })
        .eq("institute_id", session.instituteId)
        .eq("status", "pending");
      return { joins: count ?? 0 };
    }
  } catch {
    // no counts
  }
  return {};
}
