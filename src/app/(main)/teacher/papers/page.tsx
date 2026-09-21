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
  searchParams: Promise<{ subject?: string; batch?: string; code?: string }>;
}) {
  const { subject, batch, code } = await searchParams;
  // a code typed from a sheet of paper, however it was typed
  const codeQuery = (code ?? "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const session = await getSession();
  const all = session ? await listPapers(session) : [];

  const subjects = Array.from(new Map(all.map((p) => [p.classSubjectId, p.classSubjectLabel])).entries());
  const papers = all.filter(
    (p) =>
      (!subject || p.classSubjectId === subject) &&
      (!batch || p.batchId === batch) &&
      (!codeQuery || p.code.includes(codeQuery)),
  );
  const batchName = batch ? all.find((p) => p.batchId === batch)?.batchName ?? null : null;

  return (
    <AppShell area="teacher" pathname="/teacher/papers">
      <form className="codesearch" action="/teacher/papers" method="get">
        <label htmlFor="code">Find a paper by the code printed on it</label>
        <div className="btnrow">
          <input id="code" name="code" className="inp mono" defaultValue={code ?? ""} placeholder="e.g. SSA-10SCI-260922-03" autoComplete="off" spellCheck={false} />
          <button type="submit" className="btn sm solid">Find</button>
          {codeQuery && <Link className="btn sm ghost" href="/teacher/papers">Clear</Link>}
        </div>
      </form>

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

      {batch && (
        <div className="notice plain" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span>
            Paper history for <b>{batchName ?? "this batch"}</b> — {papers.length} paper{papers.length === 1 ? "" : "s"}.
          </span>
          <span className="btnrow">
            <Link className="btn sm ghost" href="/teacher/batches">← Batches</Link>
            <Link className="btn sm ghost" href="/teacher/papers">All papers</Link>
          </span>
        </div>
      )}

      {papers.length === 0 ? (
        <div>
          <p className="lede">{codeQuery ? `No paper matches ${codeQuery}.` : "No papers yet."}</p>
          <Link className="btn solid" href="/teacher/generate">Set your first paper</Link>
        </div>
      ) : (
        <div className="tablewrap">
          <table className="lt">
            <thead>
              <tr>
                <th>Paper</th>
                <th>Batch</th>
                <th>Chapters</th>
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
                      <span className="sub">
                        <span className="mono">{p.code}</span> · {p.classSubjectLabel}
                      </span>
                    </td>
                    <td>
                      {p.batchId ? <Link href={`/teacher/papers?batch=${p.batchId}`}>{p.batchName}</Link> : "—"}
                    </td>
                    <td style={{ maxWidth: 260, fontSize: 12 }} title={p.chapters.join(", ")}>
                      {p.chapters.length === 0
                        ? "—"
                        : p.chapters.slice(0, 3).join(", ") + (p.chapters.length > 3 ? ` +${p.chapters.length - 3}` : "")}
                    </td>
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
