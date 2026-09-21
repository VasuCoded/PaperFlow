"use client";

import { useState, useTransition } from "react";
import {
  listInvitesAction,
  platformInviteAction,
  platformRevokeInviteAction,
  resolveFlagAction,
  retireQuestionAction,
} from "@/server/actions/platform";
import { RevokeButton } from "./PersonLookup";
import { displayIdentity, loginToEmail } from "@/lib/identity";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Resolve, dismiss, or retire the flagged question — each with a note. */
export function FlagActions({
  flagId,
  questionId,
  ownerName,
  flaggingInstitute,
  isPrivate,
}: {
  flagId: string;
  questionId: string;
  ownerName: string;
  flaggingInstitute: string;
  isPrivate: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "resolved" | "dismissed" | "retire">("idle");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) return <span className={`pill ${done === "dismissed" ? "planned" : "active"}`}>{done}</span>;

  if (mode === "idle") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 170 }}>
        <button type="button" className="btn sm solid" onClick={() => setMode("retire")}>Retire question…</button>
        <button type="button" className="btn sm ghost" onClick={() => setMode("resolved")}>Mark resolved…</button>
        <button type="button" className="btn sm ghost" onClick={() => setMode("dismissed")}>Dismiss…</button>
      </div>
    );
  }

  const confirm =
    mode === "retire"
      ? `Retire this ${isPrivate ? `${ownerName}-private` : "shared-bank"} question? It stops appearing in new papers and practice for every institute that can use it; papers already made keep it. All its open flags close.`
      : mode === "resolved"
        ? `Mark ${flaggingInstitute}'s flag resolved (the question was fixed or is fine as it is)?`
        : `Dismiss ${flaggingInstitute}'s flag (nothing is wrong with the question)?`;

  return (
    <div className="notice warn" style={{ margin: 0, padding: "9px 10px", fontSize: 12, maxWidth: 300 }}>
      {confirm}
      <input
        className="inp"
        style={{ padding: "5px 7px", fontSize: 12, marginTop: 8 }}
        placeholder={mode === "retire" ? "Reason (stored in the audit log)" : "Note (stored in the audit log)"}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
      />
      <div className="btnrow" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn sm solid"
          disabled={pending || note.trim().length < 5}
          onClick={() =>
            start(async () => {
              setError(null);
              const res =
                mode === "retire" ? await retireQuestionAction(questionId, note) : await resolveFlagAction(flagId, mode, note);
              if (res.ok) setDone(mode === "retire" ? "retired" : mode);
              else setError(res.message ?? "That did not work.");
            })
          }
        >
          {pending ? "Saving…" : mode === "retire" ? "Retire" : mode === "resolved" ? "Resolve" : "Dismiss"}
        </button>
        <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setMode("idle")}>
          Cancel
        </button>
      </div>
      {error && <p style={{ fontSize: 11.5, color: "var(--pen)", margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}

export function RetireById() {
  const [id, setId] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <div className="field">
        <label htmlFor="retire-id">Question id</label>
        <input id="retire-id" className="inp" style={{ fontFamily: "var(--mono)", fontSize: 12 }} value={id} onChange={(e) => { setId(e.target.value); setConfirming(false); }} placeholder="00000000-0000-0000-0000-000000000000" />
      </div>
      <div className="field">
        <label htmlFor="retire-reason">Reason</label>
        <input id="retire-reason" className="inp" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Answer key wrong in the source; reported by a parent" />
      </div>
      {!confirming ? (
        <button type="button" className="btn sm ghost" disabled={!id.trim() || reason.trim().length < 5} onClick={() => setConfirming(true)}>
          Review…
        </button>
      ) : (
        <div className="notice warn" style={{ margin: 0 }}>
          Retire question <b style={{ fontFamily: "var(--mono)" }}>{id.trim()}</b> from circulation for every institute that can use it?
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn sm solid"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await retireQuestionAction(id, reason);
                  setConfirming(false);
                  if (res.ok) {
                    setMessage({ ok: true, text: "Retired, and its open flags closed." });
                    setId("");
                    setReason("");
                  } else setMessage({ ok: false, text: res.message ?? "That did not work." });
                })
              }
            >
              {pending ? "Retiring…" : "Retire"}
            </button>
            <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && <p style={{ fontSize: 12, marginTop: 8, color: message.ok ? "var(--ledger)" : "var(--pen)" }}>{message.text}</p>}
    </div>
  );
}

type Invite = { id: string; email: string; role: string; created_at: string };

export function InstituteInvites({ institutes }: { institutes: { id: string; name: string }[] }) {
  const [instituteId, setInstituteId] = useState("");
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"institute_admin" | "teacher" | "student">("institute_admin");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const name = institutes.find((i) => i.id === instituteId)?.name ?? "";

  const load = (id: string) =>
    start(async () => {
      setInvites(null);
      if (!id) return;
      const res = await listInvitesAction(id);
      if (res.ok) setInvites(res.invites ?? []);
      else setMessage({ ok: false, text: res.message ?? "Could not load invitations." });
    });

  return (
    <div>
      <div className="field">
        <label htmlFor="inv-inst">Institute</label>
        <select
          id="inv-inst"
          className="sel"
          value={instituteId}
          onChange={(e) => {
            setInstituteId(e.target.value);
            setMessage(null);
            load(e.target.value);
          }}
        >
          <option value="">Choose an institute (loading its invitations is logged)</option>
          {institutes.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      </div>

      {instituteId && (
        <>
          {pending && !invites && <p style={{ fontSize: 12 }}>Loading…</p>}
          {invites && invites.length === 0 && <p style={{ fontSize: 12.5 }}>No pending invitations at {name}.</p>}
          {invites && invites.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {invites.map((i) => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13, padding: "7px 0", borderBottom: "1px solid var(--hair)", flexWrap: "wrap" }}>
                  <span style={{ overflowWrap: "anywhere" }}>
                    {displayIdentity(i.email)}
                    <span className="cap" style={{ display: "block" }}>{i.role.replace("_", " ").toUpperCase()} · {dateFmt.format(new Date(i.created_at)).toUpperCase()}</span>
                  </span>
                  <RevokeButton
                    label={`Revoke ${displayIdentity(i.email)}'s ${i.role.replace("_", " ")} invitation to ${name}?`}
                    run={() => platformRevokeInviteAction(i.id)}
                    onDone={() => load(instituteId)}
                  />
                </div>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setMessage(null);
              start(async () => {
                const res = await platformInviteAction(instituteId, email, role);
                if (res.ok) {
                  setMessage({ ok: true, text: `Invitation recorded: ${displayIdentity(loginToEmail(email))} as ${role.replace("_", " ")} at ${name}. They see it the next time they sign in.` });
                  setEmail("");
                  load(instituteId);
                } else setMessage({ ok: false, text: res.message ?? "Could not invite." });
              });
            }}
          >
            <div className="field">
              <label htmlFor="inv-email">Invite to {name}</label>
              <input id="inv-email" className="inp" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their username (or a Google email)" />
            </div>
            <div className="field">
              <label htmlFor="inv-role">Role</label>
              <select id="inv-role" className="sel" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                <option value="institute_admin">Institute admin</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
              <p style={{ fontSize: 11, color: "var(--graphite)", margin: "6px 0 0" }}>
                Only the platform can invite an institute admin. Re-inviting an address updates the role on its pending invitation.
              </p>
            </div>
            <button type="submit" className="btn sm solid" disabled={pending}>
              {pending ? "Saving…" : "Invite"}
            </button>
          </form>
        </>
      )}
      {message && <p style={{ fontSize: 12, marginTop: 10, color: message.ok ? "var(--ledger)" : "var(--pen)" }}>{message.text}</p>}
    </div>
  );
}
