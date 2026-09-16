"use client";

import { useState } from "react";
import { Shell } from "../../_components/Shell";
import { ACTIVATION_REQUESTS } from "@/demo/activity";
import { instituteName } from "@/demo/institutes";
import { csLabel } from "@/demo/bank";

export default function RequestsPage() {
  const [rows, setRows] = useState(ACTIVATION_REQUESTS);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function decide(id: string, approve: boolean, why?: string) {
    setRows((r) =>
      r.map((x) =>
        x.id === id
          ? { ...x, status: approve ? "approved" : "declined", gateNote: why || x.gateNote }
          : x,
      ),
    );
    setDeclining(null);
    setReason("");
  }

  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");

  return (
    <Shell
      area="platform"
      eyebrow="Platform · activation requests"
      title={<>The honest version of <em>&ldquo;not yet&rdquo;</em></>}
      intro="Institutes ask here instead of staring at an empty dropdown. Oldest first, each with the coverage gate for that class-subject alongside."
    >
      <h2 className="sect">Pending — {pending.length}</h2>
      {pending.length === 0 && <p className="lede">Nothing waiting.</p>}
      {pending.map((r) => (
        <div className="card" key={r.id} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <h4>
                {csLabel(r.classSubjectId)}
                {r.gateMet ? (
                  <span className="pill active">gate met</span>
                ) : (
                  <span className="pill suspended">gate not met</span>
                )}
              </h4>
              <p style={{ marginBottom: 8 }}>
                <b>{instituteName(r.instituteId)}</b> · requested by {r.requestedBy} · {r.createdAt}
              </p>
              <div className={r.gateMet ? "notice" : "notice warn"} style={{ margin: 0 }}>
                {r.gateNote}
              </div>
            </div>
            <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 6, minWidth: 190 }}>
              {declining === r.id ? (
                <>
                  <textarea
                    className="inp"
                    rows={3}
                    placeholder="Reason the institute admin will see…"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="btnrow">
                    <button className="btn sm solid" onClick={() => decide(r.id, false, reason)}>
                      Send decline
                    </button>
                    <button className="btn sm ghost" onClick={() => setDeclining(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <button className="btn sm solid" onClick={() => decide(r.id, true)}>
                    Approve and activate
                  </button>
                  <button className="btn sm ghost" onClick={() => setDeclining(r.id)}>
                    Decline with a reason
                  </button>
                  {!r.gateMet && (
                    <p style={{ fontSize: 11, color: "var(--pen)", margin: 0 }}>
                      Approving against an unmet gate produces repetitive papers within two tests.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      <h2 className="sect">Decided</h2>
      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr><th>Institute</th><th>Class-subject</th><th>Outcome</th><th>Reason shown to them</th></tr>
          </thead>
          <tbody>
            {done.map((r) => (
              <tr key={r.id}>
                <td><b>{instituteName(r.instituteId)}</b></td>
                <td>{csLabel(r.classSubjectId)}</td>
                <td>
                  <span className={`pill ${r.status === "approved" ? "active" : "suspended"}`}>
                    {r.status}
                  </span>
                </td>
                <td style={{ fontSize: 12.5, color: "var(--graphite)" }}>{r.gateNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
