"use client";

import { useState } from "react";
import { Shell } from "../../_components/Shell";
import { STAGING_QUEUE } from "@/demo/activity";
import { instituteName, PLATFORM_ID } from "@/demo/institutes";
import { csLabel } from "@/demo/bank";

type Decision = "approved" | "rejected" | "promoted";

export default function BankQueuePage() {
  const [decided, setDecided] = useState<Record<string, Decision>>({});
  const [confirmPromote, setConfirmPromote] = useState<string | null>(null);
  const queue = STAGING_QUEUE;
  const left = queue.filter((q) => !decided[q.id]);

  return (
    <Shell
      area="platform"
      eyebrow="Platform · review queue"
      title={<>Nothing reaches a paper <em>unreviewed</em></>}
      intro="Everything an ingestion session writes lands as staging, enforced by the database rather than the session's good behaviour. This queue is the only way a question becomes approved."
    >
      <div className="cards c4" style={{ marginBottom: 20 }}>
        <div className="card"><span className="big">{left.length}</span><span className="cap">Still to review</span></div>
        <div className="card"><span className="big">{queue.filter((q) => q.note).length}</span><span className="cap">Flagged uncertain</span></div>
        <div className="card"><span className="big">{queue.filter((q) => q.ownerInstituteId !== PLATFORM_ID).length}</span><span className="cap">Institute-private</span></div>
        <div className="card"><span className="big">{Object.values(decided).filter((d) => d === "approved").length}</span><span className="cap">Approved now</span></div>
      </div>

      <div className="notice warn">
        <b>What you are actually checking.</b> Does the answer match the question — that is the one
        that would embarrass you in front of somebody else&rsquo;s parent. Then: is the owner right,
        are diagrams present, are the marks sane. Check anything the session flagged as unsure and
        skim the rest lighter.
      </div>

      {queue.map((q) => {
        const d = decided[q.id];
        const isPrivate = q.ownerInstituteId !== PLATFORM_ID;
        return (
          <div
            className="card"
            key={q.id}
            style={{ marginBottom: 12, opacity: d ? 0.62 : 1, borderLeft: isPrivate ? "3px solid var(--ledger)" : undefined }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 7 }}>
                  <span className="pill staging">staging</span>
                  <span className={`tag ${q.difficulty[0]}`}>{q.difficulty}</span>
                  <span className="tag">{q.marks} mark{q.marks === 1 ? "" : "s"}</span>
                  <span className="tag src">{csLabel(q.classSubjectId)}</span>
                  <span className="tag">{q.chapter}</span>
                  {isPrivate ? (
                    <span className="tag priv">Private · {instituteName(q.ownerInstituteId)}</span>
                  ) : (
                    <span className="tag">Shared bank</span>
                  )}
                </div>
                <p style={{ margin: "0 0 7px", fontSize: 14, lineHeight: 1.45 }}>{q.body}</p>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--graphite)" }}>
                  <b style={{ color: "var(--ink)" }}>Answer:</b> {q.answer}
                </p>
                {q.note && (
                  <div className="notice warn" style={{ marginTop: 10, marginBottom: 0 }}>
                    <b>Session note:</b> {q.note}
                  </div>
                )}
              </div>

              <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 6, minWidth: 150 }}>
                {d ? (
                  <span className={`pill ${d === "rejected" ? "suspended" : "active"}`}>{d}</span>
                ) : (
                  <>
                    <button className="btn sm solid" onClick={() => setDecided((s) => ({ ...s, [q.id]: "approved" }))}>
                      Approve
                    </button>
                    <button className="btn sm ghost" onClick={() => setDecided((s) => ({ ...s, [q.id]: "rejected" }))}>
                      Reject
                    </button>
                    <button className="btn sm ghost">Edit</button>
                    {isPrivate &&
                      (confirmPromote === q.id ? (
                        <div className="notice warn" style={{ margin: 0, padding: "9px 10px" }}>
                          Promote into the <b>shared bank</b>? Owner is{" "}
                          <b>{instituteName(q.ownerInstituteId)}</b>. Every other institute will read it.
                          <div className="btnrow" style={{ marginTop: 8 }}>
                            <button className="btn sm solid" onClick={() => { setDecided((s) => ({ ...s, [q.id]: "promoted" })); setConfirmPromote(null); }}>
                              Yes, promote
                            </button>
                            <button className="btn sm ghost" onClick={() => setConfirmPromote(null)}>No</button>
                          </div>
                        </div>
                      ) : (
                        <button className="btn sm ghost" onClick={() => setConfirmPromote(q.id)}>
                          Promote to shared…
                        </button>
                      ))}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div className="notice plain">
        Approving an institute-private question into the shared bank is a separate, explicit action
        with a confirmation naming the owner — a private question sitting in the shared bank is both
        a licensing problem and a competitive one.
      </div>
    </Shell>
  );
}
