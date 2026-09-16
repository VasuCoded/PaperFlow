"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDemoSession } from "@/demo/session";
import { instituteName } from "@/demo/institutes";
import { INVITES_FOR_KAVYA } from "@/demo/activity";
import { csLabel } from "@/demo/bank";
import { BATCHES } from "@/demo/activity";

/**
 * The "you belong to nothing yet" screen (BUILD-PLAN 4.3 / C2 item 2).
 * A new Google sign-in carries no role and no institute. This screen offers an
 * invite to accept or a batch code to enter — and nothing else. No signup form,
 * no institute creation, no role selection.
 */
export default function WelcomePage() {
  const { account, ready } = useDemoSession();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [peek, setPeek] = useState<null | { ok: boolean; message: string; batch?: string; inst?: string; subject?: string }>(null);
  const [accepted, setAccepted] = useState<string | null>(null);

  if (!ready) return <div className="wrap"><p className="eyebrow">Loading</p></div>;

  const invites = account?.id === "acc-kavya" ? INVITES_FOR_KAVYA : [];

  function checkCode() {
    const c = code.trim().toUpperCase();
    const batch = BATCHES.find((b) => b.joinCode === c && b.active);
    if (!batch) {
      setPeek({ ok: false, message: "No active batch has that code. Check it with your teacher." });
      return;
    }
    setPeek({
      ok: true,
      message: "Found it.",
      batch: batch.name,
      inst: instituteName(batch.instituteId),
      subject: csLabel(batch.classSubjectId),
    });
  }

  return (
    <div className="wrap narrow">
      <header className="masthead">
        <div>
          <p className="eyebrow">Signed in · no institute yet</p>
          <h1>
            You&rsquo;re signed in. <em>Now you need an invite or a code.</em>
          </h1>
          <p>
            Signing in with Google proves who you are. It does not grant a role and does not put
            you in an institute — that only happens when an institute invites you, or when you
            enter a batch code from your teacher.
          </p>
        </div>
      </header>

      <div className="cards c2">
        <div className="card">
          <h4>Invitations for {account?.email}</h4>
          {invites.length === 0 ? (
            <>
              <p style={{ marginTop: 8 }}>
                Nothing waiting for this email. If you were expecting an invite, ask your institute
                to send it to the address you signed in with.
              </p>
              <div className="notice plain" style={{ marginTop: 14, marginBottom: 0 }}>
                An invite is matched on your <b>verified</b> email, case-insensitively. It cannot be
                claimed by anyone else.
              </div>
            </>
          ) : (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {invites.map((inv) => (
                <div key={inv.id} className="card tinted" style={{ padding: "12px 13px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div>
                      <b style={{ fontSize: 13.5 }}>{instituteName(inv.instituteId)}</b>
                      <div className="cap" style={{ marginTop: 3 }}>
                        AS {inv.role.toUpperCase()} · SENT BY {inv.sentBy} · {inv.sent}
                      </div>
                    </div>
                    {accepted === inv.id ? (
                      <span className="pill active">Accepted</span>
                    ) : (
                      <button
                        className="btn solid sm"
                        onClick={() => {
                          setAccepted(inv.id);
                          setTimeout(() => router.push("/demo/teacher/generate"), 700);
                        }}
                      >
                        Accept
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <p style={{ fontSize: 12, color: "var(--graphite)", margin: 0 }}>
                Accepting writes one membership row with the role you were invited as. You cannot
                change that role here.
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <h4>Join a batch with a code</h4>
          <p style={{ marginBottom: 12 }}>
            Six characters from your teacher. Students join this way.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="inp"
              placeholder="K7M2QX"
              value={code}
              maxLength={6}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setPeek(null);
              }}
              style={{ fontFamily: "var(--mono)", letterSpacing: "0.18em", textTransform: "uppercase" }}
              aria-label="Batch join code"
            />
            <button className="btn" onClick={checkCode} disabled={code.trim().length < 6}>
              Check
            </button>
          </div>

          {peek && !peek.ok && (
            <div className="notice warn" style={{ marginTop: 14, marginBottom: 0 }}>
              {peek.message}
            </div>
          )}
          {peek && peek.ok && (
            <div className="notice" style={{ marginTop: 14, marginBottom: 0 }}>
              <b>{peek.inst}</b>
              <br />
              {peek.batch} · {peek.subject}
              <br />
              <span style={{ fontSize: 11.5 }}>
                The institute name is shown before you confirm — that is what stops a mistyped code
                putting you in the wrong institute.
              </span>
              <div style={{ marginTop: 10 }}>
                <button className="btn solid sm" onClick={() => router.push("/demo/app")}>
                  Confirm and join
                </button>
              </div>
            </div>
          )}

          <p style={{ fontSize: 11.5, color: "var(--graphite)", marginTop: 14 }}>
            Try <span style={{ fontFamily: "var(--mono)" }}>K7M2QX</span> (Sunrise, Class 12
            Biology) or <span style={{ fontFamily: "var(--mono)" }}>M9ZB4K</span> (Vidya Bhavan).
          </p>
        </div>
      </div>

      <div className="notice plain" style={{ marginTop: 18 }}>
        There is deliberately no third option on this screen. No &ldquo;create an institute&rdquo;,
        no &ldquo;I am a teacher&rdquo; checkbox, no role dropdown — a form that lets a user
        influence their own role is the one thing the invite system exists to prevent.
      </div>
    </div>
  );
}
