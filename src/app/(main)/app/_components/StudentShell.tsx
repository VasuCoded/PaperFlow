import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession, type Session } from "@/server/session";
import {
  getStudentPapers,
  getStudentSubjects,
  resolveSubject,
  type StudentPaper,
  type StudentSubject,
} from "@/server/data/student";
import { SubjectSwitcher } from "./SubjectSwitcher";
import { OfflineBanner } from "./OfflineBanner";
import { InstallPrompt, PwaRegistrar } from "./Pwa";
import { hashUserId } from "@/lib/pwa/policy";

export interface StudentContext {
  session: Session;
  subjects: StudentSubject[];
  papers: StudentPaper[];
  subjectId: string | null;
  subject: StudentSubject | null;
  /** hashed user id — names this user's offline page cache; never the raw id */
  userHash: string;
}

/** Resolve everything a student screen needs, server-side, once per request. */
export async function getStudentContext(nextPath: string): Promise<StudentContext> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (session.memberships.length === 0) redirect("/welcome");

  const [subjects, papers] = await Promise.all([getStudentSubjects(session), getStudentPapers(session)]);
  const subjectId = await resolveSubject(subjects, papers);
  const userHash = await hashUserId(session.userId);
  return {
    userHash,
    session,
    subjects,
    papers,
    subjectId,
    subject: subjects.find((s) => s.classSubjectId === subjectId) ?? null,
  };
}

const TABS = [
  { key: "tests", href: "/app", label: "Tests", ic: "▤" },
  { key: "practice", href: "/app/practice", label: "Practice", ic: "▢" },
  { key: "weak", href: "/app/weak", label: "Weak spots", ic: "▲" },
  { key: "me", href: "/app/me", label: "Me", ic: "●" },
] as const;

export function StudentShell({
  ctx,
  tab,
  children,
}: {
  ctx: StudentContext;
  tab: (typeof TABS)[number]["key"];
  children: ReactNode;
}) {
  const { session, subjects, subject } = ctx;
  const institute = session.memberships.find((m) => m.instituteId === session.instituteId);
  const initials = (session.fullName ?? session.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  const consoleHref =
    session.isPlatformOwner ? "/platform"
    : session.role === "institute_admin" ? "/institute"
    : session.role === "teacher" ? "/teacher/generate"
    : null;

  return (
    <div className="m-app">
      <header className="appbar">
        <div className="who">
          {session.fullName ?? session.email}
          <span>
            {institute?.instituteName.toUpperCase()}
            {subject ? ` · CLASS ${subject.className}` : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {subjects.length > 1 && ctx.subjectId && (
            <SubjectSwitcher subjects={subjects.map((s) => ({ id: s.classSubjectId, short: s.short }))} current={ctx.subjectId} />
          )}
          <div className="avatar" aria-hidden="true">{initials || "•"}</div>
        </div>
      </header>

      <PwaRegistrar userHash={ctx.userHash} />
      <main className="screen">
        <OfflineBanner />
        {tab === "tests" && <InstallPrompt />}
        {consoleHref && (
          <div className="m-banner">
            This is the student app. <Link href={consoleHref} style={{ color: "var(--pen)" }}>Go to your console →</Link>
          </div>
        )}
        {children}
      </main>

      <nav className="tabbar" aria-label="Student">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} className={`tab${tab === t.key ? " on" : ""}`} aria-current={tab === t.key ? "page" : undefined}>
            <span className="ic" aria-hidden="true">{t.ic}</span>
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
