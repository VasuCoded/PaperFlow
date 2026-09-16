import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { getActiveSubjects, getPendingInvites } from "@/server/data/institute";

export const metadata: Metadata = { title: "Institute · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

export default async function InstituteOverview() {
  const session = await getSession();
  const inst = session?.role === "institute_admin" ? session.instituteId : null;
  const supabase = await createServerSupabaseClient();

  const [membersRes, batchesRes, papersRes, attemptsRes, subjects, invites, requestsRes] = inst && session
    ? await Promise.all([
        supabase.from("institute_members").select("role").eq("institute_id", inst),
        supabase.from("batches").select("id, class_subject_id, active").eq("institute_id", inst),
        supabase.from("papers").select("id", { count: "exact", head: true }).eq("institute_id", inst),
        supabase.from("attempts").select("id", { count: "exact", head: true }).eq("institute_id", inst),
        getActiveSubjects(session),
        getPendingInvites(session),
        supabase.from("activation_requests").select("id, status").eq("institute_id", inst).eq("status", "pending"),
      ])
    : [{ data: [] }, { data: [] }, { count: 0 }, { count: 0 }, [], [], { data: [] }];

  const roles = (membersRes.data ?? []).map((m) => m.role);
  const batches = batchesRes.data ?? [];
  const instituteName = session?.memberships.find((m) => m.instituteId === inst)?.instituteName ?? "Your institute";

  return (
    <AppShell
      area="institute"
      pathname="/institute"
      eyebrow="Institute console"
      title={<>{instituteName}</>}
      intro="Your members, your batches, your papers and your data. You cannot write to the question bank — that gate is what stands between a wrong answer key and a parent."
    >
      <div className="cards c4">
        <div className="card"><span className="big">{roles.filter((r) => r === "teacher").length}</span><span className="cap">Teachers</span></div>
        <div className="card"><span className="big">{roles.filter((r) => r === "student").length}</span><span className="cap">Students</span></div>
        <div className="card"><span className="big">{batches.filter((b) => b.active).length}</span><span className="cap">Open batches</span></div>
        <div className="card"><span className="big">{papersRes.count ?? 0}</span><span className="cap">Papers set</span></div>
      </div>

      <h2 className="sect">Active subjects</h2>
      {subjects.length === 0 ? (
        <div className="notice warn">
          <b>Nothing is active yet.</b> Your teachers cannot set papers until the platform activates a subject for
          you. <Link href="/institute/subjects">Request one →</Link>
        </div>
      ) : (
        <div className="cards c3">
          {subjects.map((s) => (
            <div className="card" key={s.classSubjectId}>
              <h4>
                {s.label} <span className="pill active">Active</span>
              </h4>
              <p>{batches.filter((b) => b.class_subject_id === s.classSubjectId && b.active).length} open batch(es).</p>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12.5, color: "var(--graphite)", marginTop: 10 }}>
        Subjects appear for your teachers only once the platform activates them for you.{" "}
        <Link href="/institute/subjects" style={{ color: "var(--pen)" }}>
          {(requestsRes.data ?? []).length > 0 ? `${(requestsRes.data ?? []).length} request(s) pending →` : "Request another subject →"}
        </Link>
      </p>

      <h2 className="sect">Needs your attention</h2>
      <div className="cards c2">
        <div className="card">
          <h4>Pending invitations</h4>
          {invites.length === 0 ? (
            <p>None outstanding.</p>
          ) : (
            <div style={{ marginTop: 8 }}>
              {invites.slice(0, 6).map((i) => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--hair)" }}>
                  <span style={{ overflowWrap: "anywhere" }}>{i.email}</span>
                  <span className="cap">{i.role.toUpperCase()} · {dateFmt.format(new Date(i.createdAt))}</span>
                </div>
              ))}
              {invites.length > 6 && <p style={{ marginTop: 8 }}>and {invites.length - 6} more.</p>}
            </div>
          )}
          <div className="btnrow" style={{ marginTop: 12 }}>
            <Link className="btn sm solid" href="/institute/members">Invite or manage members</Link>
          </div>
        </div>
        <div className="card">
          <h4>Mistake logging</h4>
          <p>
            <b>{attemptsRes.count ?? 0}</b> attempts logged across {papersRes.count ?? 0} papers. The loop is only
            worth anything if students log within a couple of days of getting the paper back.
          </p>
          <div className="btnrow" style={{ marginTop: 12 }}>
            <Link className="btn sm ghost" href="/institute/teachers">Assign teacher subjects</Link>
            <Link className="btn sm ghost" href="/institute/export">Export your data</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
