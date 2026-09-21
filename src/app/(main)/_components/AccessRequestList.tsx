"use client";

import { useState, useTransition } from "react";
import { decideAccessRequest } from "@/server/actions/institute";
import { platformDecideAccessRequest } from "@/server/actions/platform";

export interface PendingAccessRequest {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  note: string | null;
  created_at: string;
  institute_name?: string;
}

type Role = "institute_admin" | "teacher" | "student";
const LABEL: Record<Role, string> = { institute_admin: "Institute admin", teacher: "Teacher", student: "Student" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

function who(r: PendingAccessRequest): string {
  const handle = r.username ? `@${r.username}` : (r.email ?? "");
  return r.full_name ? `${r.full_name} (${handle})` : handle;
}

/**
 * People asking to join. The approver reads the note and chooses the role;
 * the requester never chose one (CLAUDE.md). Institute admins can grant
 * teacher or student; the platform can also make institute admins.
 */
export function AccessRequestList({ requests, mode }: { requests: PendingAccessRequest[]; mode: "institute" | "platform" }) {
  if (requests.length === 0) return <p className="lede">Nobody is waiting.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {requests.map((r) => (
        <RequestRow key={r.id} r={r} mode={mode} />
      ))}
    </div>
  );
}

function RequestRow({ r, mode }: { r: PendingAccessRequest; mode: "institute" | "platform" }) {
  const roles: Role[] = mode === "platform" ? ["teacher", "student", "institute_admin"] : ["teacher", "student"];
  const [role, setRole] = useState<Role | "">("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const decide = (approve: boolean) =>
    start(async () => {
      setError(null);
      const res =
        mode === "platform"
          ? await platformDecideAccessRequest(r.id, approve, approve ? (role || null) : null, reason)
          : await decideAccessRequest(r.id, approve, approve ? ((role || null) as "teacher" | "student" | null) : null, reason);
      if (res.ok) setDone(approve ? `Approved as ${LABEL[role as Role].toLowerCase()}` : "Declined");
      else setError(res.message ?? "That did not work.");
    });

  return (
    <div className="card" style={{ opacity: done ? 0.65 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h4 style={{ margin: 0 }}>{who(r)}</h4>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--graphite)" }}>
            {r.institute_name ? <>Asking to join <b style={{ color: "var(--ink)" }}>{r.institute_name}</b> · </> : null}
            {dateFmt.format(new Date(r.created_at))}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 13 }}>
            {r.note ? <>&ldquo;{r.note}&rdquo;</> : <span style={{ color: "var(--graphite)" }}>No note. Check who this is before approving.</span>}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 210 }}>
          {done ? (
            <span className={`pill ${done === "Declined" ? "suspended" : "active"}`}>{done}</span>
          ) : declining ? (
            <>
              <input
                className="inp"
                style={{ fontSize: 12, padding: "6px 8px" }}
                placeholder="Reason they will see"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                aria-label="Reason for declining"
              />
              <div className="btnrow">
                <button type="button" className="btn sm solid" disabled={pending || reason.trim().length < 3} onClick={() => decide(false)}>
                  {pending ? "Declining…" : "Decline"}
                </button>
                <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setDeclining(false)}>
                  Back
                </button>
              </div>
            </>
          ) : (
            <>
              <select
                className="sel"
                style={{ fontSize: 12, padding: "5px 7px" }}
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                aria-label={`Role for ${who(r)}`}
              >
                <option value="">Approve as…</option>
                {roles.map((x) => (
                  <option key={x} value={x}>{LABEL[x]}</option>
                ))}
              </select>
              {role === "institute_admin" && (
                <span style={{ fontSize: 11.5, color: "var(--pen)" }}>
                  An institute admin can invite and approve people, change roles and export the institute&rsquo;s data.
                </span>
              )}
              <div className="btnrow">
                <button type="button" className="btn sm solid" disabled={pending || !role} onClick={() => decide(true)}>
                  {pending ? "Approving…" : "Approve"}
                </button>
                <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setDeclining(true)}>
                  Decline…
                </button>
              </div>
            </>
          )}
          {error && <span style={{ fontSize: 11.5, color: "var(--pen)" }}>{error}</span>}
        </div>
      </div>
    </div>
  );
}
