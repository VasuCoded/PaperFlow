"use client";

import { useState, useTransition } from "react";
import { reviewQuestionAction } from "@/server/actions/platform";

type Decision = "approve" | "reject" | "retire";

export function ReviewControls({
  questionId,
  isPrivate,
  ownerName,
}: {
  questionId: string;
  isPrivate: boolean;
  ownerName: string;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmPromote, setConfirmPromote] = useState(false);

  const decide = (decision: Decision, promote = false, label: string) =>
    start(async () => {
      setError(null);
      const res = await reviewQuestionAction(questionId, decision, promote);
      if (res.ok) setDone(label);
      else setError(res.message ?? "That did not work.");
    });

  if (done) {
    return (
      <div style={{ flex: "0 0 auto", minWidth: 150 }}>
        <span className={`pill ${done === "rejected" ? "suspended" : "active"}`}>{done}</span>
      </div>
    );
  }

  return (
    <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 6, minWidth: 160 }}>
      <button type="button" className="btn sm solid" disabled={pending} onClick={() => decide("approve", false, "approved")}>
        {isPrivate ? `Approve for ${ownerName}` : "Approve"}
      </button>
      <button type="button" className="btn sm ghost" disabled={pending} onClick={() => decide("reject", false, "rejected")}>
        Reject
      </button>
      {isPrivate &&
        (confirmPromote ? (
          <div className="notice warn" style={{ margin: 0, padding: "9px 10px", maxWidth: 240 }}>
            Promote into the <b>shared bank</b>? The owner is <b>{ownerName}</b>. Every other institute will be
            able to use it.
            <div className="btnrow" style={{ marginTop: 8 }}>
              <button type="button" className="btn sm solid" disabled={pending} onClick={() => decide("approve", true, "promoted")}>
                Yes, promote
              </button>
              <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setConfirmPromote(false)}>
                No
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setConfirmPromote(true)}>
            Promote to shared…
          </button>
        ))}
      {pending && <span style={{ fontSize: 11.5, color: "var(--graphite)" }}>Saving…</span>}
      {error && <span style={{ fontSize: 11.5, color: "var(--pen)" }}>{error}</span>}
    </div>
  );
}
