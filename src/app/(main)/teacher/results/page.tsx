import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../../_components/AppShell";
import { getSession } from "@/server/session";
import { getBatchResults, getResultBatches, PAPER_WINDOW } from "@/server/data/results";
import { Stat, ago } from "@/components/ui/Stat";
import { Icon } from "@/components/ui/Icon";
import { TableSearch } from "@/components/ui/TableSearch";

export const metadata: Metadata = { title: "Results · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  const { batch: batchParam } = await searchParams;
  const session = await getSession();
  if (session && !session.modules.student_app) {
    return (
      <AppShell area="teacher">
        <div className="empty panel">
          <p>Results are not switched on for your institute. The platform can turn them on.</p>
        </div>
      </AppShell>
    );
  }
  const batches = session ? await getResultBatches(session) : [];
  // unless one is asked for: the batch with the newest paper
  const latest = [...batches].sort((x, y) => (y.lastPaperAt ?? "").localeCompare(x.lastPaperAt ?? ""))[0];
  const batch = batches.find((b) => b.id === batchParam) ?? latest ?? null;
  const results = session && batch ? await getBatchResults(session, batch) : null;

  const paperCount = results?.papers.length ?? 0;
  const students = results?.students ?? [];
  const possible = paperCount * students.length;
  const logged = students.reduce((n, s) => n + s.logged, 0);
  const rate = possible ? Math.round((logged / possible) * 100) : null;
  const wrong = students.reduce((n, s) => n + s.wrong, 0);

  return (
    <AppShell area="teacher">
      {batches.length === 0 ? (
        <div className="empty panel">
          <p>No batches yet. Results appear here once a batch has students and papers.</p>
          <Link className="btn solid" href="/teacher/batches">Create a batch</Link>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <nav className="seg" aria-label="Choose a batch">
              {batches.map((b) => (
                <Link key={b.id} href={`/teacher/results?batch=${b.id}`} className={b.id === batch?.id ? "on" : ""}>
                  {b.name}
                </Link>
              ))}
            </nav>
          </div>

          {batch && (
            <p className="lede" style={{ marginTop: -4 }}>
              {batch.label} · {batch.students} student{batch.students === 1 ? "" : "s"} · join code{" "}
              <b className="mono">{batch.joinCode}</b>
              {!batch.active && " · closed"}. Based on the last {PAPER_WINDOW} papers set for this batch.
            </p>
          )}

          <div className="stats">
            <Stat icon="users" value={students.length} label="Students" />
            <Stat icon="file" value={paperCount} label="Papers set" />
            <Stat
              icon="pencil"
              value={rate === null ? "—" : `${rate}%`}
              label="Papers logged"
              hint={possible ? `${logged} of ${possible}` : "no papers yet"}
              tone={rate === null ? undefined : rate >= 60 ? "good" : "warn"}
            />
            <Stat icon="target" value={wrong} label="Wrong answers logged" />
          </div>

          {paperCount === 0 ? (
            <div className="empty panel">
              <p>No papers have been set for this batch yet.</p>
              <Link className="btn solid" href="/teacher/generate">Set a paper</Link>
            </div>
          ) : (
            <>
              <div className="dash2">
                <section className="panel">
                  <div className="panelhead">
                    <h2>Topics the batch finds hardest</h2>
                  </div>
                  {results!.topics.length === 0 ? (
                    <p className="lede">Nothing logged wrong yet{logged === 0 ? " — nobody has logged a paper" : ""}.</p>
                  ) : (
                    <div className="bars">
                      {results!.topics.map((t) => {
                        const pct = students.length ? Math.round((t.students / students.length) * 100) : 0;
                        return (
                          <div className="bar" key={t.topic}>
                            <div className="row">
                              <span>
                                {t.topic}
                                {t.chapter && t.chapter !== t.topic && <span className="muted"> · {t.chapter}</span>}
                              </span>
                              <b>{t.students} of {students.length}</b>
                            </div>
                            <div className="track"><div className={`fill${pct >= 50 ? " low" : pct >= 25 ? " mid" : ""}`} style={{ width: `${pct}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="panelfoot">How many students got at least one question on the topic wrong. Worth going over in class.</p>
                </section>

                <section className="panel">
                  <div className="panelhead">
                    <h2>Papers</h2>
                    <Link className="panellink" href={`/teacher/papers?batch=${batch!.id}`}>All →</Link>
                  </div>
                  <div className="rowlist">
                    {results!.papers.map((p) => {
                      const pct = students.length ? Math.round((p.logged / students.length) * 100) : 0;
                      return (
                        <Link key={p.id} href={`/teacher/papers/${p.id}`} className="rowlink">
                          <span className="rowmain">
                            <b>{p.title}</b>
                            <span>
                              {dateFmt.format(new Date(p.createdAt))} · logged by {p.logged} of {students.length}
                            </span>
                          </span>
                          <span className={`pill ${pct >= 60 ? "active" : "suspended"}`}>{pct}%</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              </div>

              <h2 className="sect">Students</h2>
              <div className="toolbar">
                <TableSearch target="students" placeholder="Search students" />
              </div>
              <div className="tablewrap">
                <table className="lt stack" id="students">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th className="num">Papers logged</th>
                      <th className="num">Wrong answers</th>
                      <th>Weakest topic</th>
                      <th>Last logged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const behind = s.logged < paperCount;
                      return (
                        <tr key={s.id} data-search={s.name}>
                          <td>
                            <b>{s.name}</b>
                            {behind && (
                              <span className="sub" style={{ color: "var(--pen)" }}>
                                <Icon name="clock" size={12} className="inline" /> {paperCount - s.logged} paper{paperCount - s.logged === 1 ? "" : "s"} not logged
                              </span>
                            )}
                          </td>
                          <td className="num" data-label="Logged:">{s.logged}/{paperCount}</td>
                          <td className="num" data-label="Wrong:">{s.wrong}</td>
                          <td data-label="Weakest:">{s.weakest ?? <span className="muted">—</span>}</td>
                          <td data-label="Last logged:">{ago(s.lastLogged)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="footnote-plain">
                Logging only works as a habit. If a student is behind, the fix is a quick word in class, not a change
                to the paper.
              </p>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
