"use client";

import { useState } from "react";
import { Shell } from "../../_components/Shell";
import { useDemoSession } from "@/demo/session";
import { papersFor, BATCHES } from "@/demo/activity";
import { csLabel } from "@/demo/bank";

export default function PapersPage() {
  const { instituteId } = useDemoSession();
  const papers = papersFor(instituteId ?? "");
  const [filter, setFilter] = useState<string>("all");
  const subjects = Array.from(new Set(papers.map((p) => p.classSubjectId)));
  const shown = filter === "all" ? papers : papers.filter((p) => p.classSubjectId === filter);

  return (
    <Shell
      area="teacher"
      eyebrow="Teacher · my papers"
      title={<>Every paper, <em>reprintable exactly</em></>}
      intro="Reprinting a past paper gives byte-identical sets, because the permutations were stored as rows rather than regenerated from a seed."
    >
      <div className="instbar">
        <div>
          <h3 className="blk" style={{ margin: 0 }}>Filter by subject</h3>
        </div>
        <div className="btnrow">
          <button className={`btn sm${filter === "all" ? " solid" : " ghost"}`} onClick={() => setFilter("all")}>
            All
          </button>
          {subjects.map((s) => (
            <button
              key={s}
              className={`btn sm${filter === s ? " solid" : " ghost"}`}
              onClick={() => setFilter(s)}
            >
              {csLabel(s)}
            </button>
          ))}
        </div>
      </div>

      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr>
              <th>Paper</th>
              <th>Subject</th>
              <th>Batch</th>
              <th className="num">Date</th>
              <th className="num">Marks</th>
              <th className="num">Sets</th>
              <th className="num">Logged</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const batch = BATCHES.find((b) => b.id === p.batchId);
              const pct = batch ? Math.round((p.loggedCount / batch.students) * 100) : 0;
              return (
                <tr key={p.id}>
                  <td>
                    <b>{p.title}</b>
                    <span className="sub">{p.chapters.join(" · ")}</span>
                  </td>
                  <td>{csLabel(p.classSubjectId)}</td>
                  <td>{batch?.name ?? "—"}</td>
                  <td className="num">{p.date}</td>
                  <td className="num">{p.totalMarks}</td>
                  <td className="num">{p.setCount}</td>
                  <td className="num">
                    {p.loggedCount}/{batch?.students ?? "—"}
                    <span className="sub" style={{ color: pct >= 60 ? "var(--ledger)" : "var(--pen)" }}>
                      {pct}% logged
                    </span>
                  </td>
                  <td>
                    <div className="btnrow">
                      <a className="btn sm" href="/print/sample" target="_blank" rel="noreferrer">
                        Reprint
                      </a>
                      <a className="btn sm ghost" href={`/demo/teacher/papers/${p.id}`}>
                        Open
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="notice" style={{ marginTop: 16 }}>
        <b>Logging rate is the number to watch.</b> The practice loop only works if students log.
        Below 60% within two days of getting the paper back, the habit has not taken and the fix is
        the teacher saying &ldquo;open it now&rdquo; in class — not a software change.
      </div>
    </Shell>
  );
}
