"use client";

import { useState } from "react";
import { Shell } from "../../_components/Shell";
import { useDemoSession } from "@/demo/session";
import { ACTIVATION_REQUESTS, ACTIVE_CLASS_SUBJECTS } from "@/demo/activity";
import { CLASS_SUBJECTS } from "@/demo/bank";

export default function SubjectsPage() {
  const { instituteId } = useDemoSession();
  const inst = instituteId ?? "";
  const active = ACTIVE_CLASS_SUBJECTS[inst] ?? [];
  const [requested, setRequested] = useState<string[]>(
    ACTIVATION_REQUESTS.filter((r) => r.instituteId === inst && r.status === "pending").map((r) => r.classSubjectId),
  );

  const declined = ACTIVATION_REQUESTS.filter((r) => r.instituteId === inst && r.status === "declined");

  return (
    <Shell
      area="institute"
      eyebrow="Institute · subjects"
      title={<>What&rsquo;s available, <em>and what isn&rsquo;t yet</em></>}
      intro="Every class-subject is listed, including the ones you cannot use yet, with the reason. An empty dropdown makes an app look broken; an honest 'not yet' does not."
    >
      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr>
              <th>Class-subject</th>
              <th>Bank readiness</th>
              <th className="num">Approved questions</th>
              <th>Your status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {CLASS_SUBJECTS.map((cs) => {
              const isActive = active.includes(cs.id);
              const isRequested = requested.includes(cs.id);
              const dec = declined.find((d) => d.classSubjectId === cs.id);
              return (
                <tr key={cs.id}>
                  <td>
                    <b>Class {cs.className} · {cs.subjectName}</b>
                    {cs.script === "devanagari" && <span className="sub">Devanagari script</span>}
                  </td>
                  <td><span className={`pill ${cs.bankStatus}`}>{cs.bankStatus}</span></td>
                  <td className="num">{cs.approved.toLocaleString("en-IN")}</td>
                  <td>
                    {isActive ? (
                      <span className="pill active">Active</span>
                    ) : isRequested ? (
                      <span className="pill staging">Requested</span>
                    ) : (
                      <span className="pill planned">Not active</span>
                    )}
                    {dec && (
                      <span className="sub" style={{ color: "var(--pen)" }}>
                        Declined: {dec.gateNote}
                      </span>
                    )}
                  </td>
                  <td>
                    {isActive ? (
                      <span style={{ fontSize: 11.5, color: "var(--graphite)" }}>In use</span>
                    ) : isRequested ? (
                      <span style={{ fontSize: 11.5, color: "var(--graphite)" }}>In the queue</span>
                    ) : cs.bankStatus === "ready" ? (
                      <button className="btn sm solid" onClick={() => setRequested((r) => [...r, cs.id])}>
                        Request activation
                      </button>
                    ) : (
                      <button className="btn sm ghost" onClick={() => setRequested((r) => [...r, cs.id])}>
                        Request anyway
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="notice plain" style={{ marginTop: 18 }}>
        <b>Why you cannot switch these on yourself.</b> Activation is gated on how thick the
        question bank is for that subject — no chapter under 60 approved questions, no topic under
        8, and every section type with at least three times what the pattern needs. A subject turned
        on thin produces repetitive papers within two tests and loses the teacher for good. The
        platform checks the gate; you get a request button and a visible queue instead of a
        dropdown that silently lists nothing.
      </div>
    </Shell>
  );
}
