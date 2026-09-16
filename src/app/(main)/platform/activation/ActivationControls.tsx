"use client";

import { useState, useTransition } from "react";
import { setActivationAction, setBankStatusAction } from "@/server/actions/platform";

/**
 * One matrix cell. Activating a class-subject whose gate is not met asks for
 * a confirmation that repeats the gap — "never flip to active thin" is the
 * rule, and the one time it is broken should be deliberate.
 */
export function ActivationCell({
  instituteId,
  instituteName,
  classSubjectId,
  label,
  active,
  gateGaps,
}: {
  instituteId: string;
  instituteName: string;
  classSubjectId: string;
  label: string;
  active: boolean;
  gateGaps: string[];
}) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (next: boolean) =>
    start(async () => {
      setError(null);
      const res = await setActivationAction(instituteId, classSubjectId, next);
      if (!res.ok) setError(res.message ?? "Failed");
      setAsking(false);
    });

  if (asking) {
    const thin = !active && gateGaps.length > 0;
    return (
      <div style={{ minWidth: 170, textAlign: "left", fontSize: 11.5 }}>
        <div style={{ marginBottom: 6, color: thin ? "var(--pen)" : "var(--ink)" }}>
          {active ? (
            <>Deactivate {label} for <b>{instituteName}</b>? Their teachers stop seeing it.</>
          ) : thin ? (
            <>
              <b>Gate not met.</b> {gateGaps.join("; ")}. Activate for {instituteName} anyway?
            </>
          ) : (
            <>Activate {label} for <b>{instituteName}</b>?</>
          )}
        </div>
        <div className="btnrow">
          <button type="button" className="btn sm solid" disabled={pending} onClick={() => run(!active)}>
            {pending ? "…" : active ? "Deactivate" : "Activate"}
          </button>
          <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setAsking(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAsking(true)}
      title={active ? "Active — click to deactivate" : "Planned — click to activate"}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "block",
        width: "100%",
        fontFamily: "var(--mono)",
        fontSize: 10.5,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {active ? "● active" : "○ planned"}
      {error && <span style={{ display: "block", color: "var(--pen)", textTransform: "none" }}>{error}</span>}
    </button>
  );
}

export function BankStatusSelect({ classSubjectId, status }: { classSubjectId: string; status: string }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 3 }}>
      <select
        className="sel"
        style={{ padding: "4px 6px", fontSize: 12, width: "auto" }}
        value={value}
        disabled={pending}
        aria-label="Bank status"
        onChange={(e) => {
          const next = e.target.value as "planned" | "seeding" | "ready";
          const prev = value;
          setValue(next);
          start(async () => {
            const res = await setBankStatusAction(classSubjectId, next);
            if (!res.ok) {
              setValue(prev);
              setError(res.message ?? "Failed");
            } else setError(null);
          });
        }}
      >
        <option value="planned">planned</option>
        <option value="seeding">seeding</option>
        <option value="ready">ready</option>
      </select>
      {error && <span style={{ fontSize: 11, color: "var(--pen)" }}>{error}</span>}
    </span>
  );
}
