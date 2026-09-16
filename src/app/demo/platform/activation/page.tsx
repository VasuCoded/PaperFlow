"use client";

import { useState } from "react";
import { Shell } from "../../_components/Shell";
import { INSTITUTES } from "@/demo/institutes";
import { ACTIVE_CLASS_SUBJECTS } from "@/demo/activity";
import { CLASS_SUBJECTS } from "@/demo/bank";

const GATE: Record<string, { thinChapter: string; thinChapterN: number; thinTopicN: number; met: boolean }> = {
  "cs-12-bio": { thinChapter: "Biotechnology — Principles", thinChapterN: 47, thinTopicN: 6, met: false },
  "cs-12-chem": { thinChapter: "Surface Chemistry", thinChapterN: 88, thinTopicN: 11, met: true },
  "cs-10-sci": { thinChapter: "Life Processes", thinChapterN: 52, thinTopicN: 7, met: false },
  "cs-10-math": { thinChapter: "Circles", thinChapterN: 31, thinTopicN: 4, met: false },
  "cs-10-sst": { thinChapter: "Geography strand", thinChapterN: 22, thinTopicN: 3, met: false },
  "cs-10-hindi": { thinChapter: "क्षितिज", thinChapterN: 12, thinTopicN: 2, met: false },
};

export default function ActivationPage() {
  const tenants = INSTITUTES.filter((i) => i.kind === "institute");
  const [grid, setGrid] = useState<Record<string, string[]>>(() => ({ ...ACTIVE_CLASS_SUBJECTS }));

  function toggle(instId: string, csId: string) {
    setGrid((g) => {
      const cur = g[instId] ?? [];
      return { ...g, [instId]: cur.includes(csId) ? cur.filter((x) => x !== csId) : [...cur, csId] };
    });
  }

  return (
    <Shell
      area="platform"
      eyebrow="Platform · activation"
      title={<>Who has <em>what</em> switched on</>}
      intro="Class-subject down, institute across. Bank readiness is platform-level; activation is per tenant. Collapsing those two is the mistake that makes one institute's dropdown depend on another's choices."
    >
      <div className="tablewrap" style={{ marginBottom: 22 }}>
        <table className="lt matrix">
          <thead>
            <tr>
              <th className="rowhead">Class-subject</th>
              <th>Bank</th>
              <th>Approved</th>
              <th>Thinnest chapter</th>
              <th>Gate</th>
              {tenants.map((t) => (
                <th key={t.id}>{t.name.split(" ")[0]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLASS_SUBJECTS.map((cs) => {
              const g = GATE[cs.id];
              return (
                <tr key={cs.id}>
                  <td className="rowhead">
                    <b>Class {cs.className} · {cs.subjectName}</b>
                  </td>
                  <td><span className={`pill ${cs.bankStatus}`}>{cs.bankStatus}</span></td>
                  <td className="num">{cs.approved.toLocaleString("en-IN")}</td>
                  <td style={{ fontSize: 12 }}>
                    {g?.thinChapter}
                    <span className="sub">
                      {g?.thinChapterN} approved · thinnest topic {g?.thinTopicN}
                    </span>
                  </td>
                  <td>
                    {g?.met ? (
                      <span className="pill active">met</span>
                    ) : (
                      <span className="pill suspended">not met</span>
                    )}
                  </td>
                  {tenants.map((t) => {
                    const on = (grid[t.id] ?? []).includes(cs.id);
                    return (
                      <td
                        key={t.id}
                        className={on ? "cell-active" : "cell-planned"}
                        style={{ cursor: "pointer" }}
                        onClick={() => toggle(t.id, cs.id)}
                        title={on ? "Click to deactivate" : "Click to activate"}
                      >
                        {on ? "active" : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="notice warn">
        <b>The gate, in full.</b> Do not switch a subject on unless: no chapter under 60 approved
        questions, no topic under 8, every pattern section type has at least three times the count
        it needs, and the institute&rsquo;s own teacher has read three generated papers and said
        they are papers they would have set. The three-paper read is not a formality — a bank
        calibrated with one institute&rsquo;s teacher can be pitched wrong for another&rsquo;s
        students, and finding that out before the first test is far cheaper than after.
      </div>
    </Shell>
  );
}
