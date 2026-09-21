"use client";

import { useState, useTransition } from "react";
import { requestAccess, withdrawAccessRequest } from "@/server/actions/membership";

/**
 * Ask an institute to let you in. Deliberately no role field (CLAUDE.md): the
 * note says who you are, and whoever approves chooses the role.
 */
export function RequestAccessForm({ institutes }: { institutes: { id: string; name: string }[] }) {
  const [instituteId, setInstituteId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  if (institutes.length === 0) {
    return <p style={{ fontSize: 12.5, color: "var(--graphite)" }}>There are no other institutes to ask right now.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSent(false);
        start(async () => {
          const res = await requestAccess(instituteId, note);
          if (res.ok) {
            setSent(true);
            setNote("");
            setInstituteId("");
          } else setError(res.message ?? "Could not send the request.");
        });
      }}
    >
      <div className="field">
        <label htmlFor="req-inst">Institute</label>
        <select id="req-inst" className="sel" required value={instituteId} onChange={(e) => setInstituteId(e.target.value)}>
          <option value="">Choose your institute</option>
          {institutes.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="req-note">Who are you there?</label>
        <textarea
          id="req-note"
          className="inp"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Physics teacher for classes 11 and 12, joined in June"
        />
        <p style={{ fontSize: 11, color: "var(--graphite)", margin: "6px 0 0" }}>
          The person approving reads this and decides your role. Be specific.
        </p>
      </div>
      {error && <p style={{ color: "var(--pen)", fontSize: 12.5, margin: "0 0 10px" }}>{error}</p>}
      {sent && <p style={{ color: "var(--ledger)", fontSize: 12.5, margin: "0 0 10px" }}>Request sent. You&rsquo;ll see the answer on this page.</p>}
      <button type="submit" className="btn solid" disabled={pending || !instituteId}>
        {pending ? "Sending…" : "Ask for access"}
      </button>
    </form>
  );
}

export function WithdrawRequestButton({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <button
        type="button"
        className="btn sm ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await withdrawAccessRequest(requestId);
            if (!res.ok) setError(res.message ?? "Failed");
          })
        }
      >
        {pending ? "Withdrawing…" : "Withdraw"}
      </button>
      {error && <span style={{ fontSize: 11, color: "var(--pen)" }}>{error}</span>}
    </span>
  );
}
