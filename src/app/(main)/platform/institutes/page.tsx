import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../../_components/AppShell";
import { ActionButton } from "../../_components/ActionButton";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { setInstituteStatusAction } from "@/server/actions/platform";
import { CreateInstituteForm } from "./CreateInstituteForm";

export const metadata: Metadata = { title: "Institutes · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function InstitutesPage() {
  const session = await getSession();
  const supabase = await createServerSupabaseClient();
  const { data } = session?.isPlatformOwner ? await supabase.rpc("platform_list_institutes") : { data: [] };
  const institutes = data ?? [];

  return (
    <AppShell area="platform" pathname="/platform/institutes">
      {institutes.length === 0 ? (
        <p className="lede">No institutes yet. Create the first one below.</p>
      ) : (
        <div className="tablewrap">
          <table className="lt">
            <thead>
              <tr>
                <th>Institute</th>
                <th className="num">Admins</th>
                <th className="num">Teachers</th>
                <th className="num">Students</th>
                <th className="num">Subjects</th>
                <th className="num">Papers</th>
                <th>Last activity</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {institutes.map((i) => (
                <tr key={i.id}>
                  <td>
                    <b>{i.name}</b>
                    <span className="sub" style={{ fontFamily: "var(--mono)" }}>{i.slug} · since {dateFmt.format(new Date(i.created_at))}</span>
                  </td>
                  <td className="num">{i.admins}</td>
                  <td className="num">{i.teachers}</td>
                  <td className="num">{i.students}</td>
                  <td className="num">{i.active_subjects}</td>
                  <td className="num">{i.papers}</td>
                  <td>{i.last_activity ? dateFmt.format(new Date(i.last_activity)) : "—"}</td>
                  <td>
                    <span className={`pill ${i.status === "active" ? "active" : "suspended"}`}>{i.status}</span>
                  </td>
                  <td>
                    <div className="btnrow">
                      <Link className="btn sm ghost" href={`/platform/institutes/${i.id}`}>Inspect</Link>
                      {i.status === "active" ? (
                        <ActionButton
                          action={setInstituteStatusAction.bind(null, i.id, "suspended")}
                          label="Suspend"
                          confirm={`Suspend ${i.name}? Their teachers and students lose access until you reactivate.`}
                          confirmLabel="Suspend"
                        />
                      ) : (
                        <ActionButton action={setInstituteStatusAction.bind(null, i.id, "active")} label="Reactivate" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="cards c2" style={{ marginTop: 20 }}>
        <div className="card">
          <h4>Create an institute</h4>
          <p style={{ marginBottom: 12 }}>
            One transaction creates the institute and the first admin&rsquo;s invite. The admin then invites
            their own teachers and students.
          </p>
          <CreateInstituteForm />
        </div>
        <div className="card tinted">
          <h4>What suspension does</h4>
          <p>
            A suspended institute keeps all its data. Its members stop resolving as members, so every
            policy that asks &ldquo;is this person in this institute&rdquo; answers no. Reactivating restores
            everything exactly as it was.
          </p>
          <h4 style={{ marginTop: 14 }}>No impersonation</h4>
          <p>
            There is no &ldquo;log in as&rdquo; button and there will not be one. When you need to see what an
            institute sees, Inspect reads it through an audited function.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
