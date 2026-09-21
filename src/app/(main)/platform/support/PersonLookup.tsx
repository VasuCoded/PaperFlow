"use client";

import { useState, useTransition } from "react";
import {
  correctAttemptSetAction,
  moveStudentAction,
  platformResetPassword,
  platformRevokeInviteAction,
  supportLookupAction,
  type SupportLookup,
} from "@/server/actions/platform";
import { confirmsIdentity, displayIdentity, isUsernameEmail } from "@/lib/identity";

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * One consequential change, with a reason and a confirmation that names the
 * institute and the person (C2b: "Each one needs a confirmation naming the
 * institute and the person").
 */
function ReasonedChange({
  options,
  placeholder,
  confirmText,
  run,
  onDone,
}: {
  options: { id: string; label: string }[];
  placeholder: string;
  confirmText: (optionLabel: string) => string;
  run: (optionId: string, reason: string) => Promise<{ ok: boolean; message?: string }>;
  onDone: () => void;
}) {
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (options.length === 0) return <span style={{ fontSize: 11.5, color: "var(--graphite)" }}>No alternative</span>;

  const label = options.find((o) => o.id === choice)?.label ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220, maxWidth: 320 }}>
      {!confirming ? (
        <>
          <select className="sel" style={{ padding: "5px 7px", fontSize: 12 }} value={choice} onChange={(e) => setChoice(e.target.value)} aria-label={placeholder}>
            <option value="">{placeholder}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          {choice && (
            <>
              <input
                className="inp"
                style={{ padding: "5px 7px", fontSize: 12 }}
                placeholder="Reason (stored in the audit log)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
              />
              <button type="button" className="btn sm ghost" disabled={reason.trim().length < 5} onClick={() => setConfirming(true)}>
                Review change…
              </button>
            </>
          )}
        </>
      ) : (
        <div className="notice warn" style={{ margin: 0, padding: "9px 10px", fontSize: 12 }}>
          {confirmText(label)}
          <div style={{ marginTop: 4, color: "var(--graphite)" }}>Reason: {reason.trim()}</div>
          <div className="btnrow" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn sm solid"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await run(choice, reason);
                  if (res.ok) {
                    setConfirming(false);
                    setChoice("");
                    setReason("");
                    onDone();
                  } else setError(res.message ?? "That did not work.");
                })
              }
            >
              {pending ? "Applying…" : "Apply"}
            </button>
            <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setConfirming(false)}>
              Back
            </button>
          </div>
        </div>
      )}
      {error && <span style={{ fontSize: 11.5, color: "var(--pen)" }}>{error}</span>}
    </div>
  );
}

export function PersonLookup() {
  const [email, setEmail] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const [result, setResult] = useState<SupportLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const lookup = (target: string, after?: string) =>
    start(async () => {
      setError(null);
      const res = await supportLookupAction(target);
      if (res.ok && res.result) {
        setResult(res.result);
        setSearched(target.trim().toLowerCase());
        setNotice(after ?? null);
      } else {
        setError(res.message ?? "Lookup failed.");
      }
    });

  const person = result?.user ? (result.user.full_name ?? displayIdentity(result.user.email)) : displayIdentity(searched ?? "");
  const nothing =
    result && !result.user && result.invites.length === 0;

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(email);
        }}
        className="btnrow"
        style={{ alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}
      >
        <div style={{ flex: "1 1 260px" }}>
          <label htmlFor="support-email" style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
            Username (or email) of the student, teacher or admin
          </label>
          <input id="support-email" className="inp" autoCapitalize="none" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. ravi.kumar" />
        </div>
        <button type="submit" className="btn solid" disabled={pending}>
          {pending ? "Looking…" : "Look up"}
        </button>
      </form>
      <p style={{ fontSize: 11.5, color: "var(--graphite)", margin: "0 0 14px" }}>
        A lookup is logged against every institute it shows data from.
      </p>

      {error && <div className="notice warn">{error}</div>}
      {notice && <div className="notice">{notice}</div>}
      {nothing && <p className="lede">No account and no pending invite for {displayIdentity(searched ?? "")}.</p>}

      {result && !nothing && (
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <h4>{result.user ? person : `${displayIdentity(searched ?? "")} — no account yet`}</h4>
            {result.user?.full_name && <p style={{ margin: 0 }}>{displayIdentity(result.user.email)}</p>}
            {result.user && isUsernameEmail(result.user.email) && <PlatformReset email={result.user.email} />}
            <div className="chips">
              {result.memberships.length === 0 && result.user && <span className="chip dim">No institute memberships</span>}
              {result.memberships.map((m) => (
                <span key={m.institute_id} className={`chip${m.institute_status === "active" ? "" : " dim"}`}>
                  {m.institute_name} · {m.role.replace("_", " ")}
                  {m.institute_status !== "active" ? " · suspended" : ""}
                </span>
              ))}
            </div>
          </div>

          {result.attempts.length > 0 && (
            <>
              <h2 className="sect">Logged attempts — correct the set</h2>
              <div className="tablewrap">
                <table className="lt">
                  <thead>
                    <tr><th>Paper</th><th>Institute</th><th>Logged as</th><th className="num">Wrong</th><th>Logged</th><th>Correct to</th></tr>
                  </thead>
                  <tbody>
                    {result.attempts.map((a) => (
                      <tr key={a.id}>
                        <td><b>{a.paper_title}</b></td>
                        <td>{a.institute_name}</td>
                        <td>Set {a.set_label ?? "?"}</td>
                        <td className="num">{a.wrong}</td>
                        <td style={{ whiteSpace: "nowrap" }}>{dateFmt.format(new Date(a.logged_at))}</td>
                        <td>
                          <ReasonedChange
                            options={a.sets.filter((s) => s.id !== a.set_id).map((s) => ({ id: s.id, label: `Set ${s.label}` }))}
                            placeholder="Choose the set they wrote"
                            confirmText={(label) =>
                              `Change ${person}'s attempt on "${a.paper_title}" at ${a.institute_name} from Set ${a.set_label ?? "?"} to ${label}? Their right/wrong marks are remapped by position and their practice set is rebuilt.`
                            }
                            run={(setId, reason) => correctAttemptSetAction(a.id, setId, reason)}
                            onDone={() => lookup(searched ?? email, `Set corrected for ${person}.`)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {result.enrolments.length > 0 && (
            <>
              <h2 className="sect">Enrolments — move between batches</h2>
              <div className="tablewrap">
                <table className="lt">
                  <thead>
                    <tr><th>Subject</th><th>Institute</th><th>Batch</th><th>Move to</th></tr>
                  </thead>
                  <tbody>
                    {result.enrolments.map((e) => (
                      <tr key={`${e.institute_id}:${e.class_subject_id}`}>
                        <td><b>{e.label}</b></td>
                        <td>{e.institute_name}</td>
                        <td>{e.batch_name}</td>
                        <td>
                          <ReasonedChange
                            options={e.other_batches.map((b) => ({ id: b.id, label: b.name }))}
                            placeholder="Choose an open batch"
                            confirmText={(label) => `Move ${person} at ${e.institute_name} from ${e.batch_name} to ${label} (${e.label})?`}
                            run={(batchId, reason) => (result.user ? moveStudentAction(e.institute_id, result.user.id, batchId, reason) : Promise.resolve({ ok: false, message: "No account." }))}
                            onDone={() => lookup(searched ?? email, `${person} moved.`)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {result.invites.length > 0 && (
            <>
              <h2 className="sect">Pending invitations</h2>
              <div className="tablewrap">
                <table className="lt">
                  <thead>
                    <tr><th>Institute</th><th>Role</th><th>Created</th><th /></tr>
                  </thead>
                  <tbody>
                    {result.invites.map((i) => (
                      <tr key={i.id}>
                        <td><b>{i.institute_name}</b></td>
                        <td>{i.role.replace("_", " ")}</td>
                        <td>{dateFmt.format(new Date(i.created_at))}</td>
                        <td>
                          <RevokeButton
                            label={`Revoke ${displayIdentity(searched ?? "")}'s ${i.role.replace("_", " ")} invitation to ${i.institute_name}?`}
                            run={() => platformRevokeInviteAction(i.id)}
                            onDone={() => lookup(searched ?? email, "Invitation revoked.")}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--graphite)" }}>
                There is no &ldquo;resend&rdquo;: PaperFlow sends no email. An invitation is matched when the person signs in
                with Google using this address — tell them that.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function RevokeButton({
  label,
  run,
  onDone,
}: {
  label: string;
  run: () => Promise<{ ok: boolean; message?: string }>;
  onDone: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!asking) {
    return (
      <button type="button" className="btn sm ghost" onClick={() => setAsking(true)}>
        Revoke…
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, alignItems: "center", maxWidth: 320 }}>
      <span style={{ fontSize: 11.5, color: "var(--pen)" }}>{label}</span>
      <button
        type="button"
        className="btn sm solid"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await run();
            if (res.ok) {
              setAsking(false);
              onDone();
            } else setError(res.message ?? "Failed");
          })
        }
      >
        {pending ? "Revoking…" : "Revoke"}
      </button>
      <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setAsking(false)}>
        Cancel
      </button>
      {error && <span style={{ fontSize: 11.5, color: "var(--pen)" }}>{error}</span>}
    </span>
  );
}


/** Platform: issue a temporary password for a username account (logged). */
function PlatformReset({ email }: { email: string }) {
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = displayIdentity(email);

  if (password) {
    return (
      <div className="notice" style={{ marginTop: 10, marginBottom: 0 }}>
        New password for <b>{shown}</b>: <b style={{ fontFamily: "var(--mono)", userSelect: "all" }}>{password}</b> — shown once.
      </div>
    );
  }
  if (!asking) {
    return (
      <button type="button" className="btn sm ghost" style={{ marginTop: 10 }} onClick={() => setAsking(true)}>
        Reset password…
      </button>
    );
  }
  return (
    <div className="notice warn" style={{ marginTop: 10, marginBottom: 0, fontSize: 12 }}>
      Their current password stops working. Type <b>{shown}</b> to confirm:
      <input className="inp" style={{ fontSize: 12, padding: "5px 7px", marginTop: 6 }} value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Confirm username" autoComplete="off" />
      <div className="btnrow" style={{ marginTop: 6 }}>
        <button
          type="button"
          className="btn sm solid"
          disabled={pending || !confirmsIdentity(typed, email)}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await platformResetPassword(email, typed);
              if (res.ok && res.password) setPassword(res.password);
              else setError(res.message ?? "That did not work.");
            })
          }
        >
          {pending ? "Resetting…" : "Reset password"}
        </button>
        <button type="button" className="btn sm ghost" disabled={pending} onClick={() => setAsking(false)}>Cancel</button>
      </div>
      {error && <p style={{ fontSize: 11.5, color: "var(--pen)", margin: "6px 0 0" }}>{error}</p>}
    </div>
  );
}
