import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { displayIdentity } from "@/lib/identity";

export const metadata: Metadata = { title: "Audit log · PaperFlow" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const timeFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const ACTION_LABEL: Record<string, string> = {
  inspect_institute: "Inspected institute",
  inspect_paper: "Inspected paper",
  review_queue: "Opened review queue",
  read_audit: "Read audit log",
  set_status_suspended: "Suspended institute",
  set_status_active: "Reactivated institute",
  activate_subject: "Activated subject",
  deactivate_subject: "Deactivated subject",
  institute_export: "Institute exported its data",
  set_member_role: "Role change",
};

function label(action: string) {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  if (action.startsWith("question_")) return action.replace("question_", "Question ").replace(/_/g, " ");
  return action.replace(/_/g, " ");
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ institute?: string; kind?: string }> }) {
  const { institute, kind } = await searchParams;
  const instituteId = institute && UUID.test(institute) ? institute : undefined;

  const session = await getSession();
  const supabase = await createServerSupabaseClient();
  const [auditRes, institutesRes] = session?.isPlatformOwner
    ? await Promise.all([
        supabase.rpc("platform_audit", { p_institute_id: instituteId, p_limit: 300 }),
        supabase.rpc("platform_list_institutes"),
      ])
    : [{ data: [] }, { data: [] }];

  const institutes = institutesRes.data ?? [];
  const rows = (auditRes.data ?? []).filter((r) => !kind || r.kind === kind);
  const qs = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { institute: instituteId, kind, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <AppShell
      area="platform"
      pathname="/platform/audit"
      eyebrow="Platform · audit log"
      title={
        <>
          Who looked at <em>whose data</em>
        </>
      }
      intro="Two trails merged, newest first: every role change in every institute, and every audited read or change the platform made. Reading this page is itself logged."
    >
      <form method="get" className="btnrow" style={{ marginBottom: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label htmlFor="audit-inst" style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Institute</label>
          <select id="audit-inst" name="institute" className="sel" defaultValue={instituteId ?? ""} style={{ width: "auto", minWidth: 200 }}>
            <option value="">All institutes</option>
            {institutes.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-kind" style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>Trail</label>
          <select id="audit-kind" name="kind" className="sel" defaultValue={kind ?? ""} style={{ width: "auto" }}>
            <option value="">Both</option>
            <option value="access">Platform access</option>
            <option value="role">Role changes</option>
          </select>
        </div>
        <button type="submit" className="btn sm solid">Filter</button>
        <a className="btn sm ghost" href={`/platform/audit/export${qs({})}`}>Download CSV</a>
      </form>

      {rows.length === 0 ? (
        <p className="lede">Nothing recorded{instituteId ? " for this institute" : ""} yet.</p>
      ) : (
        <div className="tablewrap">
          <table className="lt">
            <thead>
              <tr><th>When</th><th>Trail</th><th>Who</th><th>Institute</th><th>What</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={`${r.at}-${idx}`}>
                  <td style={{ whiteSpace: "nowrap" }}>{timeFmt.format(new Date(r.at))}</td>
                  <td><span className={`pill ${r.kind === "role" ? "teacher" : "owner"}`}>{r.kind}</span></td>
                  <td>{r.actor_email ? displayIdentity(r.actor_email) : "system"}</td>
                  <td>
                    {r.institute_id ? (
                      <Link href={`/platform/audit${qs({ institute: r.institute_id })}`}>{r.institute_name ?? "—"}</Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{label(r.action)}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{r.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
