"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toastSuccess } from "@/components/motion/toast";
import { MODULE_PRESETS, MODULES, effectiveModules, type ModuleKey, type Modules } from "@/lib/modules";
import {
  deleteInstituteAction,
  setModulesAction,
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
          setMsg(res.ok ? null : { ok: false, text: res.message ?? "That did not work." });
          if (res.ok) {
            toastSuccess("Saved.");
            router.refresh();
          }
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

/**
 * Delete an institute for good. Only once it is suspended, and only with its
 * slug typed; platform_delete_institute checks both again.
 */
export function DeleteInstitute({ instituteId, name, slug, suspended }: { instituteId: string; name: string; slug: string; suspended: boolean }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="danger">
      <div>
        <h3>Delete this institute</h3>
        <p>
          Removes {name} and everything it owns: batches, papers, students&rsquo; logs, practice, its own questions and
          figures, invitations and requests. People&rsquo;s accounts stay; they only lose this institute. This cannot be undone.
        </p>
        {!suspended && <p className="hint" style={{ color: "var(--pen)" }}>Suspend it first (top of this page). Only a suspended institute can be deleted.</p>}
      </div>
      {suspended && (
        <div className="dangerconfirm">
          <input
            className="inp"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`Type ${slug} to confirm`}
            aria-label="Type the institute's slug to confirm"
            autoComplete="off"
          />
          <button
            type="button"
            className="btn solid"
            disabled={pending || typed.trim().toLowerCase() !== slug.toLowerCase()}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await deleteInstituteAction(instituteId, typed);
                if (res.ok) router.replace("/platform/institutes");
                else setError(res.message ?? "Could not delete it.");
              })
            }
          >
            {pending ? "Deleting…" : "Delete institute for good"}
          </button>
          {error && <p className="hint" style={{ color: "var(--pen)" }}>{error}</p>}
        </div>
      )}
    </section>
  );
}

/**
 * The institute's modules: one-click presets, or each switch on its own. A
 * module that needs another is greyed out while that one is off.
 */
export function ModulesPanel({ instituteId, current, teachers, students }: { instituteId: string; current: Modules; teachers: number; students: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Modules>(current);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const effective = effectiveModules(draft);
  const changed = MODULES.some((m) => draft[m.key] !== current[m.key]);
  const preset = MODULE_PRESETS.find((p) => MODULES.every((m) => p.modules[m.key] === effective[m.key]));

  const set = (key: ModuleKey, on: boolean) => setDraft((d) => ({ ...d, [key]: on }));
  const warnings: string[] = [];
  if (current.teachers && !effective.teachers && teachers > 0)
    warnings.push(`${teachers} teacher account${teachers === 1 ? "" : "s"} keep working until removed; no new teachers can join.`);
  if (current.student_app && !effective.student_app && students > 0)
    warnings.push(`${students} student${students === 1 ? "" : "s"} will no longer see papers in the app. Their data is kept.`);

  return (
    <div className="modules">
      <div className="presetrow">
        {MODULE_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`presetcard${preset?.key === p.key ? " on" : ""}`}
            onClick={() => setDraft(p.modules)}
          >
            <b>{p.name}</b>
            <span>{p.blurb}</span>
          </button>
        ))}
      </div>

      <div className="modlist">
        {MODULES.map((m) => {
          const blocked = !!m.requires && !effective[m.requires];
          const on = effective[m.key];
          return (
            <label key={m.key} className={`modrow${blocked ? " blocked" : ""}`}>
              <span className="modtext">
                <b>{m.name}</b>
                <span>{on ? m.blurb : m.whenOff}</span>
                {blocked && <span className="hint" style={{ margin: 0 }}>Needs {MODULES.find((x) => x.key === m.requires)!.name}.</span>}
              </span>
              <span className={`switch${on ? " on" : ""}`}>
                <input
                  type="checkbox"
                  role="switch"
                  checked={on}
                  disabled={blocked || pending}
                  onChange={(e) => set(m.key, e.target.checked)}
                  aria-label={m.name}
                />
                <span className="knob" aria-hidden="true" />
              </span>
            </label>
          );
        })}
      </div>

      {warnings.length > 0 && (
        <div className="notice warn" style={{ marginTop: 12 }}>
          {warnings.map((w) => <div key={w}>{w}</div>)}
        </div>
      )}

      <div className="btnrow" style={{ marginTop: 12, alignItems: "center" }}>
        <button
          type="button"
          className="btn solid"
          disabled={pending || !changed}
          onClick={() =>
            start(async () => {
              setMsg(null);
              const res = await setModulesAction(instituteId, effective);
              if (res.ok) {
                toastSuccess("Modules saved", "The institute sees the change on its next page load.");
                router.refresh();
              } else setMsg({ ok: false, text: res.message ?? "Could not save." });
            })
          }
        >
          {pending ? "Saving…" : "Save modules"}
        </button>
        {changed && (
          <button type="button" className="btn ghost" disabled={pending} onClick={() => setDraft(current)}>
            Undo changes
          </button>
        )}
        {msg && <span className="hint" style={{ margin: 0, color: msg.ok ? "var(--ledger)" : "var(--pen)" }}>{msg.text}</span>}
      </div>
    </div>
  );
}
