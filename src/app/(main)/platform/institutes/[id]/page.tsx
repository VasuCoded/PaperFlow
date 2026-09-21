import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "../../../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { setInstituteStatusAction } from "@/server/actions/platform";
import { ActionButton } from "../../../_components/ActionButton";
import { RoleControl } from "./RoleControl";
import { displayIdentity } from "@/lib/identity";

export const metadata: Metadata = { title: "Inspect institute · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Inspection = {
  institute: { id: string; name: string; slug: string; status: string; contact_email: string | null; created_at: string } | null;
  members: { user_id: string; email: string; full_name: string | null; role: string; created_at: string }[];
  batches: { id: string; name: string; active: boolean }[];
  recent_papers: { id: string; title: string; generated_at: string | null }[];
  activation: { class_subject_id: string; status: string }[];
};

const ROLE_PILL: Record<string, string> = { institute_admin: "admin", teacher: "teacher", student: "student", owner: "owner" };
const ROLE_ORDER: Record<string, number> = { institute_admin: 0, teacher: 1, student: 2 };

export default async function InspectInstitutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const session = await getSession();
  // Only the platform owner reaches the RPC; AppShell 404s everyone else before
  // rendering, but the page must not call (and log) on their behalf either.
  let inspection: Inspection | null = null;
  let labels = new Map<string, string>();
  if (session?.isPlatformOwner) {
    const supabase = await createServerSupabaseClient();
    const [{ data, error }, { data: coverage }] = await Promise.all([
      supabase.rpc("platform_inspect_institute", { p_institute_id: id }),
      supabase.rpc("platform_bank_coverage"),
    ]);
    if (error) throw new Error(error.message);
    inspection = data as unknown as Inspection;
    labels = new Map((coverage ?? []).map((c) => [c.class_subject_id, c.label]));
    if (!inspection?.institute) notFound();
  }

  const inst = inspection?.institute;
  const members = [...(inspection?.members ?? [])].sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || a.email.localeCompare(b.email),
  );
  const active = (inspection?.activation ?? []).filter((a) => a.status === "active");

  return (
    <AppShell area="platform" pathname="/platform/institutes">
      <div className="notice warn">
        <b>This visit was logged.</b> Opening this page wrote one row to the platform access log, with your
        account, this institute and the time. The institute&rsquo;s own admins can see that you looked.
      </div>

      <div className="cards c4">
        <div className="card"><span className="big">{members.filter((m) => m.role === "teacher").length}</span><span className="cap">Teachers</span></div>
        <div className="card"><span className="big">{members.filter((m) => m.role === "student").length}</span><span className="cap">Students</span></div>
        <div className="card"><span className="big">{inspection?.batches.length ?? 0}</span><span className="cap">Batches</span></div>
        <div className="card"><span className="big">{active.length}</span><span className="cap">Active subjects</span></div>
      </div>

      <div className="cards c2" style={{ marginTop: 18 }}>
        <div className="card">
          <h4>Details</h4>
          <p>
            Slug <b style={{ fontFamily: "var(--mono)" }}>{inst?.slug}</b> · status{" "}
            <span className={`pill ${inst?.status === "active" ? "active" : "suspended"}`}>{inst?.status}</span>
            <br />
            Contact {inst?.contact_email ?? "—"} · created {inst ? dateFmt.format(new Date(inst.created_at)) : ""}
          </p>
          {inst && (
            <div className="btnrow" style={{ marginTop: 10 }}>
              {inst.status === "active" ? (
                <ActionButton
                  action={setInstituteStatusAction.bind(null, inst.id, "suspended")}
                  label="Suspend"
                  confirm={`Suspend ${inst.name}? Its teachers and students lose access until you reactivate. Nothing is deleted.`}
                  confirmLabel="Suspend"
                />
              ) : (
                <ActionButton action={setInstituteStatusAction.bind(null, inst.id, "active")} label="Reactivate" className="btn sm solid" />
              )}
              <Link className="btn sm ghost" href="/platform/support">Invitations &amp; support</Link>
            </div>
          )}
        </div>
        <div className="card">
          <h4>Active subjects</h4>
          <p>{active.length ? active.map((a) => labels.get(a.class_subject_id) ?? "Unknown").join(" · ") : "Nothing activated yet."}</p>
          <div className="btnrow" style={{ marginTop: 10 }}>
            <Link className="btn sm ghost" href="/platform/activation">Change activation</Link>
          </div>
        </div>
      </div>

      <h2 className="sect">Members</h2>
      {members.length === 0 ? (
        <p className="lede">Nobody has accepted an invite yet.</p>
      ) : (
        <div className="tablewrap">
          <table className="lt">
            <thead>
              <tr><th>Person</th><th>Role</th><th>Member since</th><th /></tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    <b>{m.full_name ?? displayIdentity(m.email)}</b>
                    {m.full_name && <span className="sub">{displayIdentity(m.email)}</span>}
                  </td>
                  <td><span className={`pill ${ROLE_PILL[m.role] ?? "student"}`}>{m.role.replace("_", " ")}</span></td>
                  <td>{dateFmt.format(new Date(m.created_at))}</td>
                  <td>
                    {inst && (
                      <RoleControl instituteId={inst.id} instituteName={inst.name} email={m.email} name={m.full_name ?? displayIdentity(m.email)} role={m.role} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="cards c2" style={{ marginTop: 20 }}>
        <div className="card">
          <h4>Batches</h4>
          {(inspection?.batches.length ?? 0) === 0 ? (
            <p>None.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5 }}>
              {inspection!.batches.map((b) => (
                <li key={b.id}>
                  {b.name} {!b.active && <span className="pill planned">closed</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h4>Recent papers</h4>
          {(inspection?.recent_papers.length ?? 0) === 0 ? (
            <p>None yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5 }}>
              {inspection!.recent_papers.map((p) => (
                <li key={p.id}>
                  {p.title}
                  {p.generated_at && <span style={{ color: "var(--graphite)" }}> · {dateFmt.format(new Date(p.generated_at))}</span>}
                </li>
              ))}
            </ul>
          )}
          <p style={{ marginTop: 10, fontSize: 11.5, color: "var(--graphite)" }}>
            Paper content is not shown here. Reading a paper is a separate audited call, only when a support
            case needs it.
          </p>
        </div>
      </div>

      <div className="btnrow" style={{ marginTop: 20 }}>
        <Link className="btn sm ghost" href="/platform/institutes">← All institutes</Link>
        <Link className="btn sm ghost" href={`/platform/audit?institute=${inst?.id ?? ""}`}>This institute&rsquo;s audit trail</Link>
      </div>
    </AppShell>
  );
}
