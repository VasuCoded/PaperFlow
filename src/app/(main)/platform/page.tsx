import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Platform · PaperFlow" };

export default async function PlatformOverview() {
  const session = await getSession();
  const supabase = await createServerSupabaseClient();

  // Aggregate functions only — nothing on this page reads a tenant's rows, so
  // nothing here writes the access log.
  const [institutesRes, coverageRes, requestsRes, healthRes] = session?.isPlatformOwner
    ? await Promise.all([
        supabase.rpc("platform_list_institutes"),
        supabase.rpc("platform_bank_coverage"),
        supabase.rpc("platform_activation_requests"),
        supabase.rpc("platform_health"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: null }];

  const institutes = institutesRes.data ?? [];
  const coverage = coverageRes.data ?? [];
  const requests = (requestsRes.data ?? []).filter((r) => r.status === "pending");
  const health = (healthRes.data ?? null) as { db_bytes: number | null } | null;

  const staging = coverage.reduce((n, c) => n + c.staging, 0);
  const approved = coverage.reduce((n, c) => n + c.approved, 0);
  const people = institutes.reduce((n, i) => n + i.admins + i.teachers + i.students, 0);
  const ready = coverage.filter((c) => c.bank_status === "ready");
  const seeding = coverage.filter((c) => c.bank_status === "seeding");
  const dbMb = health?.db_bytes ? Math.round(health.db_bytes / 1024 / 1024) : null;

  return (
    <AppShell
      area="platform"
      pathname="/platform"
      eyebrow="Platform console"
      title={
        <>
          The whole platform, <em>from one screen</em>
        </>
      }
      intro="Institutes, the review queue, activation and the audit trail. Reading a tenant's data happens only through audited functions — there is no impersonation and no blanket cross-tenant access."
    >
      <div className="cards c4">
        <div className="card"><span className="big">{institutes.length}</span><span className="cap">Institutes</span></div>
        <div className="card"><span className="big">{people}</span><span className="cap">People</span></div>
        <div className="card"><span className="big">{approved.toLocaleString("en-IN")}</span><span className="cap">Approved questions</span></div>
        <div className="card"><span className="big">{staging.toLocaleString("en-IN")}</span><span className="cap">Awaiting review</span></div>
      </div>

      <h2 className="sect">What needs you</h2>
      <div className="cards c3">
        <div className="card">
          <h4>Review queue</h4>
          <p><b>{staging}</b> staged question{staging === 1 ? "" : "s"}. Nothing reaches a paper unreviewed.</p>
          <div className="btnrow" style={{ marginTop: 10 }}>
            <Link className="btn sm solid" href="/platform/bank">Open queue</Link>
          </div>
        </div>
        <div className="card">
          <h4>Activation requests</h4>
          <p><b>{requests.length}</b> waiting on a decision.</p>
          <div className="btnrow" style={{ marginTop: 10 }}>
            <Link className="btn sm solid" href="/platform/requests">Open requests</Link>
          </div>
        </div>
        <div className="card">
          <h4>Headroom</h4>
          <p>
            {dbMb === null ? "Database size unavailable." : <>Database at <b>{dbMb} MB</b> of the 500 MB free tier ({Math.round((dbMb / 500) * 100)}%).</>}
          </p>
          <div className="btnrow" style={{ marginTop: 10 }}>
            <Link className="btn sm ghost" href="/platform/health">Open health</Link>
          </div>
        </div>
      </div>

      <h2 className="sect">Bank readiness</h2>
      <div className="cards c2">
        <div className="card">
          <h4>Ready — {ready.length}</h4>
          <p>{ready.length ? ready.map((r) => r.label).join(" · ") : "None yet."}</p>
        </div>
        <div className="card">
          <h4>Seeding — {seeding.length}</h4>
          <p>{seeding.length ? seeding.map((r) => r.label).join(" · ") : "None in progress."}</p>
        </div>
      </div>

      <div className="notice plain" style={{ marginTop: 18 }}>
        <b>The real cost lives here, not in the software.</b> A class-subject becomes usable after roughly
        1,200 reviewed questions — about fifteen hours of attention, paid once for the whole platform. Each
        additional institute on it then costs about an hour.
      </div>
    </AppShell>
  );
}
