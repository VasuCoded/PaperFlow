import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../../_components/AppShell";
import { getSession } from "@/server/session";
import { listPapers } from "@/server/data/papers";

export const metadata: Metadata = { title: "My papers · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function PapersPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  const session = await getSession();
  const all = session ? await listPapers(session) : [];

  const subjects = Array.from(new Map(all.map((p) => [p.classSubjectId, p.classSubjectLabel])).entries());
  const papers = subject ? all.filter((p) => p.classSubjectId === subject) : all;

  return (
    <AppShell
      area="teacher"
      pathname="/teacher/papers"
      eyebrow="Teacher · my papers"
      title={
        <>
          Every paper, <em>reprintable exactly</em>
        </>
      }
      intro="Reprinting gives byte-identical sets: the orderings were stored as rows when the paper was saved, not regenerated."
    >
      {subjects.length > 1 && (
        <div className="instbar">
          <h3 className="blk" style={{ margin: 0 }}>Filter by subject</h3>
          <div className="btnrow">
            <Link className={`btn sm${!subject ? " solid" : " ghost"}`} href="/teacher/papers">All</Link>
            {subjects.map(([id, label]) => (
              <Link key={id} className={`btn sm${subject === id ? " solid" : " ghost"}`} href={`/teacher/papers?subject=${id}`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {papers.length === 0 ? (
        <div>
          <p className="lede">No papers yet.</p>
          <Link className="btn solid" href="/teacher/generate">Set your first paper</Link>
        </div>
      ) : (
        <div className="tablewrap">
          <table className="lt">
            <thead>
              <tr>
                <th>Paper</th>
                <th>Batch</th>
                <th className="num">Date</th>
                <th className="num">Marks</th>
                <th className="num">Sets</th>
                <th className="num">Logged</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {papers.map((p) => {
                const pct = p.batchStudents > 0 ? Math.round((p.loggedCount / p.batchStudents) * 100) : null;
                return (
                  <tr key={p.id}>
                    <td>
                      <b>{p.title}</b>
                      <span className="sub">{p.classSubjectLabel}</span>
                    </td>
                    <td>{p.batchName ?? "—"}</td>
                    <td className="num">{dateFmt.format(new Date(p.createdAt))}</td>
                    <td className="num">{p.totalMarks}</td>
                    <td className="num">{p.setCount}</td>
                    <td className="num">
                      {p.loggedCount}
                      {p.batchStudents > 0 ? `/${p.batchStudents}` : ""}
                      {pct !== null && (
                        <span className="sub" style={{ color: pct >= 60 ? "var(--ledger)" : "var(--pen)" }}>
                          {pct}% logged
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="btnrow">
                        <Link className="btn sm" href={`/print/paper/${p.id}`} target="_blank">Print</Link>
                        <Link className="btn sm ghost" href={`/teacher/papers/${p.id}`}>Open</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="notice" style={{ marginTop: 16 }}>
        <b>The logging rate is the number to watch.</b> The practice loop only works if students log.
        Under 60% within two days of handing papers back means the habit has not taken yet — the fix
        is asking the class to open the app, not a change to the app.
      </div>
    </AppShell>
  );
}
