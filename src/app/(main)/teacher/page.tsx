import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../_components/AppShell";
import { getSession } from "@/server/session";
import { listPapers } from "@/server/data/papers";
import { getResultBatches } from "@/server/data/results";
import { Icon } from "@/components/ui/Icon";
import { Stat } from "@/components/ui/Stat";
import { CopyButton } from "@/components/ui/CopyButton";
import { ActionButton } from "../_components/ActionButton";
import { setPaperReleased } from "@/server/actions/teacher";

export const metadata: Metadata = { title: "Home · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/**
 * A teacher's front page: the one big button (set a paper), their batches with
 * the codes students need, and how the last papers are being logged.
 */
export default async function TeacherHome() {
  const session = await getSession();
  const [papers, batches] = session ? await Promise.all([listPapers(session), getResultBatches(session)]) : [[], []];
  // an admin's list is every paper in the institute; a teacher's, their own
  const mine = papers;
  const recent = mine.slice(0, 6);
  const open = batches.filter((b) => b.active);
  const students = new Set(open.flatMap((b) => b.studentIds)).size;
  const withBatch = recent.filter((p) => p.batchStudents > 0 && p.releasedAt);
  const rate = withBatch.length
    ? Math.round((withBatch.reduce((n, p) => n + p.loggedCount / p.batchStudents, 0) / withBatch.length) * 100)
    : null;
  const firstName = (session?.fullName ?? "").split(" ")[0];

  return (
    <AppShell area="teacher">
      <div className="phead">
        <p>
          {greeting()}
          {firstName ? `, ${firstName}` : ""}.
        </p>
      </div>

      <div className="quick">
        <Link href="/teacher/generate" className="quickcard primary">
          <Icon name="filePlus" size={26} />
          <b>Set a new paper</b>
          <span>Pick chapters and a pattern. Ready to print in a minute.</span>
        </Link>
        <Link href="/teacher/batches" className="quickcard">
          <Icon name="layers" size={24} />
          <b>Batches and join codes</b>
          <span>Create a batch, or find the code for your students.</span>
        </Link>
        <Link href="/teacher/results" className="quickcard">
          <Icon name="chart" size={24} />
          <b>Results</b>
          <span>Who has logged, and what the class gets wrong.</span>
        </Link>
      </div>

      <div className="stats">
        <Stat icon="layers" value={open.length} label="Open batches" />
        <Stat icon="users" value={students} label="Students" />
        <Stat icon="file" value={mine.length} label={session?.role === "institute_admin" ? "Papers in the institute" : "Papers set"} />
        <Stat
          icon="pencil"
          value={rate === null ? "—" : `${rate}%`}
          label="Logged, recent papers"
          tone={rate === null ? undefined : rate >= 60 ? "good" : "warn"}
          href="/teacher/results"
        />
      </div>

      <div className="dash2">
        <section className="panel">
          <div className="panelhead">
            <h2>Your batches</h2>
            <Link href="/teacher/batches" className="panellink">Manage →</Link>
          </div>
          {open.length === 0 ? (
            <div className="empty">
              <p>No open batches. Create one and give its code to your students.</p>
              <Link className="btn sm solid" href="/teacher/batches">Create a batch</Link>
            </div>
          ) : (
            <div className="rowlist">
              {open.map((b) => (
                <div key={b.id} className="rowlink static">
                  <span className="rowmain">
                    <b>{b.name}</b>
                    <span>
                      {b.label} · {b.students} student{b.students === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="joincode">{b.joinCode}</span>
                  <CopyButton text={b.joinCode} />
                </div>
              ))}
            </div>
          )}
          <p className="panelfoot">Students join from the app with this six-letter code.</p>
        </section>

        <section className="panel">
          <div className="panelhead">
            <h2>Recent papers</h2>
            <Link href="/teacher/papers" className="panellink">All papers →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="empty">
              <p>No papers yet.</p>
              <Link className="btn sm solid" href="/teacher/generate">Set your first paper</Link>
            </div>
          ) : (
            <div className="rowlist">
              {recent.map((p) => {
                const pct = p.batchStudents ? Math.round((p.loggedCount / p.batchStudents) * 100) : null;
                return (
                  <div key={p.id} className="rowlink static">
                    <span className="rowmain">
                      <Link href={`/teacher/papers/${p.id}`} className="rowtitle">{p.title}</Link>
                      <span>
                        {dateFmt.format(new Date(p.createdAt))} · {p.batchName ?? "no batch"}
                        {!p.releasedAt ? " · not given yet" : pct !== null ? ` · logged by ${p.loggedCount} of ${p.batchStudents}` : ""}
                      </span>
                    </span>
                    {!p.releasedAt ? (
                      <ActionButton action={setPaperReleased.bind(null, p.id, true)} label="Mark as conducted" className="btn sm solid" />
                    ) : (
                      pct !== null && <span className={`pill ${pct >= 60 ? "active" : "suspended"}`}>{pct}%</span>
                    )}
                    <Link className="btn sm ghost" href={`/print/paper/${p.id}`} target="_blank">
                      <Icon name="printer" size={14} /> Print
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
