import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { getMembers, getPendingInvites } from "@/server/data/institute";
import { InviteForm, MemberActions, RevokeInviteButton } from "./MemberControls";
import { AccessRequestList } from "../../_components/AccessRequestList";
import { displayIdentity } from "@/lib/identity";
import { Icon } from "@/components/ui/Icon";
import { Tabs } from "@/components/ui/Tabs";
import { TableSearch } from "@/components/ui/TableSearch";
import { OpenOnHash } from "@/components/ui/OpenOnHash";

export const metadata: Metadata = { title: "Members · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const ROLE_PILL: Record<string, string> = { institute_admin: "admin", teacher: "teacher", student: "student", owner: "owner" };
const ROLE_LABEL: Record<string, string> = { institute_admin: "Institute admin", teacher: "Teacher", student: "Student", owner: "Owner" };

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role: roleFilter } = await searchParams;
  const session = await getSession();
  const admin = session?.role === "institute_admin" ? session : null;

  const [members, invites, auditRes, requestsRes] = admin
    ? await Promise.all([
        getMembers(admin),
        getPendingInvites(admin),
        (await createServerSupabaseClient())
          .from("role_audit")
          .select("id, actor, target, old_role, new_role, at")
          .eq("institute_id", admin.instituteId!)
          .order("at", { ascending: false })
          .limit(15),
        (await createServerSupabaseClient()).rpc("institute_access_requests", { p_institute_id: admin.instituteId! }),
      ])
    : [[], [], { data: [] }, { data: [] }];
  const accessRequests = requestsRes.data ?? [];

  const emailById = new Map(members.map((m) => [m.userId, m.fullName ?? displayIdentity(m.email)]));
  const shown = roleFilter ? members.filter((m) => m.role === roleFilter) : members;
  const count = (r: string) => members.filter((m) => m.role === r).length;

  return (
    <AppShell area="institute">
      <div className="toolbar">
        <TableSearch target="memberlist" placeholder="Search members" />
        <details className="drawer inline" id="invite">
          <summary className="btn solid"><Icon name="userPlus" size={15} /> Invite someone</summary>
          <div className="drawerbody">
            <InviteForm />
            <p className="hint">
              Students can also join by themselves with a batch code, which is usually quicker.
            </p>
          </div>
        </details>
        <OpenOnHash id="invite" />
      </div>

      <Tabs
        tabs={[
          { id: "members", label: "Members", count: members.length },
          { id: "requests", label: "Asking to join", count: accessRequests.length },
          { id: "invites", label: "Invitations", count: invites.length },
          { id: "history", label: "Role history" },
        ]}
      >
        {/* members */}
        <div>
          <nav className="seg" aria-label="Filter by role" style={{ marginBottom: 12 }}>
            {[
              ["", `All · ${members.length}`],
              ["institute_admin", `Admins · ${count("institute_admin")}`],
              ["teacher", `Teachers · ${count("teacher")}`],
              ["student", `Students · ${count("student")}`],
            ].map(([value = "", label]) => (
              <Link
                key={value}
                href={value ? `/institute/members?role=${value}` : "/institute/members"}
                className={(roleFilter ?? "") === value ? "on" : ""}
                aria-current={(roleFilter ?? "") === value ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>

          {shown.length === 0 ? (
            <div className="empty panel"><p>Nobody here yet. Invite someone above.</p></div>
          ) : (
            <div className="tablewrap">
              <table className="lt stack" id="memberlist">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Subjects</th>
                    <th>Joined</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => (
                    <tr key={m.userId} data-search={`${m.fullName ?? ""} ${displayIdentity(m.email)} ${m.subjects.join(" ")}`}>
                      <td>
                        <b>{m.fullName ?? "—"}</b>
                        <span className="sub">{displayIdentity(m.email)}</span>
                      </td>
                      <td><span className={`pill ${ROLE_PILL[m.role] ?? "student"}`}>{ROLE_LABEL[m.role] ?? m.role}</span></td>
                      <td data-label="Subjects:">{m.subjects.length ? m.subjects.join(", ") : <span className="muted">—</span>}</td>
                      <td style={{ whiteSpace: "nowrap" }} data-label="Joined:">{dateFmt.format(new Date(m.joinedAt))}</td>
                      <td>
                        <MemberActions userId={m.userId} email={m.email} role={m.role} isSelf={m.userId === admin?.userId} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* asking to join */}
        <div>
          <p className="lede">People who created an account and asked to join this institute. You choose their role.</p>
          <AccessRequestList mode="institute" requests={accessRequests} />
        </div>

        {/* invitations */}
        <div>
          {invites.length === 0 ? (
            <div className="empty panel"><p>No invitations waiting. Use Invite someone above.</p></div>
          ) : (
            <div className="tablewrap">
              <table className="lt stack">
                <thead>
                  <tr><th>Invited</th><th>Role</th><th>Sent</th><th /></tr>
                </thead>
                <tbody>
                  {invites.map((i) => (
                    <tr key={i.id}>
                      <td><b>{displayIdentity(i.email)}</b></td>
                      <td>{ROLE_LABEL[i.role] ?? i.role}</td>
                      <td data-label="Sent:">{dateFmt.format(new Date(i.createdAt))}</td>
                      <td style={{ textAlign: "right" }}><RevokeInviteButton inviteId={i.id} email={displayIdentity(i.email)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="footnote-plain">
            Revoking an invitation for someone who has already joined changes nothing; remove them from Members instead.
          </p>
        </div>

        {/* role history */}
        <div>
          {(auditRes.data ?? []).length === 0 ? (
            <div className="empty panel"><p>No role changes recorded yet.</p></div>
          ) : (
            <div className="tablewrap">
              <table className="lt stack">
                <thead>
                  <tr><th>When</th><th>By</th><th>Person</th><th>Change</th></tr>
                </thead>
                <tbody>
                  {(auditRes.data ?? []).map((a) => (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{dateFmt.format(new Date(a.at))}</td>
                      <td data-label="By:">{(a.actor && emailById.get(a.actor)) ?? "Platform"}</td>
                      <td>{(a.target && emailById.get(a.target)) ?? "Former member"}</td>
                      <td>
                        {a.old_role ? (ROLE_LABEL[a.old_role] ?? a.old_role) : "—"} → {a.new_role ? (ROLE_LABEL[a.new_role] ?? a.new_role) : "removed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="footnote-plain">
            Every role change is recorded with who made it and when. The platform owner can read this log too.
          </p>
        </div>
      </Tabs>
    </AppShell>
  );
}
