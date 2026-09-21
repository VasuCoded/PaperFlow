import type { Metadata } from "next";
import { AppShell } from "../../_components/AppShell";
import { ActionButton } from "../../_components/ActionButton";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { requestActivation } from "@/server/actions/institute";

export const metadata: Metadata = { title: "Subjects · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

const READINESS: Record<string, string> = {
  ready: "Shared bank reviewed",
  seeding: "Being reviewed now",
  planned: "Not started",
};

export default async function SubjectsPage() {
  const session = await getSession();
  const inst = session?.role === "institute_admin" ? session.instituteId : null;
  const supabase = await createServerSupabaseClient();
  const { data } = inst ? await supabase.rpc("institute_subject_overview", { p_institute_id: inst }) : { data: [] };
  const rows = data ?? [];

  const byClass = new Map<string, typeof rows>();
  for (const r of rows) byClass.set(r.class_name, [...(byClass.get(r.class_name) ?? []), r]);
  const declined = rows.filter((r) => r.last_decline_reason && r.status !== "active" && !r.pending_request);

  return (
    <AppShell area="institute" pathname="/institute/subjects">
      {declined.length > 0 && (
        <div className="notice warn">
          <b>Declined requests.</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {declined.map((r) => (
              <li key={r.class_subject_id}>
                Class {r.class_name} · {r.subject_name}: &ldquo;{r.last_decline_reason}&rdquo;
                {r.last_declined_at && <> ({dateFmt.format(new Date(r.last_declined_at))})</>} — you can ask again below.
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="lede">No class-subjects exist on the platform yet.</p>
      ) : (
        [...byClass.entries()].map(([className, list]) => (
          <div key={className} style={{ marginBottom: 18 }}>
            <h2 className="sect">Class {className}</h2>
            <div className="tablewrap">
              <table className="lt">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Bank readiness</th>
                    <th className="num">Shared questions</th>
                    <th className="num">Your private</th>
                    <th>Your status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.class_subject_id}>
                      <td><b>{r.subject_name}</b></td>
                      <td>
                        <span className={`pill ${r.bank_status}`}>{r.bank_status}</span>
                        <span className="sub">{READINESS[r.bank_status] ?? ""}</span>
                      </td>
                      <td className="num">{r.approved_shared.toLocaleString("en-IN")}</td>
                      <td className="num">{r.approved_private.toLocaleString("en-IN")}</td>
                      <td>
                        {r.status === "active" ? (
                          <span className="pill active">Active</span>
                        ) : r.pending_request ? (
                          <span className="pill seeding">Requested</span>
                        ) : (
                          <span className="pill planned">Not active</span>
                        )}
                      </td>
                      <td>
                        {r.status !== "active" && !r.pending_request && (
                          <ActionButton
                            action={requestActivation.bind(null, r.class_subject_id)}
                            label={r.last_decline_reason ? "Ask again" : "Request"}
                            pendingLabel="Requesting…"
                            doneLabel="Requested"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      <div className="cards c2" style={{ marginTop: 8 }}>
        <div className="card tinted">
          <h4>Why not everything is available</h4>
          <p>
            A subject is switched on only once its question bank is deep enough to set papers that don&rsquo;t repeat
            within a couple of tests: at least 60 reviewed questions in every chapter. A thin bank loses a teacher&rsquo;s
            trust in two tests, so the platform will say &ldquo;not yet&rdquo; rather than switch it on early.
          </p>
        </div>
        <div className="card">
          <h4>What a request does</h4>
          <p>
            It puts the subject in the platform&rsquo;s queue with your institute&rsquo;s name. You&rsquo;ll see the outcome
            here: Active, or a reason. Before activating, the platform may ask one of your teachers to read three
            generated papers.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
