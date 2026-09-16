"use client";

import { useState } from "react";
import { Shell } from "../../_components/Shell";
import { useDemoSession } from "@/demo/session";
import { batchesFor, papersFor } from "@/demo/activity";
import { csLabel } from "@/demo/bank";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O, 0, I, 1

function newCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export default function BatchesPage() {
  const { instituteId } = useDemoSession();
  const initial = batchesFor(instituteId ?? "");
  const [codes, setCodes] = useState<Record<string, string>>(
    Object.fromEntries(initial.map((b) => [b.id, b.joinCode])),
  );
  const [rotated, setRotated] = useState<string[]>([]);

  return (
    <Shell
      area="teacher"
      eyebrow="Teacher · batches"
      title={<>Batches and <em>join codes</em></>}
      intro="A student joins by typing a six-character code. Codes avoid O, 0, I and 1, and are unique across every institute — so a mistyped code can never land a student in someone else's institute."
    >
      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr>
              <th>Batch</th>
              <th>Subject</th>
              <th className="num">Students</th>
              <th className="num">Papers</th>
              <th>Join code</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {initial.map((b) => (
              <tr key={b.id}>
                <td><b>{b.name}</b></td>
                <td>{csLabel(b.classSubjectId)}</td>
                <td className="num">{b.students}</td>
                <td className="num">{papersFor(b.instituteId, b.classSubjectId).length}</td>
                <td>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 14,
                      letterSpacing: "0.18em",
                      fontWeight: 500,
                    }}
                  >
                    {codes[b.id]}
                  </span>
                  {rotated.includes(b.id) && (
                    <span className="sub" style={{ color: "var(--pen)" }}>
                      Previous code invalidated
                    </span>
                  )}
                </td>
                <td>
                  <span className={`pill ${b.active ? "active" : "planned"}`}>
                    {b.active ? "Active" : "Closed"}
                  </span>
                </td>
                <td>
                  <div className="btnrow">
                    <button
                      className="btn sm ghost"
                      disabled={!b.active}
                      onClick={() => {
                        setCodes((c) => ({ ...c, [b.id]: newCode() }));
                        setRotated((r) => (r.includes(b.id) ? r : [...r, b.id]));
                      }}
                    >
                      Rotate code
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cards c2" style={{ marginTop: 20 }}>
        <div className="card">
          <h4>Create a batch</h4>
          <p style={{ marginBottom: 12 }}>
            One batch per class-subject. You can only choose subjects you are assigned.
          </p>
          <div className="field">
            <label htmlFor="bn">Batch name</label>
            <input className="inp" id="bn" placeholder="12C-MRN" />
          </div>
          <div className="field">
            <label htmlFor="bs">Class and subject</label>
            <select className="sel" id="bs">
              {Array.from(new Set(initial.map((b) => b.classSubjectId))).map((cs) => (
                <option key={cs}>{csLabel(cs)}</option>
              ))}
            </select>
          </div>
          <button className="gen">Create batch and generate code</button>
        </div>

        <div className="card tinted">
          <h4>One batch per subject, per student</h4>
          <p>
            A student may hold at most one batch per class-subject within an institute. If they
            enter a second code for a subject they are already enrolled in, the app shows which
            batch they are in and offers to switch — it does not silently double-enrol them. That
            rule is enforced in the database, not just in this screen.
          </p>
        </div>
      </div>
    </Shell>
  );
}
