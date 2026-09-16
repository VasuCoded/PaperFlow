import type { Metadata } from "next";
import { AppShell } from "../../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { GATE, gateStatus } from "@/lib/gate";
import { ActivationCell, BankStatusSelect } from "./ActivationControls";

export const metadata: Metadata = { title: "Activation · PaperFlow" };

export default async function ActivationPage() {
  const session = await getSession();
  const owner = !!session?.isPlatformOwner;
  const supabase = await createServerSupabaseClient();

  const [institutesRes, coverageRes, icsRes] = owner
    ? await Promise.all([
        supabase.rpc("platform_list_institutes"),
        supabase.rpc("platform_bank_coverage"),
        // ics_write_platform is a FOR ALL policy for the platform owner, which
        // includes SELECT: the matrix reads activation state directly.
        supabase.from("institute_class_subjects").select("institute_id, class_subject_id, status"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const institutes = (institutesRes.data ?? []).filter((i) => i.status === "active");
  const coverage = coverageRes.data ?? [];
  const activeSet = new Set(
    (icsRes.data ?? []).filter((r) => r.status === "active").map((r) => `${r.institute_id}:${r.class_subject_id}`),
  );

  return (
    <AppShell
      area="platform"
      pathname="/platform/activation"
      eyebrow="Platform · activation"
      title={
        <>
          Two statuses, <em>kept apart</em>
        </>
      }
      intro="Bank status is platform-wide: how thick the shared bank is. Activation is per institute: whether that institute has it turned on. Activating for one institute never changes what another sees."
    >
      <div className="notice warn">
        <b>The gate.</b> Never activate thin: no chapter under {GATE.minPerChapter} approved questions, no topic under{" "}
        {GATE.minPerTopic}, every pattern section type at 3× its required count, and a teacher confirming the
        generated papers are ones they would have set. The console checks the first two. The last two are yours.
      </div>

      {coverage.length === 0 ? (
        <p className="lede">No class-subjects exist yet. Seed the taxonomy first (see docs/RUNBOOK.md).</p>
      ) : (
        <div className="tablewrap">
          <table className="matrix" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th className="rowhead">Class-subject</th>
                <th>Bank</th>
                <th>Approved</th>
                <th>Thinnest chapter</th>
                <th>Gate</th>
                {institutes.map((i) => (
                  <th key={i.id} title={i.name}>{i.name.length > 14 ? `${i.name.slice(0, 13)}…` : i.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coverage.map((c) => {
                const gate = gateStatus(c);
                return (
                  <tr key={c.class_subject_id}>
                    <td className="rowhead"><b>{c.label}</b></td>
                    <td><BankStatusSelect classSubjectId={c.class_subject_id} status={c.bank_status} /></td>
                    <td style={{ fontFamily: "var(--mono)" }}>
                      {c.approved.toLocaleString("en-IN")}
                      {c.staging > 0 && <span style={{ display: "block", fontSize: 10, color: "var(--graphite)" }}>+{c.staging} staged</span>}
                    </td>
                    <td style={{ fontSize: 11.5 }}>
                      {c.thinnest_chapter ? (
                        <>
                          {c.thinnest_chapter}{" "}
                          <span style={{ fontFamily: "var(--mono)", color: (c.thinnest_chapter_count ?? 0) < GATE.minPerChapter ? "var(--pen)" : "var(--ledger)" }}>
                            {c.thinnest_chapter_count}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td title={gate.gaps.join("\n")}>
                      <span className={`pill ${gate.met ? "ready" : "suspended"}`}>{gate.met ? "met" : "not met"}</span>
                    </td>
                    {institutes.map((i) => {
                      const active = activeSet.has(`${i.id}:${c.class_subject_id}`);
                      return (
                        <td key={i.id} className={active ? "cell-active" : "cell-planned"}>
                          <ActivationCell
                            instituteId={i.id}
                            instituteName={i.name}
                            classSubjectId={c.class_subject_id}
                            label={c.label}
                            active={active}
                            gateGaps={gate.gaps}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {institutes.length === 0 && coverage.length > 0 && (
        <p className="lede" style={{ marginTop: 14 }}>No active institutes to activate for. Create one under Institutes.</p>
      )}

      <div className="cards c2" style={{ marginTop: 20 }}>
        <div className="card tinted">
          <h4>What the second institute costs</h4>
          <p>
            The fifteen hours of review is paid once per class-subject, for the whole platform. Turning a
            ready subject on for another institute is about an hour: check the gate against their private
            layer, have one of their teachers read three generated papers, activate.
          </p>
        </div>
        <div className="card">
          <h4>Every change is logged</h4>
          <p>
            Activating or deactivating writes a row to the platform access log naming the institute and the
            class-subject. Deactivating hides the subject from that institute&rsquo;s teachers and students;
            papers already made are kept.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
