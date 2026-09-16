import type { Metadata } from "next";
import { AppShell } from "../../_components/AppShell";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { ExportButton } from "./ExportButton";

export const metadata: Metadata = { title: "Export · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function ExportPage() {
  const session = await getSession();
  const inst = session?.role === "institute_admin" ? session.instituteId : null;
  const supabase = await createServerSupabaseClient();

  const head = { count: "exact" as const, head: true };
  const [members, batches, papers, attempts, privateQs, recentPapers] = inst
    ? await Promise.all([
        supabase.from("institute_members").select("user_id", head).eq("institute_id", inst),
        supabase.from("batches").select("id", head).eq("institute_id", inst),
        supabase.from("papers").select("id", head).eq("institute_id", inst),
        supabase.from("attempts").select("id", head).eq("institute_id", inst),
        supabase.from("questions").select("id", head).eq("owner_institute_id", inst),
        supabase
          .from("papers")
          .select("id, title, created_at")
          .eq("institute_id", inst)
          .order("created_at", { ascending: false })
          .limit(12),
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }, { data: [] }];

  const rows = [
    { what: "Members, roles and invitations", n: members.count ?? 0 },
    { what: "Batches and enrolments", n: batches.count ?? 0 },
    { what: "Papers, with their sets and orders", n: papers.count ?? 0 },
    { what: "Attempts and mistake logs", n: attempts.count ?? 0 },
    { what: "Your private questions", n: privateQs.count ?? 0 },
  ];

  return (
    <AppShell
      area="institute"
      pathname="/institute/export"
      eyebrow="Institute · export"
      title={
        <>
          Your data, <em>whenever you want it</em>
        </>
      }
      intro="One click gives you everything your institute owns as JSON, and every paper can be printed to PDF. A tenant that cannot leave is a tenant that is right to be nervous."
    >
      <div className="cards c2">
        <div className="card">
          <h4>What&rsquo;s included</h4>
          <div className="tablewrap" style={{ marginTop: 10, border: 0 }}>
            <table className="lt">
              <tbody>
                {rows.map((r) => (
                  <tr key={r.what}>
                    <td>{r.what}</td>
                    <td className="num"><b>{r.n.toLocaleString("en-IN")}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: "var(--graphite)", marginTop: 10 }}>
            Also practice sets, flags, subject assignments, activation history and the role-change log.
          </p>
          <ExportButton />
        </div>

        <div className="card tinted">
          <h4>What&rsquo;s not included, and why</h4>
          <p style={{ marginBottom: 10 }}>
            The <b>shared question bank</b> is not in your export. It is licensed to you for use inside the platform,
            not distributed — the same is true for every other institute, which is what makes the shared bank possible
            at all. Papers in the export reference shared questions by id.
          </p>
          <p>
            Your own private questions <b>are</b> included, with their answers, and they stay yours. They are never
            promoted into the shared bank without your written agreement.
          </p>
        </div>
      </div>

      <h2 className="sect">Papers as PDF</h2>
      {(recentPapers.data ?? []).length === 0 ? (
        <p className="lede">No papers yet.</p>
      ) : (
        <div className="tablewrap">
          <table className="lt">
            <thead>
              <tr><th>Paper</th><th>Created</th><th /></tr>
            </thead>
            <tbody>
              {(recentPapers.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td><b>{p.title}</b></td>
                  <td>{dateFmt.format(new Date(p.created_at))}</td>
                  <td>
                    <div className="btnrow">
                      <a className="btn sm ghost" href={`/print/paper/${p.id}?only=papers`} target="_blank" rel="noreferrer">Papers</a>
                      <a className="btn sm ghost" href={`/print/paper/${p.id}?only=keys`} target="_blank" rel="noreferrer">Answer keys</a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ fontSize: 12, color: "var(--graphite)", marginTop: 8 }}>
        Each opens the print view; use the browser&rsquo;s Print → Save as PDF. The twelve most recent papers are listed.
      </p>
    </AppShell>
  );
}
