import type { Metadata } from "next";
import Link from "next/link";
import { getStudentContext, StudentShell } from "./_components/StudentShell";

export const metadata: Metadata = { title: "Tests · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

export default async function StudentTestsPage() {
  const ctx = await getStudentContext("/app");
  const { subjects, papers, subjectId, subject } = ctx;
  const labelById = new Map(subjects.map((s) => [s.classSubjectId, s.label]));

  // "Needs logging" spans EVERY subject: that is the habit the app exists to build.
  const unlogged = papers.filter((p) => !p.logged && labelById.has(p.classSubjectId));
  const mine = papers.filter((p) => p.classSubjectId === subjectId);
  const latest = mine[0];
  const earlier = mine.slice(1);

  return (
    <StudentShell ctx={ctx} tab="tests">
      {subjects.length === 0 ? (
        <>
          <p className="sec-label">No batches yet</p>
          <div className="practice idle">
            <h4>You are not in a batch yet</h4>
            <p>Ask your teacher for a six-character join code.</p>
          </div>
          <Link className="cta" href="/welcome?join=1" style={{ textAlign: "center", textDecoration: "none" }}>
            Enter a join code
          </Link>
        </>
      ) : (
        <>
          {unlogged.length > 0 && (
            <>
              <p className="sec-label">Needs logging</p>
              <div className="needstrip">
                <h4>● {unlogged.length} paper{unlogged.length === 1 ? "" : "s"} waiting</h4>
                <p>Logging takes under a minute, and it is what makes your practice set worth doing.</p>
              </div>
              {unlogged.slice(0, 4).map((p) => (
                <Link
                  key={p.id}
                  href={`/app/log/${p.id}`}
                  className="testcard quiet"
                  style={{ display: "block", marginTop: 8, textDecoration: "none", color: "inherit" }}
                >
                  <h3 style={{ fontSize: 16 }}>{p.title}</h3>
                  <div className="meta">
                    {(labelById.get(p.classSubjectId) ?? "").toUpperCase()} · {dateFmt.format(new Date(p.createdAt)).toUpperCase()}
                  </div>
                </Link>
              ))}
            </>
          )}

          <p className="sec-label">Latest test · {subject?.label.replace(/^Class \S+ · /, "")}</p>
          {latest ? (
            <div className="testcard">
              <h3>{latest.title}</h3>
              <div className="meta">
                {latest.totalMarks} MARKS · {dateFmt.format(new Date(latest.createdAt)).toUpperCase()}
                {latest.setCount > 1 ? ` · ${latest.setCount} SETS` : ""}
                {latest.logged ? ` · LOGGED · ${latest.wrong} WRONG` : ""}
              </div>
              <p className="prompt">
                {latest.logged ? (
                  <>You logged this paper. You can change what you marked.</>
                ) : (
                  <>
                    Tap the questions you got <span className="hl">wrong</span>. That is all you need to do.
                  </>
                )}
              </p>
              <Link className="cta" href={`/app/log/${latest.id}`} style={{ textAlign: "center", textDecoration: "none" }}>
                {latest.logged ? "Review what I logged" : "Start logging"}
              </Link>
            </div>
          ) : (
            <div className="practice idle">
              <h4>No tests yet</h4>
              <p>Papers your teacher sets for your batch appear here.</p>
            </div>
          )}

          {earlier.length > 0 && (
            <>
              <p className="sec-label">Earlier tests</p>
              {earlier.map((p) => (
                <Link
                  key={p.id}
                  href={`/app/log/${p.id}`}
                  className="testcard quiet"
                  style={{ display: "block", marginBottom: 8, textDecoration: "none", color: "inherit" }}
                >
                  <h3 style={{ fontSize: 16 }}>{p.title}</h3>
                  <div className="meta">
                    {p.logged ? `LOGGED · ${p.wrong} WRONG` : "NOT LOGGED"} · {dateFmt.format(new Date(p.createdAt)).toUpperCase()} ·{" "}
                    {p.totalMarks} MARKS
                  </div>
                </Link>
              ))}
            </>
          )}
        </>
      )}
    </StudentShell>
  );
}
