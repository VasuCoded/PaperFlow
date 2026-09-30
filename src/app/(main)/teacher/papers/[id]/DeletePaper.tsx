"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePaper } from "@/server/actions/teacher";

/**
 * Delete this paper. Unlogged: one confirmation. Logged by students: their logs
 * go too, so the printed code has to be typed.
 */
export function DeletePaper({ paperId, code, logged }: { paperId: string; code: string; logged: number }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = logged === 0 || typed.trim().toUpperCase() === code.toUpperCase();

  return (
    <section className="danger">
      <div>
        <h3>Delete this paper</h3>
        <p>
          {logged === 0
            ? "Nobody has logged it yet. Deleting it removes the paper and its sets; it cannot be undone."
            : `${logged} student${logged === 1 ? " has" : "s have"} logged it. Deleting it also deletes what they logged, and it cannot be undone.`}
        </p>
      </div>
      {!asking ? (
        <button type="button" className="btn danger-btn" onClick={() => setAsking(true)}>Delete paper</button>
      ) : (
        <div className="dangerconfirm">
          {logged > 0 && (
            <input
              className="inp"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={`Type ${code} to confirm`}
              aria-label="Type the paper's code to confirm"
              autoComplete="off"
            />
          )}
          <span className="btnrow">
            <button
              type="button"
              className="btn solid"
              disabled={pending || !ready}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await deletePaper(paperId, logged > 0 ? typed : undefined);
                  if (res.ok) router.replace("/teacher/papers");
                  else setError(res.message ?? "Could not delete it.");
                })
              }
            >
              {pending ? "Deleting…" : "Delete for good"}
            </button>
            <button type="button" className="btn ghost" disabled={pending} onClick={() => { setAsking(false); setTyped(""); }}>Cancel</button>
          </span>
          {error && <p className="hint" style={{ color: "var(--pen)" }}>{error}</p>}
        </div>
      )}
    </section>
  );
}
