"use client";

import { useState, useTransition } from "react";
import { platformSetRoleAction } from "@/server/actions/platform";
import { confirmsIdentity, displayIdentity } from "@/lib/identity";

type Role = "institute_admin" | "teacher" | "student";
const LABEL: Record<Role, string> = { institute_admin: "Institute admin", teacher: "Teacher", student: "Student" };

/**
 * Platform-side role change for one member. Requires typing the person's username:
 * making someone an institute admin hands them the institute.
 */
export function RoleControl({
  instituteId,
  instituteName,
  email,
  name,
  role,
}: {
  instituteId: string;
  instituteName: string;
  email: string;
  name: string;
  role: string;
}) {
  const [next, setNext] = useState<Role | "">("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (role === "owner") return <span style={{ fontSize: 11.5, color: "var(--graphite)" }}>—</span>;

  const choices = (Object.keys(LABEL) as Role[]).filter((r) => r !== role);

  if (!next) {
    return (
      <select
        className="sel"
        style={{ padding: "4px 6px", fontSize: 12, width: "auto" }}
        value=""
        aria-label={`Change ${name}'s role`}
        onChange={(e) => setNext(e.target.value as Role)}
      >
        <option value="">Change role…</option>
        {choices.map((r) => (
          <option key={r} value={r}>{LABEL[r]}</option>
        ))}
      </select>
    );
  }

  return (
    <div style={{ minWidth: 240, maxWidth: 300 }}>
      <p style={{ fontSize: 11.5, margin: "0 0 6px", color: next === "institute_admin" ? "var(--pen)" : "var(--graphite)" }}>
        Make <b>{name}</b> {LABEL[next].toLowerCase()} at <b>{instituteName}</b>?
        {next === "institute_admin" && " They will be able to invite, change roles and export the institute's data."} Type{" "}
        <b style={{ overflowWrap: "anywhere" }}>{displayIdentity(email)}</b> to confirm:
      </p>
      <input className="inp" style={{ fontSize: 11.5, padding: "6px 8px" }} value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Confirm username" autoComplete="off" />
      <div className="btnrow" style={{ marginTop: 6 }}>
        <button
          type="button"
          className="btn sm solid"
          disabled={pending || !confirmsIdentity(typed, email)}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await platformSetRoleAction(instituteId, email, typed, next);
              if (res.ok) {
                setNext("");
                setTyped("");
              } else setError(res.message ?? "That did not work.");
            })
          }
        >
          {pending ? "Saving…" : "Change role"}
        </button>
        <button type="button" className="btn sm ghost" disabled={pending} onClick={() => { setNext(""); setTyped(""); setError(null); }}>
          Cancel
        </button>
      </div>
      {error && <p style={{ fontSize: 11.5, color: "var(--pen)", margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}
