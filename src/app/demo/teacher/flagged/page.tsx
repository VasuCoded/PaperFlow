"use client";

import { useState } from "react";
import { Shell } from "../../_components/Shell";
import { instituteName } from "@/demo/institutes";
import { useDemoSession } from "@/demo/session";

const FLAGS = [
  {
    id: "f-1",
    body: "The enzyme that joins Okazaki fragments during replication is…",
    subject: "Class 12 · Biology",
    reason: "Option (C) and (D) are both defensible as worded.",
    raised: "13 Sep",
    status: "open" as const,
  },
  {
    id: "f-2",
    body: "Two lamps rated 60 W and 100 W at 220 V are joined in series. The brighter lamp is…",
    subject: "Class 10 · Science",
    reason: "Answer key in the source paper looks wrong.",
    raised: "9 Sep",
    status: "open" as const,
  },
];

export default function FlaggedPage() {
  const { instituteId } = useDemoSession();
  const [flags, setFlags] = useState(FLAGS);

  return (
    <Shell
      area="teacher"
      eyebrow="Teacher · flagged questions"
      title={<>Questions you&rsquo;ve <em>pulled from your pool</em></>}
      intro="Flagging suppresses a question for your institute immediately. It does not delete it from the shared bank."
    >
      <div className="notice warn">
        <b>What flagging does, exactly.</b> The question stops appearing in{" "}
        <b>{instituteName(instituteId ?? "")}</b>&rsquo;s papers straight away. It stays in the
        shared bank for other institutes until the platform reviews it — one institute cannot pull
        a question out of everybody else&rsquo;s pool. You will see it as still present in the bank,
        and that is deliberate rather than a bug.
      </div>

      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr>
              <th>Question</th>
              <th>Subject</th>
              <th className="num">Flagged</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.id}>
                <td>
                  <b>{f.body}</b>
                  <span className="sub">{f.reason}</span>
                </td>
                <td>{f.subject}</td>
                <td className="num">{f.raised}</td>
                <td>
                  <span className="pill staging">Awaiting platform review</span>
                </td>
                <td>
                  <button
                    className="btn sm ghost"
                    onClick={() => setFlags((x) => x.filter((y) => y.id !== f.id))}
                  >
                    Un-flag
                  </button>
                </td>
              </tr>
            ))}
            {flags.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--graphite)" }}>
                  Nothing flagged. Any question you flag from the paper preview appears here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
