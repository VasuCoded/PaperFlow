import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "../../../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { platformRemoveMemberAction, setActivationAction, setInstituteStatusAction } from "@/server/actions/platform";
import { ActionButton } from "../../../_components/ActionButton";
import { RoleControl } from "./RoleControl";
import { EditInstituteForm, InvitesPanel, PlatformInviteForm } from "./InstituteControls";
import { PlatformReset } from "../../support/PersonLookup";
import { displayIdentity } from "@/lib/identity";
import { Icon } from "@/components/ui/Icon";
import { Stat } from "@/components/ui/Stat";
import { Tabs } from "@/components/ui/Tabs";
import { TableSearch } from "@/components/ui/TableSearch";

export const metadata: Metadata = { title: "Manage institute · PaperFlow" };

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
const ROLE_LABEL: Record<string, string> = { institute_admin: "Admin", teacher: "Teacher", student: "Student", owner: "Owner" };
const ROLE_ORDER: Record<string, number> = { institute_admin: 0, teacher: 1, student: 2 };

export default async function ManageInstitutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const session = await getSession();
  // Only the platform owner reaches the RPC; AppShell 404s everyone else before
  // rendering, but the page must not call (and log) on their behalf either.
  let inspection: Inspection | null = null;
  let coverage: { class_subject_id: string; label: string; bank_status: string; approved: number }[] = [];
  if (session?.isPlatformOwner) {
    const supabase = await createServerSupabaseClient();
    const [{ data, error }, { data: cov }] = await Promise.all([
      supabase.rpc("platform_inspect_institute", { p_institute_id: id }),
      supabase.rpc("platform_bank_coverage"),
    ]);
    if (error) throw new Error(error.message);
    inspection = data as unknown as Inspection;
    coverage = (cov ?? []).sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
    if (!inspection?.institute) notFound();
  }

  const inst = inspection?.institute;
  const members = [...(inspection?.members ?? [])].sort(
    (a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) || a.email.localeCompare(b.email),
  );
  const activeIds = new Set((inspection?.activation ?? []).filter((a) => a.status === "active").map((a) => a.class_subject_id));
  const count = (r: string) => members.filter((m) => m.role === r).length;
  const batches = inspection?.batches ?? [];
  const papers = inspection?.recent_papers ?? [];

  return (
    <AppShell area="platform">
      <Link href="/platform/institutes" className="backlink">
        <Icon name="chevronRight" size={14} className="flip" /> All institutes
      </Link>

      {inst && (
        <div className="entity">
          <div className="entitymain">
            <span className="entityicon"><Icon name="building" size={24} /></span>
            <div>
              <h2>
                {inst.name} <span className={`pill ${inst.status === "active" ? "active" : "suspended"}`}>{inst.status}</span>
              </h2>
              <p>
                {inst.slug} · {inst.contact_email ?? "no contact email"} · since {dateFmt.format(new Date(inst.created_at))}
              </p>
            </div>
          </div>
          <div className="btnrow">
            {inst.status === "active" ? (
              <ActionButton
                action={setInstituteStatusAction.bind(null, inst.id, "suspended")}
                label="Suspend"
                className="btn ghost"
                confirm={`Suspend ${inst.name}? Its teachers and students lose access until you reactivate. Nothing is deleted.`}
                confirmLabel="Suspend"
              />
            ) : (
              <ActionButton action={setInstituteStatusAction.bind(null, inst.id, "active")} label="Reactivate" className="btn solid" />
            )}
            <Link className="btn ghost" href={`/platform/audit?institute=${inst.id}`}>Audit trail</Link>
          </div>
        </div>
      )}

      <div className="stats">
        <Stat icon="shield" value={count("institute_admin")} label="Admins" />
        <Stat icon="idcard" value={count("teacher")} label="Teachers" />
        <Stat icon="users" value={count("student")} label="Students" />
        <Stat icon="layers" value={batches.filter((b) => b.active).length} label="Open batches" hint={`${batches.length} in all`} />
        <Stat icon="book" value={activeIds.size} label="Active subjects" />
      </div>

      <Tabs
        tabs={[
          { id: "people", label: "People", count: members.length },
          { id: "subjects", label: "Subjects", count: activeIds.size },
          { id: "teaching", label: "Batches & papers" },
          { id: "invites", label: "Invitations" },
          { id: "settings", label: "Settings" },
        ]}
      >
        {/* people */}
        <div>
          <div className="toolbar">
            <TableSearch target="members" placeholder="Search people" />
            <details className="drawer inline">
              <summary className="btn solid"><Icon name="userPlus" size={15} /> Invite someone</summary>
              <div className="drawerbody">
                {inst && <PlatformInviteForm instituteId={inst.id} />}
                <p className="hint">
                  Invite by username. To make an existing member an admin, change their role below instead.
                </p>
              </div>
            </details>
          </div>
          {members.length === 0 ? (
            <div className="empty panel"><p>Nobody has joined yet. Invite the first admin above.</p></div>
          ) : (
            <div className="tablewrap">
              <table className="lt stack" id="members">
                <thead>
                  <tr><th>Person</th><th>Role</th><th>Member since</th><th>Change role</th><th /></tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const name = m.full_name ?? displayIdentity(m.email);
                    return (
                      <tr key={m.user_id} data-search={`${m.full_name ?? ""} ${displayIdentity(m.email)} ${ROLE_LABEL[m.role] ?? m.role}`}>
                        <td>
                          <b>{name}</b>
                          <span className="sub">{displayIdentity(m.email)}</span>
                        </td>
                        <td><span className={`pill ${ROLE_PILL[m.role] ?? "student"}`}>{ROLE_LABEL[m.role] ?? m.role}</span></td>
                        <td style={{ whiteSpace: "nowrap" }} data-label="Joined">{dateFmt.format(new Date(m.created_at))}</td>
                        <td>
                          {inst && <RoleControl instituteId={inst.id} instituteName={inst.name} email={m.email} name={name} role={m.role} />}
                        </td>
                        <td>
                          {inst && m.role !== "owner" && (
                            <details className="rowmenu">
                              <summary className="btn sm ghost">More</summary>
                              <div className="rowmenubody">
                                <PlatformReset email={m.email} />
                                <div style={{ marginTop: 10 }}>
                                  <ActionButton
                                    action={platformRemoveMemberAction.bind(null, inst.id, m.user_id)}
                                    label="Remove from institute"
                                    confirm={`Remove ${name} from ${inst.name}? Their account stays; their batches and subjects here are cleared.`}
                                    confirmLabel="Remove"
                                  />
                                </div>
                              </div>
                            </details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* subjects */}
        <div>
          <p className="lede">
            A subject must be switched on here before this institute&rsquo;s teachers can set papers in it. Switching
            one off hides it from new papers; nothing already made is lost.
          </p>
          <div className="tablewrap">
            <table className="lt stack">
              <thead>
                <tr><th>Subject</th><th>Question bank</th><th className="num">Approved</th><th>For this institute</th></tr>
              </thead>
              <tbody>
                {coverage.map((c) => {
                  const on = activeIds.has(c.class_subject_id);
                  return (
                    <tr key={c.class_subject_id}>
                      <td><b>{c.label}</b></td>
                      <td><span className={`pill ${c.bank_status}`}>{c.bank_status}</span></td>
                      <td className="num" data-label="Approved questions:">{c.approved.toLocaleString("en-IN")}</td>
                      <td>
                        {inst && (
                          <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                            <span className={`pill ${on ? "active" : "planned"}`}>{on ? "On" : "Off"}</span>
                            <ActionButton
                              action={setActivationAction.bind(null, inst.id, c.class_subject_id, !on)}
                              label={on ? "Switch off" : "Switch on"}
                              className={on ? "btn sm ghost" : "btn sm"}
                              confirm={on ? `Switch off ${c.label} for ${inst.name}? Teachers can no longer set new papers in it.` : undefined}
                              confirmLabel="Switch off"
                            />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* batches & papers */}
        <div className="cards c2">
          <div className="card">
            <h4><Icon name="layers" size={16} /> Batches</h4>
            {batches.length === 0 ? (
              <p>No batches yet.</p>
            ) : (
              <ul className="plainlist">
                {batches.map((b) => (
                  <li key={b.id}>
                    {b.name} <span className={`pill ${b.active ? "active" : "planned"}`}>{b.active ? "open" : "closed"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h4><Icon name="file" size={16} /> Recent papers</h4>
            {papers.length === 0 ? (
              <p>None yet.</p>
            ) : (
              <ul className="plainlist">
                {papers.map((p) => (
                  <li key={p.id}>
                    {p.title}
                    {p.generated_at && <span className="muted"> · {dateFmt.format(new Date(p.generated_at))}</span>}
                  </li>
                ))}
              </ul>
            )}
            <p className="hint">Paper content is not shown here. Reading a paper is a separate audited call, only when a support case needs it.</p>
          </div>
        </div>

        {/* invitations */}
        <div>{inst && <InvitesPanel instituteId={inst.id} />}</div>

        {/* settings */}
        <div className="cards c2">
          <div className="card">
            <h4>Details</h4>
            {inst && <EditInstituteForm instituteId={inst.id} name={inst.name} contactEmail={inst.contact_email} />}
          </div>
          <div className="card tinted">
            <h4>Access</h4>
            <p>
              {inst?.status === "active"
                ? "Active: its members can sign in and use everything. Suspending keeps all data and can be undone."
                : "Suspended: its members cannot use it until you reactivate. All data is kept."}
            </p>
            <p style={{ marginTop: 10 }}>
              Opening this page wrote one row to the platform access log (your account, this institute, the time).
              The institute&rsquo;s admins can see that you looked.
            </p>
          </div>
        </div>
      </Tabs>
    </AppShell>
  );
}
