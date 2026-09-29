import { notFound, redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { brandFor, navFor, type Area } from "@/lib/nav";
import { canAccess, getSession, type Session } from "@/server/session";
import { InstituteLinks, InstituteSwitcher } from "./InstituteSwitcher";
import { PendingInvitesNotice } from "./PendingInvites";
import { AccessRequestsNotice } from "./AccessRequestsNotice";
import { RailNav } from "./RailNav";
import { SignOutButton } from "./SignOutButton";

const ROLE_LABEL: Record<string, string> = {
  owner: "Platform owner",
  institute_admin: "Institute admin",
  teacher: "Teacher",
  student: "Student",
};

/**
 * The frame of a desk console (sidebar, banners), rendered once by the area's
 * layout: /platform, /institute and /teacher each have one.
 *
 * Because it is a layout, it stays on screen when someone clicks to another
 * page in the same area: only the content area reloads, and the area's
 * loading.tsx fills it at once. Moving between pages also no longer re-runs the
 * frame's queries on the server.
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

  return (
    <div className="wrap">
      {/* rarely shown: never make the page wait for them */}
      <Suspense fallback={null}>
        <PendingInvitesNotice />
      </Suspense>
      <Suspense fallback={null}>
        <AccessRequestsNotice session={session} area={area} />
      </Suspense>

      <div className="appshell">
        <nav className="rail">
          <div className="brand">
            PaperFlow
            <span>{brandFor(area, session.role)}</span>
          </div>
          <RailNav groups={navFor(area, session.role)} />
          <RailFoot session={session} area={area} />
        </nav>

        <div className="content">{children}</div>
      </div>
    </div>
  );
}

function RailFoot({ session, area }: { session: Session; area: Area }) {
  const current = session.memberships.find((m) => m.instituteId === session.instituteId);
  return (
    <div className="railfoot">
      Signed in as
      <br />
      <b>{session.fullName ?? session.email}</b>
      <br />
      <span className="role">
        {(area === "platform" ? ROLE_LABEL.owner! : (ROLE_LABEL[session.role ?? ""] ?? "")).toUpperCase()}
      </span>
      {area === "platform" && <InstituteLinks memberships={session.memberships} />}
      {area !== "platform" && session.isPlatformOwner && (
        <div style={{ marginTop: 8 }}>
          <Link href="/platform" style={{ fontSize: 11 }}>Platform console →</Link>
        </div>
      )}
      {area !== "platform" && current && (
        <>
          <br />
          {session.memberships.filter((m) => m.kind === "institute").length > 1 ? (
            <InstituteSwitcher memberships={session.memberships} current={current.instituteId} />
          ) : (
            <span style={{ fontSize: 11 }}>{current.instituteName}</span>
          )}
        </>
      )}
      <div style={{ marginTop: 8 }}>
        <Link href="/app/me#password" style={{ fontSize: 11 }}>Change password</Link>
      </div>
      <div style={{ marginTop: 10 }}>
        <SignOutButton />
      </div>
    </div>
  );
}
