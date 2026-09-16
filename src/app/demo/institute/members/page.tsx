"use client";

import { useState } from "react";
import { Shell } from "../../_components/Shell";
import { useDemoSession } from "@/demo/session";
import { MEMBERS, PENDING_INVITES } from "@/demo/activity";
import { ROLE_LABEL } from "@/demo/institutes";
import type { DemoRole } from "@/demo/types";

const ROLE_PILL: Record<string, string> = {
  institute_admin: "admin",
  teacher: "teacher",
  student: "student",
  owner: "owner",
};

export default function MembersPage() {
  const { instituteId } = useDemoSession();
  const inst = instituteId ?? "";
  const [members, setMembers] = useState(MEMBERS[inst] ?? []);
  const [invites, setInvites] = useState(PENDING_INVITES[inst] ?? []);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"teacher" | "student">("teacher");
  const [changing, setChanging] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");

  function invite() {
    if (!email.includes("@")) return;
    setInvites((i) => [...i, { email, role, sent: "today" }]);
    setEmail("");
  }

  function changeRole(accountId: string, next: DemoRole) {
    setMembers((m) => m.map((x) => (x.accountId === accountId ? { ...x, role: next } : x)));
    setChanging(null);
    setConfirmEmail("");
  }

  return (
    <Shell
      area="institute"
      eyebrow="Institute · members"
      title={<>Members, <em>and how roles change</em></>}
      intro="You can invite teachers and students, and move someone between those two roles. You cannot grant institute admin or platform owner — that requires the platform, by construction."
    >
      <div className="cards c2" style={{ marginBottom: 22 }}>
        <div className="card">
          <h4>Invite someone</h4>
          <p style={{ marginBottom: 12 }}>
            An invite is matched on the person&rsquo;s verified Google email when they sign in.
          </p>
          <div className="field">
            <label htmlFor="em">Email</label>
            <input
              className="inp"
              id="em"
              placeholder="name@institute.test"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="rl">Role</label>
            <select className="sel" id="rl" value={role} onChange={(e) => setRole(e.target.value as "teacher" | "student")}>
              <option value="teacher">Teacher</option>
              <option value="student">Student</option>
            </select>
            <p style={{ fontSize: 11, color: "var(--graphite)", margin: "6px 0 0" }}>
              This dropdown offers two roles only. Institute admin and owner are deliberately
              absent, not hidden.
            </p>
          </div>
          <button className="gen" onClick={invite} disabled={!email.includes("@")}>
            Send invitation
          </button>
        </div>

        <div className="card tinted">
          <h4>Pending invitations</h4>
          {invites.length === 0 ? (
            <p>None outstanding.</p>
          ) : (
            <div style={{ marginTop: 6 }}>
              {invites.map((i) => (
                <div
                  key={i.email}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13, padding: "8px 0", borderBottom: "1px solid var(--hair)" }}
                >
                  <span>
                    {i.email}
                    <span className="cap" style={{ display: "block" }}>
                      {i.role.toUpperCase()} · SENT {i.sent}
                    </span>
                  </span>
                  <button className="btn sm ghost" onClick={() => setInvites((x) => x.filter((y) => y.email !== i.email))}>
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11.5, color: "var(--graphite)", marginTop: 12 }}>
            Editing an invite for someone who has already joined changes nothing — by design.
          </p>
        </div>
      </div>

      <h2 className="sect">Current members</h2>
      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Subjects</th>
              <th className="num">Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.accountId}>
                <td><b>{m.name}</b></td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>{m.email}</td>
                <td>
                  <span className={`pill ${ROLE_PILL[m.role] ?? "student"}`}>{ROLE_LABEL[m.role]}</span>
                </td>
                <td>
                  {m.subjects.length === 0 ? (
                    <span style={{ color: "var(--graphite)" }}>—</span>
                  ) : (
                    m.subjects.join(", ")
                  )}
                </td>
                <td className="num">{m.joined}</td>
                <td>
                  {m.role === "institute_admin" ? (
                    <span style={{ fontSize: 11.5, color: "var(--graphite)" }}>Platform only</span>
                  ) : changing === m.accountId ? (
                    <div style={{ minWidth: 220 }}>
                      <p style={{ fontSize: 11.5, margin: "0 0 6px", color: "var(--graphite)" }}>
                        Type <b>{m.email}</b> to confirm:
                      </p>
                      <input
                        className="inp"
                        style={{ fontSize: 11.5, padding: "6px 8px" }}
                        value={confirmEmail}
                        onChange={(e) => setConfirmEmail(e.target.value)}
                        aria-label="Confirm email"
                      />
                      <div className="btnrow" style={{ marginTop: 6 }}>
                        <button
                          className="btn sm solid"
                          disabled={confirmEmail.trim().toLowerCase() !== m.email.toLowerCase()}
                          onClick={() => changeRole(m.accountId, m.role === "teacher" ? "student" : "teacher")}
                        >
                          Make {m.role === "teacher" ? "student" : "teacher"}
                        </button>
                        <button className="btn sm ghost" onClick={() => { setChanging(null); setConfirmEmail(""); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="btn sm ghost" onClick={() => setChanging(m.accountId)}>
                      Change role
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="notice plain" style={{ marginTop: 16 }}>
        Every role change writes an audit row naming who changed what, and when. The platform owner
        can read that log; you can read your own institute&rsquo;s.
      </div>
    </Shell>
  );
}
