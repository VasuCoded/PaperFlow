import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession, homePath } from "@/server/session";
import { displayIdentity } from "@/lib/identity";
import { SignOutButton } from "../_components/SignOutButton";
import { AcceptInvite } from "./AcceptInvite";
import { JoinForm } from "./JoinForm";
import { RequestAccessForm, WithdrawRequestButton } from "./RequestAccess";

export const metadata: Metadata = { title: "Welcome · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const ROLE_LABEL: Record<string, string> = { institute_admin: "institute admin", teacher: "teacher", student: "student" };

/**
 * The "you belong to nothing yet" screen (BUILD-PLAN 4.3 / C2 item 2).
 *
 * A new account creates a profiles row and NOTHING else. There are exactly
 * three ways forward, none of which lets a person choose their own role:
 *   - a batch join code (the teacher's approval — students)
 *   - an access request, approved by the institute or the platform, who pick
 *     the role (migration 0019)
 *   - an invitation matched on the account's confirmed address
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string }>;
}) {
  const { join } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createServerSupabaseClient();
  // Definer functions: a user with no membership can read neither invites nor
  // institute names under RLS.
  const [{ data: invites }, { data: suspendedRows }, { data: requestRows }, { data: institutes }] = await Promise.all([
    supabase.rpc("my_pending_invites"),
    // Members of a suspended institute resolve to no membership at all, so
    // without this they would land here with no idea why.
    supabase.rpc("my_suspended_institutes"),
    supabase.rpc("my_access_requests"),
    supabase.rpc("requestable_institutes"),
  ]);
  const pending = invites ?? [];
  const suspended = suspendedRows ?? [];
  const requests = requestRows ?? [];
  const waiting = requests.filter((r) => r.status === "pending");

  // Someone who already belongs somewhere does not need this screen — unless
  // an invitation is waiting (e.g. the platform owner invited to an institute,
  // or a teacher invited to a second one), or they came to join another batch.
  if (session.memberships.length > 0 && pending.length === 0 && join !== "1") redirect(homePath(session));
  const member = session.memberships.length > 0;
  const whoami = displayIdentity(session.email);

  return (
    <div className="wrap narrow">
      <header className="masthead">
        <div>
          <p className="eyebrow">{member ? "Join another institute or batch" : `Signed in as ${whoami} · no institute yet`}</p>
          <h1>
            {member ? (
              <>Enter a code, or <em>ask another institute.</em></>
            ) : waiting.length > 0 ? (
              <>Your request is with <em>{waiting[0]!.institute_name}.</em></>
            ) : (
              <>You&rsquo;re signed in. <em>Now your institute lets you in.</em></>
            )}
          </h1>
          <p>
            An account proves who you are. It does not give you a role or put you in an institute:
            students join with their teacher&rsquo;s batch code; teachers and staff ask their institute,
            and the institute decides.
          </p>
        </div>
        <SignOutButton className="btn" />
      </header>

      {suspended.length > 0 && (
        <div className="notice warn">
          <b>Access paused.</b>{" "}
          {suspended.map((s) => s.institute_name).join(", ")}{" "}
          {suspended.length === 1 ? "is" : "are"} currently suspended on PaperFlow, so your account cannot
          open {suspended.length === 1 ? "its" : "their"} papers or batches. Nothing has been deleted — everything
          comes back when the institute is reactivated. Ask the institute about it.
        </div>
      )}

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h4>Invitations for {whoami}</h4>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {pending.map((inv) => (
              <div key={inv.id} className="card tinted" style={{ padding: "12px 13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <b style={{ fontSize: 13.5 }}>{inv.institute_name}</b>
                    <div className="cap" style={{ marginTop: 3 }}>AS {inv.role.replace("_", " ").toUpperCase()}</div>
                  </div>
                  <AcceptInvite inviteId={inv.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="cards c2">
        <div className="card">
          <h4>Students: join with your batch code</h4>
          <p style={{ marginBottom: 12 }}>Six characters from your teacher. You are in straight away.</p>
          <JoinForm />
          <p style={{ fontSize: 11.5, color: "var(--graphite)", marginTop: 14 }}>
            Codes never contain O, 0, I or 1, and are unique across every institute.
          </p>
        </div>

        <div className="card">
          <h4>Teachers and staff: ask your institute</h4>
          <p style={{ marginBottom: 12 }}>Your institute admin approves you and sets up your subjects.</p>
          <RequestAccessForm institutes={institutes ?? []} />
        </div>
      </div>

      {requests.length > 0 && (
        <>
          <h2 className="sect">Your requests</h2>
          <div className="tablewrap">
            <table className="lt">
              <thead>
                <tr><th>Institute</th><th>Asked</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.institute_name}</b></td>
                    <td>{dateFmt.format(new Date(r.created_at))}</td>
                    <td>
                      {r.status === "pending" && <span className="pill seeding">Waiting</span>}
                      {r.status === "approved" && (
                        <span className="pill active">Approved{r.granted_role ? ` · ${ROLE_LABEL[r.granted_role] ?? r.granted_role}` : ""}</span>
                      )}
                      {r.status === "declined" && (
                        <>
                          <span className="pill suspended">Declined</span>
                          {r.reason && <span className="sub">&ldquo;{r.reason}&rdquo;</span>}
                        </>
                      )}
                      {r.status === "withdrawn" && <span className="pill planned">Withdrawn</span>}
                    </td>
                    <td>{r.status === "pending" && <WithdrawRequestButton requestId={r.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {requests.some((r) => r.status === "approved") && !member && (
            <p style={{ fontSize: 12.5, marginTop: 8 }}>
              Approved? <Link href="/">Open PaperFlow →</Link>
            </p>
          )}
        </>
      )}
    </div>
  );
}
