"use client";

import { useState } from "react";
import { Shell } from "../../_components/Shell";
import { AUDIT_ROWS } from "@/demo/activity";
import { instituteName, INSTITUTES } from "@/demo/institutes";

export default function AuditPage() {
  const [kind, setKind] = useState<"all" | "role" | "access">("all");
  const [inst, setInst] = useState<string>("all");

  const rows = AUDIT_ROWS.filter(
    (r) => (kind === "all" || r.kind === kind) && (inst === "all" || r.instituteId === inst),
  );

  return (
    <Shell
      area="platform"
      eyebrow="Platform · audit log"
      title={<>Who did what, <em>and who looked at whom</em></>}
      intro="Role changes and every audited read of tenant data, newest first. This is what makes platform access defensible when a customer asks."
    >
      <div className="instbar">
        <div className="btnrow">
          {(["all", "role", "access"] as const).map((k) => (
            <button key={k} className={`btn sm${kind === k ? " solid" : " ghost"}`} onClick={() => setKind(k)}>
              {k === "all" ? "Everything" : k === "role" ? "Role changes" : "Data access"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select className="sel" style={{ width: 230 }} value={inst} onChange={(e) => setInst(e.target.value)}>
            <option value="all">All institutes</option>
            {INSTITUTES.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <button className="btn sm ghost">Export CSV</button>
        </div>
      </div>

      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr>
              <th className="num">When</th>
              <th>Kind</th>
              <th>Actor</th>
              <th>Institute</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="num" style={{ fontSize: 11.5 }}>{r.at}</td>
                <td>
                  <span className={`pill ${r.kind === "role" ? "admin" : "teacher"}`}>{r.kind}</span>
                </td>
                <td><b>{r.actor}</b></td>
                <td>{instituteName(r.instituteId)}</td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 11.5 }}>{r.action}</td>
                <td>{r.target}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ color: "var(--graphite)" }}>Nothing matches that filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="notice plain" style={{ marginTop: 16 }}>
        <b>No blanket access, by construction.</b> There is no &ldquo;act as this tenant&rdquo;
        button anywhere in this console. Reads go through specific audited functions that return
        only the shape a screen needs, so a bug in one query path leaks one row rather than every
        tenant at once — and there is always a record of who looked.
      </div>
    </Shell>
  );
}
