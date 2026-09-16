import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/db/server";
import { getSession } from "@/server/session";
import { SignOutButton } from "../_components/SignOutButton";
import { AcceptInvite } from "./AcceptInvite";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = { title: "Welcome · PaperFlow" };

/**
 * The "you belong to nothing yet" screen (BUILD-PLAN 4.3 / C2 item 2).
 *
 * A new Google sign-in creates a profiles row and NOTHING else. This screen
 * offers exactly two ways forward — accept an invitation, or enter a batch code
 * — and deliberately offers no third. No signup form, no institute creation, no
 * role selection anywhere.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ join?: string }>;
}) {
  const { join } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  // Someone who already belongs somewhere does not need this screen — unless
  // they came here on purpose to join another batch (?join=1).
  if (session.memberships.length > 0 && join !== "1") {
    if (session.isPlatformOwner) redirect("/platform");
    if (session.role === "institute_admin") redirect("/institute");
    if (session.role === "teacher") redirect("/teacher/generate");
    redirect("/app");
  }

  const supabase = await createServerSupabaseClient();
  // A user with no membership cannot SELECT invites under RLS, so this reads
  // them through the SECURITY DEFINER function, matched on their verified email.
  const [{ data: invites }, { data: suspendedRows }] = await Promise.all([
    supabase.rpc("my_pending_invites"),
    // Members of a suspended institute resolve to no membership at all, so
    // without this they would land here with no idea why.
    supabase.rpc("my_suspended_institutes"),
  ]);
  const pending = invites ?? [];
  const suspended = suspendedRows ?? [];
  const member = session.memberships.length > 0;

  return (
    <div className="wrap narrow">
      <header className="masthead">
        <div>
          <p className="eyebrow">{member ? "Join another batch" : "Signed in · no institute yet"}</p>
          <h1>
            {member ? (
              <>Enter the code for <em>your next batch.</em></>
            ) : (
              <>You&rsquo;re signed in. <em>Now you need an invite or a code.</em></>
            )}
          </h1>
          <p>
            Signing in with Google proves who you are. It does not grant a role and does not put you
            in an institute — that happens when an institute invites you, or when you enter a batch
            code from your teacher.
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

      <div className="cards c2">
        <div className="card">
          <h4>Invitations for {session.email}</h4>
          {pending.length === 0 ? (
            <>
              <p style={{ marginTop: 8 }}>
                Nothing waiting for this email. If you were expecting an invitation, ask your
                institute to send it to the address you just signed in with.
              </p>
              <div className="notice plain" style={{ marginTop: 14, marginBottom: 0 }}>
                An invitation is matched on your <b>verified</b> email, case-insensitively. It
                cannot be claimed by anyone else.
              </div>
            </>
          ) : (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {pending.map((inv) => (
                <div key={inv.id} className="card tinted" style={{ padding: "12px 13px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <b style={{ fontSize: 13.5 }}>{inv.institute_name}</b>
                      <div className="cap" style={{ marginTop: 3 }}>
                        AS {inv.role.toUpperCase()}
                      </div>
                    </div>
                    <AcceptInvite inviteId={inv.id} />
                  </div>
                </div>
              ))}
              <p style={{ fontSize: 12, color: "var(--graphite)", margin: 0 }}>
                Accepting writes one membership row with the role you were invited as. You cannot
                change that role here.
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <h4>Join a batch with a code</h4>
          <p style={{ marginBottom: 12 }}>
            Six characters from your teacher. Students join this way.
          </p>
          <JoinForm />
          <p style={{ fontSize: 11.5, color: "var(--graphite)", marginTop: 14 }}>
            Codes never contain O, 0, I or 1, and are unique across every institute.
          </p>
        </div>
      </div>

      <div className="notice plain" style={{ marginTop: 18 }}>
        There is deliberately no third option on this screen. No &ldquo;create an institute&rdquo;,
        no &ldquo;I am a teacher&rdquo; checkbox, no role dropdown — a form that lets a user
        influence their own role is the one thing the invitation system exists to prevent.
      </div>
    </div>
  );
}
