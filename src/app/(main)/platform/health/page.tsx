import type { Metadata } from "next";
import { AppShell } from "../../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession, PLATFORM_INSTITUTE_ID } from "@/server/session";
import { GATE, gateStatus } from "@/lib/gate";

export const metadata: Metadata = { title: "Health · PaperFlow" };

const DB_LIMIT_BYTES = 500 * 1024 * 1024;

type Health = {
  db_bytes: number | null;
  per_institute: { institute_id: string; name: string | null; rows: number }[];
};

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
      <div className="note">{pct}% of the free tier{pct >= 70 ? " — alert threshold reached, plan the Pro upgrade" : ""}</div>
    </div>
  );
}

export default async function HealthPage() {
  const session = await getSession();
  const supabase = await createServerSupabaseClient();
  const [healthRes, coverageRes] = session?.isPlatformOwner
    ? await Promise.all([supabase.rpc("platform_health"), supabase.rpc("platform_bank_coverage")])
    : [{ data: null }, { data: [] }];

  const health = (healthRes.data ?? { db_bytes: null, per_institute: [] }) as unknown as Health;
  const coverage = coverageRes.data ?? [];
  const perInstitute = health.per_institute ?? [];
  const totalRows = perInstitute.reduce((n, r) => n + r.rows, 0);
  const dbMb = health.db_bytes === null ? null : Math.round(health.db_bytes / 1024 / 1024);
  // The platform row is the shared bank, not a tenant — it is expected to be large.
  const tenants = perInstitute.filter((r) => r.institute_id !== PLATFORM_INSTITUTE_ID);
  const tenantRows = tenants.reduce((n, r) => n + r.rows, 0);
  const hog = tenants.length > 1 ? tenants.find((r) => r.rows / tenantRows > 0.4) : undefined;

  return (
    <AppShell
      area="platform"
      pathname="/platform/health"
      eyebrow="Platform · health"
      title={
        <>
          Headroom, backups <em>and who is using it</em>
        </>
      }
      intro="Free-tier ceilings with a per-institute breakdown, so one runaway tenant is visible before the limit is."
    >
      {hog && (
        <div className="notice warn">
          <b>{hog.name ?? "One institute"}</b> holds {Math.round((hog.rows / tenantRows) * 100)}% of all tenant rows —
          above the 40% single-tenant alert line.
        </div>
      )}

      <div className="cards c2">
        <div className="card">
          <h4>Database</h4>
          <div style={{ marginTop: 12 }}>
            {dbMb === null ? (
              <p>Database size is not available from this connection.</p>
            ) : (
              <Meter label="Database size" used={dbMb} limit={DB_LIMIT_BYTES / 1024 / 1024} unit="MB" />
            )}
          </div>
          <p style={{ fontSize: 12, color: "var(--graphite)", marginTop: 8 }}>
            Storage (1 GB), egress (5 GB) and function invocations (1M) are read from the Supabase dashboard —
            they are not visible from inside the database. Backups: Settings → Database → Backups.
          </p>
        </div>
        <div className="card">
          <h4>Rows per institute</h4>
          <p style={{ fontSize: 12, color: "var(--graphite)" }}>
            Members, enrolments, papers, set items, attempts, practice items and owned questions.
          </p>
          {perInstitute.length === 0 ? (
            <p>No members yet.</p>
          ) : (
            <div className="bars" style={{ marginTop: 12 }}>
              {perInstitute.map((r) => {
                const pct = totalRows ? Math.round((r.rows / totalRows) * 100) : 0;
                return (
                  <div className="bar" key={r.institute_id}>
                    <div className="row">
                      <span>{r.institute_id === PLATFORM_INSTITUTE_ID ? "Shared bank (platform)" : (r.name ?? "Unknown")}</span>
                      <b>{r.rows.toLocaleString("en-IN")} · {pct}%</b>
                    </div>
                    <div className="track">
                      <div className={hog?.institute_id === r.institute_id ? "fill low" : "fill"} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <h2 className="sect">Coverage against the gate</h2>
      {coverage.length === 0 ? (
        <p className="lede">No class-subjects yet.</p>
      ) : (
        <div className="tablewrap">
          <table className="lt">
            <thead>
              <tr>
                <th>Class-subject</th>
                <th>Bank</th>
                <th className="num">Approved</th>
                <th className="num">Staged</th>
                <th className="num">Chapters</th>
                <th>Thinnest chapter</th>
                <th className="num">Thinnest topic</th>
                <th>Distance to gate</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((c) => {
                const gate = gateStatus(c);
                const short = Math.max(0, GATE.minPerChapter - (c.thinnest_chapter_count ?? 0));
                return (
                  <tr key={c.class_subject_id}>
                    <td><b>{c.label}</b></td>
                    <td><span className={`pill ${c.bank_status}`}>{c.bank_status}</span></td>
                    <td className="num">{c.approved.toLocaleString("en-IN")}</td>
                    <td className="num">{c.staging.toLocaleString("en-IN")}</td>
                    <td className="num">{c.chapters}</td>
                    <td>{c.thinnest_chapter ? `${c.thinnest_chapter} · ${c.thinnest_chapter_count}` : "—"}</td>
                    <td className="num">{c.thinnest_topic_count ?? "—"}</td>
                    <td>
                      {gate.met ? (
                        <span className="pill ready">met</span>
                      ) : c.chapters === 0 ? (
                        <span className="pill planned">no chapters</span>
                      ) : (
                        <span style={{ fontSize: 12 }}>{short > 0 ? `${short} more in the thinnest chapter` : gate.gaps.join("; ")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
