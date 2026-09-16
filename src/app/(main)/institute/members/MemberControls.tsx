"use client";

import { useState, useTransition } from "react";
import { changeMemberRole, inviteMember, removeMember, revokeInvite } from "@/server/actions/institute";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSent(null);
        start(async () => {
          const res = await inviteMember(email, role);
          if (res.ok) {
            setSent(email.trim().toLowerCase());
            setEmail("");
          } else setError(res.message ?? "Could not invite.");
        });
      }}
    >
      <div className="field">
        <label htmlFor="invite-email">Google account email</label>
        <input id="invite-email" className="inp" type="email" required placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="invite-role">Role</label>
        <select id="invite-role" className="sel" value={role} onChange={(e) => setRole(e.target.value as "teacher" | "student")}>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>
        <p style={{ fontSize: 11, color: "var(--graphite)", margin: "6px 0 0" }}>
          This dropdown offers two roles only. Institute admin and owner are deliberately absent, not hidden.
        </p>
      </div>
      {error && <p style={{ color: "var(--pen)", fontSize: 12.5, margin: "0 0 10px" }}>{error}</p>}
      {sent && (
        <p style={{ color: "var(--ledger)", fontSize: 12.5, margin: "0 0 10px" }}>
          Invitation recorded for {sent}. PaperFlow does not send email — tell them to sign in with Google using that address.
        </p>
      )}
      <button type="submit" className="gen" disabled={pending}>
        {pending ? "Inviting…" : "Invite"}
      </button>
    </form>
  );
}

export function RevokeInviteButton({ inviteId, email }: { inviteId: string; email: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <button
        type="button"
        className="btn sm ghost"
        disabled={pending}
        aria-label={`Revoke invitation for ${email}`}
        onClick={() =>
          start(async () => {
            const res = await revokeInvite(inviteId);
            if (!res.ok) setError(res.message ?? "Failed");
          })
        }
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
      {error && <span style={{ fontSize: 11, color: "var(--pen)" }}>{error}</span>}
    </span>
  );
}

/**
 * Role change and removal. Both require typing the person's email: a role
 * change is the most consequential thing an institute admin can do, and a
 * confirmation that can be clicked through will be.
 */
export function MemberActions({
  userId,
  email,
  role,
  isSelf,
}: {
  userId: string;
  email: string;
  role: string;
  isSelf: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "role" | "remove">("idle");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (role === "institute_admin" || role === "owner") {
    return <span style={{ fontSize: 11.5, color: "var(--graphite)" }}>{isSelf ? "You" : "Platform only"}</span>;
  }

  const next = role === "teacher" ? "student" : "teacher";
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  if (mode === "idle") {
    return (
      <div className="btnrow">
        <button type="button" className="btn sm ghost" onClick={() => setMode("role")}>Make {next}</button>
        <button type="button" className="btn sm ghost" onClick={() => setMode("remove")}>Remove</button>
      </div>
    );
  }

  return (
    <div style={{ minWidth: 230 }}>
      <p style={{ fontSize: 11.5, margin: "0 0 6px", color: mode === "remove" ? "var(--pen)" : "var(--graphite)" }}>
        {mode === "remove" ? (
          <>Removing ends their access and deletes their {role === "teacher" ? "subject assignments" : "enrolments"}. </>
        ) : null}
        Type <b style={{ overflowWrap: "anywhere" }}>{email}</b> to confirm:
      </p>
      <input
        className="inp"
        style={{ fontSize: 11.5, padding: "6px 8px" }}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        aria-label="Confirm email"
        autoComplete="off"
      />
      <div className="btnrow" style={{ marginTop: 6 }}>
        <button
          type="button"
          className="btn sm solid"
          disabled={!matches || pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = mode === "role" ? await changeMemberRole(email, typed, next) : await removeMember(userId);
              if (res.ok) {
                setMode("idle");
                setTyped("");
              } else setError(res.message ?? "That did not work.");
            })
          }
        >
          {pending ? "Saving…" : mode === "role" ? `Make ${next}` : "Remove"}
        </button>
        <button type="button" className="btn sm ghost" disabled={pending} onClick={() => { setMode("idle"); setTyped(""); setError(null); }}>
          Cancel
        </button>
      </div>
      {error && <p style={{ fontSize: 11.5, color: "var(--pen)", margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}
