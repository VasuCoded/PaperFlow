"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  listInvitesAction,
  platformInviteAction,
  platformRevokeInviteAction,
  updateInstituteAction,
} from "@/server/actions/platform";
import { displayIdentity } from "@/lib/identity";

const ROLE_LABEL = { institute_admin: "Institute admin", teacher: "Teacher", student: "Student" } as const;
type Role = keyof typeof ROLE_LABEL;
const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Rename the institute, or change its contact email. */
export function EditInstituteForm({ instituteId, name, contactEmail }: { instituteId: string; name: string; contactEmail: string | null }) {
  const router = useRouter();
  const [n, setN] = useState(name);
  const [c, setC] = useState(contactEmail ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="formgrid"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await updateInstituteAction(instituteId, n, c);
          setMsg(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.message ?? "That did not work." });
          if (res.ok) router.refresh();
        });
      }}
    >
      <div className="field">
        <label htmlFor="inst-name">Name</label>
        <input id="inst-name" className="inp" value={n} onChange={(e) => setN(e.target.value)} maxLength={120} required />
      </div>
      <div className="field">
        <label htmlFor="inst-contact">Contact email</label>
        <input id="inst-contact" className="inp" type="email" value={c} onChange={(e) => setC(e.target.value)} placeholder="optional" />
      </div>
      <div className="btnrow" style={{ alignItems: "center" }}>
        <button type="submit" className="btn solid" disabled={pending || (n === name && c === (contactEmail ?? ""))}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        {msg && <span style={{ fontSize: 12.5, color: msg.ok ? "var(--ledger)" : "var(--pen)" }}>{msg.text}</span>}
      </div>
      <p className="hint">The code printed on this institute&rsquo;s papers stays the same when you rename it.</p>
    </form>
  );
}

/** Invite someone to this institute by username (or Google email), in any role. */
export function PlatformInviteForm({ instituteId }: { instituteId: string }) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [role, setRole] = useState<Role>("teacher");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await platformInviteAction(instituteId, login.trim(), role);
          if (res.ok) {
            setMsg({ ok: true, text: `Invited ${login.trim()} as ${ROLE_LABEL[role].toLowerCase()}. They see it when they next sign in.` });
            setLogin("");
            router.refresh();
          } else setMsg({ ok: false, text: res.message ?? "That did not work." });
        });
      }}
    >
      <div className="inline-form">
        <input
          className="inp"
          placeholder="Username"
          aria-label="Username or Google email"
          autoCapitalize="none"
          spellCheck={false}
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          required
        />
        <select className="sel" value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Role">
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <button type="submit" className="btn solid" disabled={pending || !login.trim()}>
          {pending ? "Inviting…" : "Invite"}
        </button>
      </div>
      {msg && <p className="hint" style={{ color: msg.ok ? "var(--ledger)" : "var(--pen)" }}>{msg.text}</p>}
    </form>
  );
}

/**
 * Pending invitations. Reading them is an audited call (platform_list_invites
 * logs the read), so the list loads only when asked for.
 */
export function InvitesPanel({ instituteId }: { instituteId: string }) {
  const [invites, setInvites] = useState<{ id: string; email: string; role: string; created_at: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const load = () =>
    start(async () => {
      setError(null);
      const res = await listInvitesAction(instituteId);
      if (res.ok) setInvites(res.invites ?? []);
      else setError(res.message ?? "Could not load invitations.");
    });

  if (invites === null) {
    return (
      <div className="empty">
        <p>Invitations that have not been accepted yet. Opening the list is logged, like opening this page.</p>
        <button type="button" className="btn" onClick={load} disabled={pending}>
          {pending ? "Loading…" : "Show pending invitations"}
        </button>
        {error && <p className="hint" style={{ color: "var(--pen)" }}>{error}</p>}
      </div>
    );
  }
  if (invites.length === 0) return <div className="empty"><p>No pending invitations.</p></div>;
  return (
    <div className="tablewrap">
      <table className="lt">
        <thead>
          <tr><th>Invited</th><th>Role</th><th>Sent</th><th /></tr>
        </thead>
        <tbody>
          {invites.map((i) => (
            <tr key={i.id}>
              <td><b>{displayIdentity(i.email)}</b></td>
              <td>{ROLE_LABEL[i.role as Role] ?? i.role}</td>
              <td>{dateFmt.format(new Date(i.created_at))}</td>
              <td style={{ textAlign: "right" }}>
                <button
                  type="button"
                  className="btn sm ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await platformRevokeInviteAction(i.id);
                      if (res.ok) setInvites((cur) => (cur ?? []).filter((x) => x.id !== i.id));
                      else setError(res.message ?? "That did not work.");
                    })
                  }
                >
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p className="hint" style={{ color: "var(--pen)", padding: "0 14px" }}>{error}</p>}
    </div>
  );
}
