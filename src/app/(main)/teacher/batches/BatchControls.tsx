"use client";

import { useState, useTransition } from "react";
import { createBatch, rotateJoinCode, setBatchActive } from "@/server/actions/teacher";

export function RotateCodeButton({ batchId, disabled }: { batchId: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: "var(--pen)" }}>Old code stops working.</span>
        <button
          type="button"
          className="btn sm solid"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await rotateJoinCode(batchId);
              if (!res.ok) setError(res.message ?? "Could not rotate.");
              setConfirming(false);
            })
          }
        >
          {pending ? "Rotating…" : "Rotate"}
        </button>
        <button type="button" className="btn sm ghost" onClick={() => setConfirming(false)}>Cancel</button>
        {error && <span style={{ fontSize: 11.5, color: "var(--pen)" }}>{error}</span>}
      </span>
    );
  }
  return (
    <button type="button" className="btn sm ghost" disabled={disabled} onClick={() => setConfirming(true)}>
      Rotate code
    </button>
  );
}

export function ActiveToggle({ batchId, active }: { batchId: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn sm ghost"
      disabled={pending}
      onClick={() => start(async () => { await setBatchActive(batchId, !active); })}
    >
      {active ? "Close batch" : "Reopen"}
    </button>
  );
}

export function CreateBatchForm({ subjects }: { subjects: { id: string; label: string }[] }) {
  const [name, setName] = useState("");
  const [cs, setCs] = useState(subjects[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [pending, start] = useTransition();

  if (subjects.length === 0) {
    return <p style={{ fontSize: 12.5, color: "var(--graphite)" }}>You need an assigned subject before you can create a batch.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setCreated(false);
        start(async () => {
          const res = await createBatch(name, cs);
          if (res.ok) {
            setName("");
            setCreated(true);
          } else setError(res.message ?? "Could not create the batch.");
        });
      }}
    >
      <div className="field">
        <label htmlFor="bn">Batch name</label>
        <input className="inp" id="bn" placeholder="12B-EVE" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="bs">Class and subject</label>
        <select className="sel" id="bs" value={cs} onChange={(e) => setCs(e.target.value)}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>
      <button className="gen" type="submit" disabled={pending || name.trim().length < 2}>
        {pending ? "Creating…" : "Create batch and generate code"}
      </button>
      {error && <div className="notice warn" style={{ marginTop: 10, marginBottom: 0 }}>{error}</div>}
      {created && <div className="notice" style={{ marginTop: 10, marginBottom: 0 }}>Batch created — its join code is in the table.</div>}
    </form>
  );
}
