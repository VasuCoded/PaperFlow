import { notFound, redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { brandFor, navFor, type Area } from "@/lib/nav";
import { canAccess, getSession, type Session } from "@/server/session";
import { getNavBadges } from "@/server/data/badges";
import { Logo } from "@/components/brand/Logo";
import { Icon } from "@/components/ui/Icon";
import { InstituteLinks, InstituteSwitcher } from "./InstituteSwitcher";
import { PendingInvitesNotice } from "./PendingInvites";
import { AccessRequestsNotice } from "./AccessRequestsNotice";
import { MobileBar, NavClose, NavScrim, PageTitle, RailNav } from "./RailNav";
import { SignOutButton } from "./SignOutButton";

const ROLE_LABEL: Record<string, string> = {
  owner: "Platform owner",
  institute_admin: "Institute admin",
  teacher: "Teacher",
  student: "Student",
};

export function initialsOf(name: string): string {
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "•"
  );
}

/**
 * The frame of a desk console (sidebar, banners), rendered once by the area's
 * layout: /platform, /institute and /teacher each have one.
 *
 * Because it is a layout, it stays on screen when someone clicks to another
 * page in the same area: only the content area reloads, and the area's
 * loading.tsx fills it at once. Moving between pages also no longer re-runs the
 * frame's queries on the server. The menu's counts are started here but never
 * waited for (see RailNav).
 *
 * On a phone the sidebar becomes a drawer behind a menu button in a top bar.
 *
 * Access: this refuses anyone who may not use the area (404, not 403: BUILD-PLAN
 * C2 item 4), but a layout is not a security boundary on its own, since a crafted
 * request can ask for a page without its layout. Every page therefore ALSO
 * checks, through AppShell. The session is resolved once per request (cache),
 * so the second check costs nothing.
 */
export async function ConsoleFrame({ area, children }: { area: Area; children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.memberships.length === 0) redirect("/welcome");
  if (!canAccess(area, session)) notFound();

  const groups = navFor(area, session.role, session.modules);
  const badges = getNavBadges(session, area);
  const brand = brandFor(area, session.role);

  return (
    <div className="wrap">
      <div className="appshell navshell">
        <MobileBar>
          <Logo size={26} />
        </MobileBar>
        <NavScrim />
        <nav className="rail" aria-label="Main menu">
          <div className="railbrand">
            <Logo size={30} sub={brand} />
            <NavClose />
          </div>
          <RailNav groups={groups} badges={badges} />
          <RailFoot session={session} area={area} />
        </nav>

        <div className="content">
          {/* rarely shown: never make the page wait for them. Inside the content
              area, so a banner never makes the whole window scroll. */}
          <Suspense fallback={null}>
            <PendingInvitesNotice />
          </Suspense>
          <Suspense fallback={null}>
            <AccessRequestsNotice session={session} area={area} />
          </Suspense>
          <PageTitle groups={groups} />
          {children}
        </div>
      </div>
    </div>
  );
}

function RailFoot({ session, area }: { session: Session; area: Area }) {
  const current = session.memberships.find((m) => m.instituteId === session.instituteId);
  const name = session.fullName ?? session.email;
  const role = area === "platform" ? ROLE_LABEL.owner! : (ROLE_LABEL[session.role ?? ""] ?? "");
  const tenants = session.memberships.filter((m) => m.kind === "institute");
  const single = area !== "platform" && current && tenants.length <= 1;
  return (
    <div className="railfoot">
      <div className="whocard">
        <span className="whoav" aria-hidden="true">{initialsOf(name)}</span>
        <span className="whotext">
          <b>{name}</b>
          <span className="role">
            {role}
            {single ? ` · ${current.instituteName}` : ""}
          </span>
        </span>
      </div>

      {area !== "platform" && current && tenants.length > 1 && (
        <InstituteSwitcher memberships={session.memberships} current={current.instituteId} />
      )}
      {area === "platform" && <InstituteLinks memberships={session.memberships} />}
      {area !== "platform" && session.isPlatformOwner && (
        <div className="footlinks">
          <Link href="/platform">
            <Icon name="shield" size={15} /> Platform console
          </Link>
        </div>
      )}

      <div className="footrow">
        <Link href="/app/me#password" className="btn sm ghost">
          <Icon name="lock" size={14} /> Password
        </Link>
        <SignOutButton className="btn sm ghost" />
      </div>
    </div>
  );
}
