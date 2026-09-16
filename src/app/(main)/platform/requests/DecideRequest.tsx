"use client";

import { useState, useTransition } from "react";
import { decideRequestAction } from "@/server/actions/platform";

export function DecideRequest({
  requestId,
  instituteName,
  label,
  gateMet,
}: {
  requestId: string;
  instituteName: string;
  label: string;
  gateMet: boolean;
}) {
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"idle" | "approve" | "decline">("idle");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "declined" | null>(null);

  const decide = (approve: boolean) =>
    start(async () => {
      setError(null);
      const res = await decideRequestAction(requestId, approve, reason);
      if (res.ok) setDone(approve ? "approved" : "declined");
      else setError(res.message ?? "That did not work.");
    });

  if (done) return <span className={`pill ${done === "approved" ? "active" : "suspended"}`}>{done}</span>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 210, maxWidth: 280 }}>
      {mode === "decline" ? (
        <>
          <label htmlFor={`reason-${requestId}`} style={{ fontSize: 11.5, fontWeight: 600 }}>
            Reason {instituteName} will see
          </label>
          <textarea
            id={`reason-${requestId}`}
            className="inp"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="The shared bank for this subject is still being reviewed — expected by end of next month."
          />
          <div className="btnrow">
            <button type="button" className="btn sm solid" disabled={pending || reason.trim().length < 5} onClick={() => decide(false)}>
              {pending ? "Declining…" : "Decline"}
            </button>
            <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </>
      ) : mode === "approve" ? (
        <div className={gateMet ? "notice" : "notice warn"} style={{ margin: 0, padding: "9px 10px", fontSize: 12 }}>
          {gateMet ? (
            <>Approve and activate <b>{label}</b> for <b>{instituteName}</b>?</>
          ) : (
            <>
              <b>The gate is not met.</b> Approving activates {label} for {instituteName} with a thin bank.
            </>
          )}
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button type="button" className="btn sm solid" disabled={pending} onClick={() => decide(true)}>
              {pending ? "Activating…" : "Approve"}
            </button>
            <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setMode("idle")}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <button type="button" className="btn sm solid" onClick={() => setMode("approve")}>Approve &amp; activate</button>
          <button type="button" className="btn sm ghost" onClick={() => setMode("decline")}>Decline with a reason…</button>
        </>
      )}
      {error && <span style={{ fontSize: 11.5, color: "var(--pen)" }}>{error}</span>}
    </div>
  );
}
