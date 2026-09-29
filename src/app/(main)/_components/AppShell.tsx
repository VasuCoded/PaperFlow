import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import type { Area } from "@/lib/nav";
import { canAccess, getSession } from "@/server/session";

export type { Area };

/**
 * Every desk-console page wraps its content in this. The visible frame (sidebar,
 * banners) comes from the area's layout (ConsoleFrame); this is the page's own
 * access check, which must not be left to the layout alone (see ConsoleFrame).
 *
 * Unauthorised access returns 404, not 403 (BUILD-PLAN C2 item 4), so a user
 * without access cannot map which routes exist. The role is read server-side
 * from the database, never from a JWT claim.
 *
 * split: the page is a two-column workspace (the paper builder) and fills the
 * content area edge to edge.
 */
export async function AppShell({
  area,
  children,
  split = false,
}: {
  area: Area;
  children: ReactNode;
  split?: boolean;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.memberships.length === 0) redirect("/welcome");
  if (!canAccess(area, session)) notFound();

  return split ? <div className="split-root">{children}</div> : <>{children}</>;
}
