"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/actions/membership";

/**
 * A button that runs a (bound) server action, with an optional inline
 * confirmation for anything consequential. The confirmation names the thing
 * being changed, because "Are you sure?" alone gets clicked through.
 */
export function ActionButton({
  action,
  label,
  pendingLabel,
  className = "btn sm ghost",
  confirm,
  confirmLabel = "Yes",
  doneLabel,
}: {
  action: () => Promise<ActionResult>;
  label: string;
  pendingLabel?: string;
  className?: string;
  confirm?: string;
  confirmLabel?: string;
  doneLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = () =>
    start(async () => {
      setError(null);
      const res = await action();
      if (res.ok) {
        setAsking(false);
        if (doneLabel) setDone(true);
      } else {
        setError(res.message ?? "That did not work.");
      }
    });

  if (done && doneLabel) return <span className="sub" style={{ color: "var(--ledger)" }}>{doneLabel}</span>;

  if (asking && confirm) {
    return (
      <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11.5, color: "var(--pen)", maxWidth: 260 }}>{confirm}</span>
        <button type="button" className="btn sm solid" disabled={pending} onClick={run}>
          {pending ? (pendingLabel ?? "Working…") : confirmLabel}
        </button>
        <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setAsking(false)}>
          Cancel
        </button>
        {error && <span style={{ fontSize: 11.5, color: "var(--pen)" }}>{error}</span>}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => (confirm ? setAsking(true) : run())}
      >
        {pending ? (pendingLabel ?? "Working…") : label}
      </button>
      {error && <span style={{ fontSize: 11.5, color: "var(--pen)" }}>{error}</span>}
    </span>
  );
}
