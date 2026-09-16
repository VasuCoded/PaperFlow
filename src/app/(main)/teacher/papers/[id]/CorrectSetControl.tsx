"use client";

import { useState, useTransition } from "react";
import { correctAttemptSet } from "@/server/actions/attempts";

export function CorrectSetControl({
  attemptId,
  currentSetId,
  sets,
}: {
  attemptId: string;
  currentSetId: string;
  sets: { label: string; setId: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return <span className="sub" style={{ color: "var(--ledger)" }}>Remapped · practice will rebuild</span>;
  }

  if (!open) {
    return (
      <button type="button" className="btn sm ghost" onClick={() => setOpen(true)}>
        Correct set
      </button>
    );
  }

  return (
    <div>
      <div className="btnrow">
        {sets
          .filter((s) => s.setId !== currentSetId)
          .map((s) => (
            <button
              key={s.setId}
              type="button"
              className="btn sm solid"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await correctAttemptSet(attemptId, s.setId);
                  if (res.ok) setDone(true);
                  else setError(res.message ?? "Could not correct the set.");
                })
              }
            >
              They wrote Set {s.label}
            </button>
          ))}
        <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error && <div className="notice warn" style={{ marginTop: 6, marginBottom: 0, fontSize: 12 }}>{error}</div>}
    </div>
  );
}
