"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinBatch, peekJoinCode, type JoinPreview } from "@/server/actions/membership";

/**
 * Two-step join. The institute name is echoed back BEFORE committing — that is
 * what stops a mistyped code putting a student in the wrong institute
 * (BUILD-PLAN C2 item 7), and it is why this is not a single submit.
 */
export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function check() {
    setError(null);
    setPreview(null);
    start(async () => {
      const res = await peekJoinCode(code);
      if (res.ok) setPreview(res.preview);
      else setError(res.message);
    });
  }

  function commit() {
    setError(null);
    start(async () => {
      const res = await joinBatch(code);
      if (res.ok) router.push("/app");
      else setError(res.message ?? "Could not join that batch.");
    });
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="inp"
          placeholder="K7M2QX"
          value={code}
          maxLength={6}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setPreview(null);
            setError(null);
          }}
          style={{
            fontFamily: "var(--mono)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
          aria-label="Batch join code"
        />
        <button className="btn" onClick={check} disabled={pending || code.trim().length < 6}>
          {pending ? "Checking…" : "Check"}
        </button>
      </div>

      {error && (
        <div className="notice warn" style={{ marginTop: 14, marginBottom: 0 }}>
          {error}
        </div>
      )}

      {preview && (
        <div className="notice" style={{ marginTop: 14, marginBottom: 0 }}>
          <b>{preview.instituteName}</b>
          <br />
          {preview.batchName} · Class {preview.className} · {preview.subjectName}
          {preview.alreadyEnrolledBatch && (
            <>
              <br />
              <span style={{ color: "var(--pen)" }}>
                You are already in <b>{preview.alreadyEnrolledBatch}</b> for this subject. A student
                holds one batch per subject — ask your teacher to move you.
              </span>
            </>
          )}
          {!preview.alreadyEnrolledBatch && (
            <>
              <br />
              <span style={{ fontSize: 11.5 }}>
                Check the institute name above before joining.
              </span>
              <div style={{ marginTop: 10 }}>
                <button className="btn solid sm" onClick={commit} disabled={pending}>
                  {pending ? "Joining…" : "Confirm and join"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
