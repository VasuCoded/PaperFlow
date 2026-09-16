"use client";

import { Shell } from "../../_components/Shell";
import { HEALTH } from "@/demo/activity";
import { instituteName } from "@/demo/institutes";
import { CLASS_SUBJECTS } from "@/demo/bank";

function Meter({ label, used, limit, unit }: { label: string; used: number; limit: number; unit: string }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const cls = pct >= 70 ? "fill low" : pct >= 50 ? "fill mid" : "fill";
  return (
    <div className="bar">
      <div className="row">
        <span>{label}</span>
        <b>
          {used.toLocaleString("en-IN")} / {limit.toLocaleString("en-IN")} {unit}
        </b>
      </div>
      <div className="track">
        <div className={cls} style={{ width: `${pct}%` }} />
      </div>
      <div className="note">
        {pct}% of the free tier{pct >= 70 ? " — alert threshold reached, plan the Pro upgrade" : ""}
      </div>
    </div>
  );
}

export default function HealthPage() {
  return (
    <Shell
      area="platform"
      eyebrow="Platform · health"
      title={<>Headroom, backups <em>and who is using it</em></>}
      intro="Free-tier ceilings with a per-institute breakdown, so one runaway tenant is visible before the limit is."
    >
      <div className="cards c2">
        <div className="card">
          <h4>Free-tier usage</h4>
          <div style={{ marginTop: 12 }}>
            <Meter label="Database" used={HEALTH.dbMb} limit={HEALTH.dbLimitMb} unit="MB" />
            <Meter label="Storage" used={HEALTH.storageMb} limit={HEALTH.storageLimitMb} unit="MB" />
            <Meter label="Egress" used={HEALTH.egressGb} limit={HEALTH.egressLimitGb} unit="GB" />
            <Meter label="Function calls" used={HEALTH.invocations} limit={HEALTH.invocationLimit} unit="" />
          </div>
        </div>

        <div className="card">
          <h4>Backups</h4>
          <p style={{ marginBottom: 14 }}>
            Nightly <span style={{ fontFamily: "var(--mono)" }}>pg_dump</span> to Cloudflare R2, 30
            day retention, and it fails loudly by email if it fails — a silently broken backup is
            the worst outcome, and it is other people&rsquo;s data.
          </p>
          <div className="notice" style={{ margin: 0 }}>
            <b>Last successful backup</b>
            <br />
            {HEALTH.lastBackup}
          </div>
          <h4 style={{ marginTop: 18 }}>Keep-alive</h4>
          <p>
            A daily trivial query runs from CI so the free tier does not pause after seven idle
            days. Term breaks are exactly when that matters.
          </p>
        </div>
      </div>

      <h2 className="sect">Per-institute usage</h2>
      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr>
              <th>Institute</th>
              <th className="num">Rows</th>
              <th className="num">Storage</th>
              <th className="num">Share of total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {HEALTH.perInstitute.map((p) => (
              <tr key={p.instituteId}>
                <td><b>{instituteName(p.instituteId)}</b></td>
                <td className="num">{p.rows.toLocaleString("en-IN")}</td>
                <td className="num">{p.storageMb} MB</td>
                <td className="num">{Math.round(p.share * 100)}%</td>
                <td>
                  {p.share > 0.4 ? (
                    <span className="pill suspended">over 40% — watch</span>
                  ) : (
                    <span className="pill active">normal</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="sect">Coverage against the activation gate</h2>
      <div className="tablewrap">
        <table className="lt">
          <thead>
            <tr>
              <th>Class-subject</th>
              <th>Bank status</th>
              <th className="num">Approved</th>
              <th className="num">Distance from gate</th>
            </tr>
          </thead>
          <tbody>
            {CLASS_SUBJECTS.map((cs) => {
              const need = 1200;
              const gap = Math.max(0, need - cs.approved);
              return (
                <tr key={cs.id}>
                  <td><b>Class {cs.className} · {cs.subjectName}</b></td>
                  <td><span className={`pill ${cs.bankStatus}`}>{cs.bankStatus}</span></td>
                  <td className="num">{cs.approved.toLocaleString("en-IN")}</td>
                  <td className="num" style={{ color: gap === 0 ? "var(--ledger)" : "var(--graphite)" }}>
                    {gap === 0 ? "at target" : `${gap.toLocaleString("en-IN")} more · ~${Math.round((gap * 45) / 3600)} h review`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
