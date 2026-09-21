import type { Metadata } from "next";
import { AppShell } from "../../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { displayIdentity } from "@/lib/identity";
import { gateStatus } from "@/lib/gate";
import { DecideRequest } from "./DecideRequest";

export const metadata: Metadata = { title: "Activation requests · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function RequestsPage() {
  const session = await getSession();
  const supabase = await createServerSupabaseClient();
  const [requestsRes, coverageRes] = session?.isPlatformOwner
    ? await Promise.all([supabase.rpc("platform_activation_requests"), supabase.rpc("platform_bank_coverage")])
    : [{ data: [] }, { data: [] }];

  const coverage = new Map((coverageRes.data ?? []).map((c) => [c.class_subject_id, c]));
  const rows = requestsRes.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending").sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? ""));

  return (
    <AppShell area="platform" pathname="/platform/requests">
      <h2 className="sect">Pending — {pending.length}</h2>
      {pending.length === 0 && <p className="lede">Nothing waiting.</p>}
      {pending.map((r) => {
        const c = coverage.get(r.class_subject_id);
        const gate = c ? gateStatus(c) : { met: false, gaps: ["No coverage data"] };
        return (
          <div className="card" key={r.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <h4 style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {r.class_subject_label}
                  <span className={`pill ${gate.met ? "active" : "suspended"}`}>{gate.met ? "gate met" : "gate not met"}</span>
                  {c && <span className={`pill ${c.bank_status}`}>bank {c.bank_status}</span>}
                </h4>
                <p style={{ marginBottom: 8 }}>
                  <b>{r.institute_name}</b> · requested by {r.requested_by_email ? displayIdentity(r.requested_by_email) : "an admin"} · {dateFmt.format(new Date(r.created_at))}
                </p>
                <div className={gate.met ? "notice" : "notice warn"} style={{ margin: 0 }}>
                  {gate.met
                    ? `${c?.approved.toLocaleString("en-IN")} approved questions; thinnest chapter ${c?.thinnest_chapter} has ${c?.thinnest_chapter_count}. Confirm a teacher there has read three generated papers.`
                    : gate.gaps.join(". ") + "."}
                </div>
              </div>
              <DecideRequest requestId={r.id} instituteName={r.institute_name} label={r.class_subject_label} gateMet={gate.met} />
            </div>
          </div>
        );
      })}

      {decided.length > 0 && (
        <>
          <h2 className="sect">Decided</h2>
          <div className="tablewrap">
            <table className="lt">
              <thead>
                <tr><th>Institute</th><th>Class-subject</th><th>Outcome</th><th>Reason given</th><th>Decided</th></tr>
              </thead>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.institute_name}</b></td>
                    <td>{r.class_subject_label}</td>
                    <td><span className={`pill ${r.status === "approved" ? "active" : "suspended"}`}>{r.status}</span></td>
                    <td style={{ maxWidth: 360 }}>{r.reason ?? "—"}</td>
                    <td>{r.decided_at ? dateFmt.format(new Date(r.decided_at)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
