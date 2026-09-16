"use client";

import { useState } from "react";
import { Shell } from "../../_components/Shell";
import { useDemoSession } from "@/demo/session";
import { instituteName } from "@/demo/institutes";
import { batchesFor, MEMBERS, papersFor } from "@/demo/activity";

export default function ExportPage() {
  const { instituteId } = useDemoSession();
  const inst = instituteId ?? "";
  const [state, setState] = useState<"idle" | "working" | "done">("idle");

  const members = MEMBERS[inst] ?? [];
  const papers = papersFor(inst);
  const batches = batchesFor(inst);

  const rows = [
    { what: "Members and roles", n: members.length },
    { what: "Batches and enrolments", n: batches.length },
    { what: "Papers (with their sets)", n: papers.length },
    { what: "Attempts and mistake logs", n: papers.reduce((a, p) => a + p.loggedCount, 0) },
    { what: "Practice sets", n: 214 },
    { what: "Your private questions", n: 3 },
  ];

  return (
    <Shell
      area="institute"
      eyebrow="Institute · export"
      title={<>Your data, <em>whenever you want it</em></>}
      intro="One click gives you everything your institute owns as JSON, plus your papers as PDFs. A tenant that cannot leave is a tenant that is right to be nervous."
    >
      <div className="cards c2">
        <div className="card">
          <h4>What&rsquo;s included</h4>
          <div className="tablewrap" style={{ marginTop: 10, border: 0 }}>
            <table className="lt">
              <tbody>
                {rows.map((r) => (
                  <tr key={r.what}>
                    <td>{r.what}</td>
                    <td className="num"><b>{r.n.toLocaleString("en-IN")}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            className="gen"
            style={{ marginTop: 14 }}
            disabled={state === "working"}
            onClick={() => {
              setState("working");
              setTimeout(() => setState("done"), 900);
            }}
          >
            {state === "working" ? "Preparing…" : state === "done" ? "Download again" : "Export everything"}
          </button>
          {state === "done" && (
            <div className="notice" style={{ marginTop: 12, marginBottom: 0 }}>
              <b>{instituteName(inst).replace(/\s+/g, "-").toLowerCase()}-export.zip</b> ready —
              JSON plus one PDF per paper. This export is rate limited and audited.
            </div>
          )}
        </div>

        <div className="card tinted">
          <h4>What&rsquo;s not included, and why</h4>
          <p style={{ marginBottom: 10 }}>
            The <b>shared question bank</b> is not in your export. It is licensed to you for use
            inside the platform, not distributed — the same is true for every other institute, which
            is what makes the shared bank possible at all.
          </p>
          <p>
            Your own private questions <b>are</b> included, and they stay yours. They are never
            promoted into the shared bank without your written agreement, per class-subject.
          </p>
        </div>
      </div>
    </Shell>
  );
}
