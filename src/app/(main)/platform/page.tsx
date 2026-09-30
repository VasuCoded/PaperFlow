import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { Icon } from "@/components/ui/Icon";
import { Stat, TodoRow, ago } from "@/components/ui/Stat";

export const metadata: Metadata = { title: "Dashboard · PaperFlow" };

/** Reviewed questions a class-subject needs before it is worth activating anywhere. */
const BANK_TARGET = 1200;
const DB_LIMIT_MB = 500;

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function PlatformDashboard() {
  const session = await getSession();
  const supabase = await createServerSupabaseClient();

  // Aggregate functions only: nothing here reads a tenant's rows, so opening
  // the dashboard writes nothing to the access log.
  const [institutesRes, coverageRes, requestsRes, healthRes, accessRes] = session?.isPlatformOwner
    ? await Promise.all([
        supabase.rpc("platform_list_institutes"),
        supabase.rpc("platform_bank_coverage"),
        supabase.rpc("platform_activation_requests"),
        supabase.rpc("platform_health"),
        supabase.rpc("platform_pending_access_count"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: null }, { data: 0 }];

  const institutes = institutesRes.data ?? [];
  const coverage = [...(coverageRes.data ?? [])].sort((a, b) => b.approved - a.approved);
  const subjectRequests = (requestsRes.data ?? []).filter((r) => r.status === "pending").length;
  const health = (healthRes.data ?? null) as { db_bytes: number | null } | null;
  const accessRequests = accessRes.data ?? 0;

  const active = institutes.filter((i) => i.status === "active");
  const suspended = institutes.length - active.length;
  const teachers = institutes.reduce((n, i) => n + i.teachers + i.admins, 0);
  const students = institutes.reduce((n, i) => n + i.students, 0);
  const papers = institutes.reduce((n, i) => n + i.papers, 0);
  const approved = coverage.reduce((n, c) => n + c.approved, 0);
  const staging = coverage.reduce((n, c) => n + c.staging, 0);
  const dbMb = health?.db_bytes ? Math.round(health.db_bytes / 1024 / 1024) : null;
  const recent = [...institutes]
    .sort((a, b) => (b.last_activity ?? b.created_at).localeCompare(a.last_activity ?? a.created_at))
    .slice(0, 6);
  const waiting = accessRequests + subjectRequests + staging;
  const firstName = (session?.fullName ?? "").split(" ")[0];

  return (
    <AppShell area="platform">
      <div className="phead">
        <p>
          {greeting()}
          {firstName ? `, ${firstName}` : ""}. {waiting > 0 ? `${waiting} thing${waiting === 1 ? "" : "s"} waiting for you.` : "Nothing is waiting for you."}
        </p>
        <div className="btnrow">
          <Link className="btn solid" href="/platform/institutes?new=1#new">
            <Icon name="building" size={15} /> New institute
          </Link>
          <Link className="btn" href="/platform/support">
            <Icon name="search" size={15} /> Find a person
          </Link>
        </div>
      </div>

      <div className="stats">
        <Stat icon="building" value={active.length} label="Active institutes" hint={suspended ? `${suspended} suspended` : "none suspended"} href="/platform/institutes" />
        <Stat icon="idcard" value={teachers} label="Teachers and admins" />
        <Stat icon="users" value={students} label="Students" />
        <Stat icon="file" value={papers} label="Papers set" />
        <Stat icon="check" value={approved.toLocaleString("en-IN")} label="Approved questions" tone="good" />
        <Stat icon="clock" value={staging} label="Awaiting review" href="/platform/bank" tone={staging ? "warn" : undefined} />
      </div>

      <div className="dash2">
        <section className="panel">
          <div className="panelhead">
            <h2>Needs you</h2>
          </div>
          <div className="todolist">
            <TodoRow icon="userPlus" title="Access requests" text="People asking to join an institute" count={accessRequests} href="/platform/accounts" />
            <TodoRow icon="inbox" title="Subject requests" text="Institutes asking for a subject" count={subjectRequests} href="/platform/requests" />
            <TodoRow icon="check" title="Review queue" text="Questions waiting to be approved" count={staging} href="/platform/bank" />
            <TodoRow icon="building" title="Suspended institutes" text="Their people cannot sign in to them" count={suspended} href="/platform/institutes?status=suspended" />
          </div>
          <p className="panelfoot">
            Flagged questions, password resets and moving a student are under{" "}
            <Link href="/platform/support">Find a person</Link>.
          </p>
        </section>

        <section className="panel">
          <div className="panelhead">
            <h2>Institutes</h2>
            <Link href="/platform/institutes" className="panellink">All {institutes.length} →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="empty">
              <p>No institutes yet.</p>
              <Link className="btn sm solid" href="/platform/institutes?new=1#new">Create the first one</Link>
            </div>
          ) : (
            <div className="rowlist">
              {recent.map((i) => (
                <Link key={i.id} href={`/platform/institutes/${i.id}`} className="rowlink">
                  <span className={`dot ${i.status === "active" ? "on" : "off"}`} aria-label={i.status} />
                  <span className="rowmain">
                    <b>{i.name}</b>
                    <span>
                      {i.students} students · {i.teachers + i.admins} staff · {i.papers} papers
                    </span>
                  </span>
                  <span className="rowmeta">{ago(i.last_activity ?? null)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panelhead">
          <h2>Question bank</h2>
          <Link href="/platform/activation" className="panellink">Subject activation →</Link>
        </div>
        {coverage.length === 0 ? (
          <p className="lede">No subjects yet.</p>
        ) : (
          <div className="bankgrid">
            {coverage.filter((c) => c.approved + c.staging > 0 || c.bank_status !== "planned").map((c) => {
              const pct = Math.min(100, Math.round((c.approved / BANK_TARGET) * 100));
              return (
                <div key={c.class_subject_id} className="bankrow">
                  <div className="bankrowtop">
                    <b>{c.label}</b>
                    <span className={`pill ${c.bank_status}`}>{c.bank_status}</span>
                  </div>
                  <div className="track"><div className={`fill${pct < 40 ? " low" : pct < 80 ? " mid" : ""}`} style={{ width: `${pct}%` }} /></div>
                  <span className="bankrownote">
                    {c.approved.toLocaleString("en-IN")} approved{c.staging ? ` · ${c.staging} to review` : ""} · thinnest chapter: {c.thinnest_chapter ?? "—"} ({c.thinnest_chapter_count ?? 0})
                  </span>
                </div>
              );
            })}
            {coverage.every((c) => c.approved + c.staging === 0 && c.bank_status === "planned") && (
              <p className="lede">No subject has questions yet.</p>
            )}
          </div>
        )}
      </section>

      <section className="panel slim" style={{ marginTop: 16 }}>
        <div className="panelhead">
          <h2>System</h2>
          <Link href="/platform/health" className="panellink">Health →</Link>
        </div>
        <div className="bar" style={{ marginBottom: 0 }}>
          <div className="row">
            <span>Database size</span>
            <b>{dbMb === null ? "—" : `${dbMb} MB of ${DB_LIMIT_MB} MB`}</b>
          </div>
          <div className="track"><div className={`fill${(dbMb ?? 0) > 400 ? " low" : ""}`} style={{ width: `${Math.min(100, ((dbMb ?? 0) / DB_LIMIT_MB) * 100)}%` }} /></div>
        </div>
      </section>
    </AppShell>
  );
}
