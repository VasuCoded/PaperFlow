import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { getMembers, getPendingInvites } from "@/server/data/institute";
import { InviteForm, MemberActions, RevokeInviteButton } from "./MemberControls";
import { AccessRequestList } from "../../_components/AccessRequestList";
import { displayIdentity } from "@/lib/identity";

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
    <AppShell
      area="institute"
      pathname="/institute/members"
      eyebrow="Institute · members"
      title={
        <>
          Members, <em>and how roles change</em>
        </>
      }
      intro="You can invite teachers and students, and move someone between those two roles. You cannot grant institute admin or platform owner — that requires the platform, by construction."
    >
      <div className="cards c2" style={{ marginBottom: 22 }}>
        <div className="card">
          <h4>Invite someone</h4>
          <p style={{ marginBottom: 12 }}>
            Invite someone by their PaperFlow username (or a Google email). They see the invitation when they
            sign in. Students can also join with a batch code, and anyone can ask to join below.
          </p>
          <InviteForm />
        </div>

        <div className="card tinted">
          <h4>Pending invitations — {invites.length}</h4>
          {invites.length === 0 ? (
            <p>None outstanding.</p>
          ) : (
            <div style={{ marginTop: 6 }}>
              {invites.map((i) => (
                <div
                  key={i.id}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13, padding: "8px 0", borderBottom: "1px solid var(--hair)" }}
                >
                  <span style={{ overflowWrap: "anywhere" }}>
                    {displayIdentity(i.email)}
                    <span className="cap" style={{ display: "block" }}>
                      {i.role.replace("_", " ").toUpperCase()} · SENT {dateFmt.format(new Date(i.createdAt)).toUpperCase()}
                    </span>
                  </span>
                  <RevokeInviteButton inviteId={i.id} email={displayIdentity(i.email)} />
                </div>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11.5, color: "var(--graphite)", marginTop: 12 }}>
            Revoking an invite for someone who has already joined changes nothing — use Remove below instead.
          </p>
        </div>
      </div>

      <h2 className="sect" id="requests">Asking to join — {accessRequests.length}</h2>
      <p style={{ fontSize: 12.5, color: "var(--graphite)", marginTop: -4 }}>
        People who created an account and asked for access to this institute. You choose their role.
      </p>
      <AccessRequestList mode="institute" requests={accessRequests} />

      <h2 className="sect">Current members — {members.length}</h2>
      <nav className="chips" aria-label="Filter by role" style={{ marginBottom: 12 }}>
        {[
          ["", `All · ${members.length}`],
          ["institute_admin", `Admins · ${count("institute_admin")}`],
          ["teacher", `Teachers · ${count("teacher")}`],
          ["student", `Students · ${count("student")}`],
        ].map(([value = "", label]) => (
          <Link
            key={value}
            href={value ? `/institute/members?role=${value}` : "/institute/members"}
            className={`chip${(roleFilter ?? "") === value ? "" : " dim"}`}
            aria-current={(roleFilter ?? "") === value ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="lede">Nobody here yet.</p>
      ) : (
        <div className="tablewrap">
          <table className="lt">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Subjects</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <tr key={m.userId}>
                  <td><b>{m.fullName ?? "—"}</b></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11.5, overflowWrap: "anywhere" }}>{displayIdentity(m.email)}</td>
                  <td><span className={`pill ${ROLE_PILL[m.role] ?? "student"}`}>{ROLE_LABEL[m.role] ?? m.role}</span></td>
                  <td>{m.subjects.length ? m.subjects.join(", ") : <span style={{ color: "var(--graphite)" }}>—</span>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{dateFmt.format(new Date(m.joinedAt))}</td>
                  <td>
                    <MemberActions userId={m.userId} email={m.email} role={m.role} isSelf={m.userId === admin?.userId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="sect">Recent role changes</h2>
      {(auditRes.data ?? []).length === 0 ? (
        <p className="lede">No role changes recorded yet.</p>
      ) : (
        <div className="tablewrap">
          <table className="lt">
            <thead>
              <tr><th>When</th><th>By</th><th>Person</th><th>Change</th></tr>
            </thead>
            <tbody>
              {(auditRes.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{dateFmt.format(new Date(a.at))}</td>
                  <td>{(a.actor && emailById.get(a.actor)) ?? "Platform"}</td>
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

      <div className="notice plain" style={{ marginTop: 16 }}>
        Every role change writes an audit row naming who changed what, and when. The platform owner can read that
        log; you can read your own institute&rsquo;s.
      </div>
    </AppShell>
  );
}
