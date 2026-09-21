"use client";

import { useState } from "react";
import { createClient } from "@/lib/db/client";
import { passwordProblem } from "@/lib/identity";

/** Change your own password (username accounts). Runs in the browser against the signed-in session. */
export function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const hint = password ? passwordProblem(password) : null;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setMessage(null);
        if (password !== confirm) {
          setMessage({ ok: false, text: "The two passwords don't match." });
          return;
        }
        setBusy(true);
        const { error } = await createClient().auth.updateUser({ password });
        setBusy(false);
        if (error) setMessage({ ok: false, text: error.message });
        else {
          setMessage({ ok: true, text: "Password changed." });
          setPassword("");
          setConfirm("");
        }
      }}
    >
      <div className="field">
        <label htmlFor="cp-new">New password</label>
        <input id="cp-new" className="inp" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <p style={{ fontSize: 11, margin: "6px 0 0", color: hint ? "var(--pen)" : "var(--graphite)" }}>
          {hint ?? "At least 8 characters, with a letter and a number."}
        </p>
      </div>
      <div className="field">
        <label htmlFor="cp-confirm">New password again</label>
        <input id="cp-confirm" className="inp" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {message && <p style={{ fontSize: 12.5, margin: "0 0 10px", color: message.ok ? "var(--ledger)" : "var(--pen)" }}>{message.text}</p>}
      <button type="submit" className="btn solid" disabled={busy || !!hint || !password}>
        {busy ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
