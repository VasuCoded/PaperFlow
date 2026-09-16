"use client";

import { Phone } from "../../_components/Phone";
import { useDemoSession } from "@/demo/session";
import { instituteName } from "@/demo/institutes";
import { BATCHES } from "@/demo/activity";
import { csLabel } from "@/demo/bank";

export default function MePage() {
  const { account, instituteId, signOut } = useDemoSession();
  const myBatches = BATCHES.filter(
    (b) => b.instituteId === instituteId && b.active && ["b-12b-eve", "b-12chem"].includes(b.id),
  );

  return (
    <Phone
      eyebrow="Demo · student view"
      title={<>Their account, <em>and nothing more</em></>}
      intro="A student can see their own enrolments and leave. There is no role control here, and no way to see another student's data."
    >
      <p className="sec-label">Account</p>
      <div className="testcard">
        <h3 style={{ fontSize: 17 }}>{account?.name}</h3>
        <div className="meta">{account?.email.toUpperCase()}</div>
        <p style={{ fontSize: 12.5, color: "var(--graphite)", margin: "10px 0 0" }}>
          Signed in with Google. Your institute decides what you can see; this screen cannot change
          it.
        </p>
      </div>

      <p className="sec-label">Institute</p>
      <div className="testcard quiet">
        <h3 style={{ fontSize: 16 }}>{instituteName(instituteId ?? "")}</h3>
        <div className="meta">STUDENT</div>
      </div>

      <p className="sec-label">Your batches</p>
      {myBatches.map((b) => (
        <div className="testcard quiet" key={b.id} style={{ marginBottom: 8 }}>
          <h3 style={{ fontSize: 15 }}>{b.name}</h3>
          <div className="meta">{csLabel(b.classSubjectId).toUpperCase()}</div>
        </div>
      ))}
      <p style={{ fontSize: 11.5, color: "var(--graphite)", marginTop: 8 }}>
        One batch per subject. To change batch, ask your teacher — a second join code for a subject
        you are already in will tell you which batch you are in rather than double-enrolling you.
      </p>

      <p className="sec-label">Offline</p>
      <div className="practice idle">
        <h4>Test list and loaded practice work offline</h4>
        <p>
          Logging needs a connection, and the app says so plainly rather than failing into an
          invisible queue you would never know about.
        </p>
      </div>

      <button className="cta quiet" style={{ marginTop: 16 }} onClick={signOut}>
        Sign out
      </button>
    </Phone>
  );
}
