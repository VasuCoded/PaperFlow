import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { brandFor, isActive, navFor, type Area } from "@/lib/nav";
import { canAccess, getSession, type Session } from "@/server/session";
import { InstituteLinks, InstituteSwitcher } from "./InstituteSwitcher";
import { PendingInvitesNotice } from "./PendingInvites";
import { AccessRequestsNotice } from "./AccessRequestsNotice";
import { SignOutButton } from "./SignOutButton";

export type { Area };

const ROLE_LABEL: Record<string, string> = {
  owner: "Platform owner",
  institute_admin: "Institute admin",
  teacher: "Teacher",
  student: "Student",
};

/**
 * Guarded shell for the desk-based areas.
 *
 * Unauthorised access returns 404, not 403 (BUILD-PLAN C2 item 4) — a user
 * without access should not be able to map which routes exist. The role check
 * is done here, server-side, from the database, never from a JWT claim.
 */
export async function AppShell({
  area,
  pathname,
  children,
  split = false,
}: {
  area: Area;
  pathname: string;
  children: ReactNode;
  split?: boolean;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.memberships.length === 0) redirect("/welcome");
  if (!canAccess(area, session)) notFound();

  return (
    <div className="wrap">
      <PendingInvitesNotice />
      <AccessRequestsNotice session={session} area={area} />

      <div className="appshell">
        <nav className="rail">
          <div className="brand">
            PaperFlow
            <span>{brandFor(area, session.role)}</span>
          </div>
          {navFor(area, session.role).map((group, gi) => (
            <Fragment key={group.title ?? gi}>
              {group.title && <div className="navgroup">{group.title}</div>}
              {group.items.map((n) => (
                <Link key={n.href} href={n.href} className={`navitem${isActive(pathname, n) ? " on" : ""}`}>
                  <span>{n.label}</span>
                </Link>
              ))}
            </Fragment>
          ))}
          <RailFoot session={session} area={area} />
        </nav>

        <div className={split ? "content split" : "content"}>{children}</div>
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
