import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { canAccess, getSession, type Session } from "@/server/session";
import { InstituteLinks, InstituteSwitcher } from "./InstituteSwitcher";
import { PendingInvitesNotice } from "./PendingInvites";
import { SignOutButton } from "./SignOutButton";

export type Area = "platform" | "institute" | "teacher";

const ROLE_LABEL: Record<string, string> = {
  owner: "Platform owner",
  institute_admin: "Institute admin",
  teacher: "Teacher",
  student: "Student",
};

const NAV: Record<Area, { href: string; label: string }[]> = {
  platform: [
    { href: "/platform", label: "Overview" },
    { href: "/platform/institutes", label: "Institutes" },
    { href: "/platform/bank", label: "Review queue" },
    { href: "/platform/activation", label: "Activation" },
    { href: "/platform/requests", label: "Requests" },
    { href: "/platform/support", label: "Support" },
    { href: "/platform/health", label: "Health" },
    { href: "/platform/audit", label: "Audit log" },
  ],
  institute: [
    { href: "/institute", label: "Overview" },
    { href: "/institute/members", label: "Members" },
    { href: "/institute/teachers", label: "Teacher subjects" },
    { href: "/institute/subjects", label: "Subjects" },
    { href: "/institute/export", label: "Export data" },
  ],
  teacher: [
    { href: "/teacher/generate", label: "Set a paper" },
    { href: "/teacher/papers", label: "My papers" },
    { href: "/teacher/batches", label: "Batches" },
    { href: "/teacher/flagged", label: "Flagged questions" },
  ],
};

const BRAND: Record<Area, string> = {
  platform: "Platform console",
  institute: "Institute console",
  teacher: "Teacher console",
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
  eyebrow,
  title,
  intro,
  children,
  split = false,
}: {
  area: Area;
  pathname: string;
  eyebrow: string;
  title: ReactNode;
  intro?: string;
  children: ReactNode;
  split?: boolean;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.memberships.length === 0) redirect("/welcome");
  if (!canAccess(area, session)) notFound();

  return (
    <div className="wrap">
      <header className="masthead">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {intro && <p>{intro}</p>}
        </div>
      </header>

      <PendingInvitesNotice />

      <div className="appshell">
        <nav className="rail">
          <div className="brand">
            PaperFlow
            <span>{BRAND[area]}</span>
          </div>
          {NAV[area].map((n) => {
            const on = pathname === n.href || (n.href !== `/${area}` && pathname.startsWith(`${n.href}/`));
            return (
              <Link key={n.href} href={n.href} className={`navitem${on ? " on" : ""}`}>
                <span>{n.label}</span>
              </Link>
            );
          })}
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
      <div style={{ marginTop: 10 }}>
        <SignOutButton />
      </div>
    </div>
  );
}
