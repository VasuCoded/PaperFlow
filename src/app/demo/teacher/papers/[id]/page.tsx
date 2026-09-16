"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Shell } from "../../../_components/Shell";
import { BATCHES, PAPERS } from "@/demo/activity";
import { csLabel } from "@/demo/bank";
import { copiesBreakdown } from "@/server/sets";

interface LogRow {
  name: string;
  set: string;
  wrong: number;
  at: string;
}

const LOGS: LogRow[] = [
  { name: "Aarav Menon", set: "A", wrong: 3, at: "12 Sep 20:14" },
  { name: "Ishita Bhatt", set: "B", wrong: 1, at: "12 Sep 21:02" },
  { name: "Rohan Gupta", set: "B", wrong: 5, at: "13 Sep 08:41" },
  { name: "Neha Rane", set: "C", wrong: 2, at: "13 Sep 09:55" },
  { name: "Kabir Shah", set: "A", wrong: 4, at: "13 Sep 18:20" },
];

export default function PaperDetailPage() {
  const params = useParams<{ id: string }>();
  const paper = PAPERS.find((p) => p.id === params.id) ?? PAPERS[0]!;
  const batch = BATCHES.find((b) => b.id === paper.batchId);
  const [rows, setRows] = useState<LogRow[]>(LOGS);
  const [fixing, setFixing] = useState<string | null>(null);
  const [fixed, setFixed] = useState<string[]>([]);

  const setLabels = Array.from({ length: paper.setCount }, (_, i) => String.fromCharCode(65 + i));
  const copies = copiesBreakdown(batch?.students ?? 40, paper.setCount);

  function correct(name: string, to: string) {
    setRows((r) => r.map((x) => (x.name === name ? { ...x, set: to } : x)));
    setFixed((f) => [...f, name]);
    setFixing(null);
  }

  return (
    <Shell
      area="teacher"
      eyebrow={`Teacher · ${paper.title}`}
      title={<>{paper.title}, <em>as printed</em></>}
      intro={`${csLabel(paper.classSubjectId)} · ${batch?.name ?? ""} · ${paper.date}`}
    >
      <div className="cards c4" style={{ marginBottom: 20 }}>
        <div className="card">
          <span className="big">{paper.totalMarks}</span>
          <span className="cap">Total marks</span>
        </div>
        <div className="card">
          <span className="big">{paper.setCount}</span>
          <span className="cap">Printed sets</span>
        </div>
        <div className="card">
          <span className="big">{paper.loggedCount}</span>
          <span className="cap">Students logged</span>
        </div>
        <div className="card">
          <span className="big">{batch?.students ?? "—"}</span>
          <span className="cap">In batch</span>
        </div>
      </div>

      <h2 className="sect">Sets and copies</h2>
      <div className="tablewrap" style={{ marginBottom: 8 }}>
        <table className="lt">
          <thead>
            <tr>
              <th>Set</th>
              <th className="num">Copies printed</th>
              <th>Artefacts</th>
            </tr>
          </thead>
          <tbody>
            {setLabels.map((l, i) => (
              <tr key={l}>
                <td><b>Set {l}</b></td>
                <td className="num">{copies[i]}</td>
                <td>
                  <div className="btnrow">
                    <a className="btn sm ghost" href="/print/sample" target="_blank" rel="noreferrer">Question paper</a>
                    <a className="btn sm ghost" href="/print/sample" target="_blank" rel="noreferrer">Answer key</a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--graphite)" }}>
        One master mapping sheet covers all sets: canonical number, its position in each set, the
        answer and the marks.
      </p>

      <h2 className="sect">Who logged, and which set they wrote</h2>
      <div className="notice warn">
        <b>This is the correction that matters.</b> If a student logs against the wrong set, every
        tap maps to the wrong question, then the wrong topic, and their weak-spot map is quietly
        poisoned — nothing errors. Correcting it here remaps their attempt and rebuilds the
        practice set that was built off the wrong mapping, in one transaction.
      </div>

      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr>
              <th>Student</th>
              <th>Set written</th>
              <th className="num">Wrong</th>
              <th className="num">Logged at</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>
                  <b>{r.name}</b>
                  {fixed.includes(r.name) && (
                    <span className="sub" style={{ color: "var(--ledger)" }}>
                      Remapped · practice set rebuilt
                    </span>
                  )}
                </td>
                <td>
                  <span className="pill active">Set {r.set}</span>
                </td>
                <td className="num">{r.wrong}</td>
                <td className="num">{r.at}</td>
                <td>
                  {fixing === r.name ? (
                    <div className="btnrow">
                      {setLabels
                        .filter((l) => l !== r.set)
                        .map((l) => (
                          <button key={l} className="btn sm solid" onClick={() => correct(r.name, l)}>
                            → Set {l}
                          </button>
                        ))}
                      <button className="btn sm ghost" onClick={() => setFixing(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button className="btn sm ghost" onClick={() => setFixing(r.name)}>
                      Correct set
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
