"use client";

import { useState, useTransition } from "react";
import { changeMemberRole, inviteMember, removeMember, resetMemberPassword, revokeInvite } from "@/server/actions/institute";
import { confirmsIdentity, displayIdentity, isUsernameEmail } from "@/lib/identity";

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
            setSent(email.trim().replace(/^@/, "").toLowerCase());
            setEmail("");
          } else setError(res.message ?? "Could not invite.");
        });
      }}
    >
      <div className="field">
        <label htmlFor="invite-email">Their username</label>
        <input id="invite-email" className="inp" autoCapitalize="none" spellCheck={false} required placeholder="e.g. ravi.kumar (or a Google email)" value={email} onChange={(e) => setEmail(e.target.value)} />
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
          Invitation recorded for {sent.includes("@") ? sent : `@${sent}`}. They will see it the next time they sign in.
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
 * Role change and removal. Both require typing the person's username: a role
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
  const [mode, setMode] = useState<"idle" | "role" | "remove" | "reset">("idle");
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (role === "institute_admin" || role === "owner") {
    return <span style={{ fontSize: 11.5, color: "var(--graphite)" }}>{isSelf ? "You" : "Platform only"}</span>;
  }

  const next = role === "teacher" ? "student" : "teacher";
  const matches = confirmsIdentity(typed, email);
  const shown = displayIdentity(email);

  if (newPassword) {
    return (
      <div className="notice" style={{ margin: 0, padding: "9px 10px", fontSize: 12, minWidth: 230 }}>
        New password for <b>{shown}</b>:{" "}
        <b style={{ fontFamily: "var(--mono)", fontSize: 13, userSelect: "all" }}>{newPassword}</b>
        <div style={{ marginTop: 4, color: "var(--graphite)" }}>Shown once. Give it to them; they can change it under Me → Password.</div>
        <button type="button" className="btn sm ghost" style={{ marginTop: 6 }} onClick={() => setNewPassword(null)}>Done</button>
      </div>
    );
  }

  if (mode === "idle") {
    return (
      <div className="btnrow">
        <button type="button" className="btn sm ghost" onClick={() => setMode("role")}>Make {next}</button>
        {isUsernameEmail(email) && (
          <button type="button" className="btn sm ghost" onClick={() => setMode("reset")}>Reset password</button>
        )}
        <button type="button" className="btn sm ghost" onClick={() => setMode("remove")}>Remove</button>
      </div>
    );
  }

  return (
    <div style={{ minWidth: 230 }}>
      <p style={{ fontSize: 11.5, margin: "0 0 6px", color: mode === "remove" ? "var(--pen)" : "var(--graphite)" }}>
        {mode === "remove" ? (
          <>Removing ends their access and deletes their {role === "teacher" ? "subject assignments" : "enrolments"}. </>
        ) : mode === "reset" ? (
          <>Their current password stops working; you get a new one to give them. </>
        ) : null}
        Type <b style={{ overflowWrap: "anywhere" }}>{shown}</b> to confirm:
      </p>
      <input
        className="inp"
        style={{ fontSize: 11.5, padding: "6px 8px" }}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        aria-label="Confirm username"
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
              if (mode === "reset") {
                const res = await resetMemberPassword(userId, typed);
                if (res.ok && res.password) {
                  setNewPassword(res.password);
                  setMode("idle");
                  setTyped("");
                } else setError(res.message ?? "That did not work.");
                return;
              }
              const res = mode === "role" ? await changeMemberRole(email, typed, next) : await removeMember(userId);
              if (res.ok) {
                setMode("idle");
                setTyped("");
              } else setError(res.message ?? "That did not work.");
            })
          }
        >
          {pending ? "Saving…" : mode === "role" ? `Make ${next}` : mode === "reset" ? "Reset password" : "Remove"}
        </button>
        <button type="button" className="btn sm ghost" disabled={pending} onClick={() => { setMode("idle"); setTyped(""); setError(null); }}>
          Cancel
        </button>
      </div>
      {error && <p style={{ fontSize: 11.5, color: "var(--pen)", margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}
