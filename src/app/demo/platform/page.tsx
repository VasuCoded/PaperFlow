"use client";

import Link from "next/link";
import { Shell } from "../_components/Shell";
import { INSTITUTES } from "@/demo/institutes";
import { ACTIVATION_REQUESTS, HEALTH, MEMBERS, PAPERS, STAGING_QUEUE } from "@/demo/activity";
import { CLASS_SUBJECTS } from "@/demo/bank";

export default function PlatformOverview() {
  const tenants = INSTITUTES.filter((i) => i.kind === "institute");
  const pending = ACTIVATION_REQUESTS.filter((r) => r.status === "pending");
  const ready = CLASS_SUBJECTS.filter((c) => c.bankStatus === "ready");
  const seeding = CLASS_SUBJECTS.filter((c) => c.bankStatus === "seeding");
  const people = Object.values(MEMBERS).flat().length;

  return (
    <Shell
      area="platform"
      eyebrow="Platform console"
      title={<>The whole platform, <em>from one screen</em></>}
      intro="Institutes, the review queue, activation and the audit trail. Reading a tenant's data happens through audited functions — there is no impersonation and no blanket cross-tenant query."
    >
      <div className="cards c4">
        <div className="card"><span className="big">{tenants.length}</span><span className="cap">Institutes</span></div>
        <div className="card"><span className="big">{people}</span><span className="cap">People</span></div>
        <div className="card"><span className="big">{PAPERS.length}</span><span className="cap">Papers generated</span></div>
        <div className="card"><span className="big">{STAGING_QUEUE.length}</span><span className="cap">Awaiting review</span></div>
      </div>

      <h2 className="sect">What needs you today</h2>
      <div className="cards c3">
        <div className="card">
          <h4>Review queue</h4>
          <p>
            <b>{STAGING_QUEUE.length}</b> staged questions, {STAGING_QUEUE.filter((q) => q.note).length} with a
            note from the ingestion session. Nothing reaches a paper unreviewed.
          </p>
          <div className="btnrow" style={{ marginTop: 10 }}>
            <Link className="btn sm solid" href="/demo/platform/bank">Open queue</Link>
          </div>
        </div>
        <div className="card">
          <h4>Activation requests</h4>
          <p>
            <b>{pending.length}</b> waiting. {pending.filter((p) => p.gateMet).length} meet the
            coverage gate; the rest need more bank depth first.
          </p>
          <div className="btnrow" style={{ marginTop: 10 }}>
            <Link className="btn sm solid" href="/demo/platform/requests">Open requests</Link>
          </div>
        </div>
        <div className="card">
          <h4>Free-tier headroom</h4>
          <p>
            Database at <b>{Math.round((HEALTH.dbMb / HEALTH.dbLimitMb) * 100)}%</b> of 500 MB.
            Last backup {HEALTH.lastBackup}.
          </p>
          <div className="btnrow" style={{ marginTop: 10 }}>
            <Link className="btn sm ghost" href="/demo/platform/health">Open health</Link>
          </div>
        </div>
      </div>

      <h2 className="sect">Bank readiness</h2>
      <div className="cards c2">
        <div className="card">
          <h4>Ready — {ready.length} class-subjects</h4>
          <p>{ready.map((r) => `Class ${r.className} ${r.subjectName}`).join(" · ")}</p>
        </div>
        <div className="card">
          <h4>Seeding — {seeding.length} class-subjects</h4>
          <p>{seeding.map((r) => `Class ${r.className} ${r.subjectName}`).join(" · ")}</p>
        </div>
      </div>

      <div className="notice plain" style={{ marginTop: 18 }}>
        <b>The real cost sits here, not in the software.</b> A class-subject becomes usable after
        roughly 1,200 reviewed questions — about 15 hours of human attention. That is paid once per
        class-subject for the whole platform, and every additional institute then costs about an
        hour. That ratio is the entire commercial argument.
      </div>
    </Shell>
  );
}
