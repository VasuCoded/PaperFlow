import type { Metadata } from "next";
import Link from "next/link";
import { getStudentContext, StudentShell } from "../_components/StudentShell";
import { SignOutButton } from "../../_components/SignOutButton";
import { InstituteSwitcher } from "../../_components/InstituteSwitcher";
import { displayIdentity, isUsernameEmail } from "@/lib/identity";
import { ChangePassword } from "../../_components/ChangePassword";

export const metadata: Metadata = { title: "Me · PaperFlow" };

export default async function MePage() {
  const ctx = await getStudentContext("/app/me");
  const { session, subjects } = ctx;
  const institute = session.memberships.find((m) => m.instituteId === session.instituteId);

  return (
    <StudentShell ctx={ctx} tab="me">
      <p className="sec-label">Account</p>
      <div className="testcard">
        <h3 style={{ fontSize: 17 }}>{session.fullName ?? "Your account"}</h3>
        <div className="meta">{displayIdentity(session.email).toUpperCase()}</div>
        <p style={{ fontSize: 12.5, color: "var(--graphite)", margin: "10px 0 0" }}>
          {isUsernameEmail(session.email) ? "Signed in with your username." : "Signed in with Google."} Your institute decides what you can see;
          nothing here changes that.
        </p>
      </div>

      {isUsernameEmail(session.email) && (
        <>
          <p className="sec-label" id="password">Password</p>
          <div className="testcard quiet">
            <ChangePassword />
          </div>
        </>
      )}

      <p className="sec-label">Institute</p>
      <div className="testcard quiet">
        <h3 style={{ fontSize: 16 }}>{institute?.instituteName}</h3>
        {session.memberships.length > 1 && institute && (
          <InstituteSwitcher memberships={session.memberships} current={institute.instituteId} />
        )}
      </div>

      <p className="sec-label">Your batches</p>
      {subjects.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--graphite)" }}>None yet.</p>
      ) : (
        subjects.map((s) => (
          <div className="testcard quiet" key={s.classSubjectId} style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: 15 }}>{s.batchName}</h3>
            <div className="meta">{s.label.toUpperCase()}</div>
          </div>
        ))
      )}
      <p style={{ fontSize: 12, color: "var(--graphite)", marginTop: 8 }}>
        One batch per subject. To join another subject, enter its code.{" "}
        <Link href="/welcome?join=1" style={{ color: "var(--pen)" }}>Enter a join code</Link>
      </p>

      <p className="sec-label">Offline</p>
      <div className="practice idle">
        <h4>Reading works offline; logging does not</h4>
        <p>If you lose connection while logging, the app tells you and saves nothing — so nothing is lost silently.</p>
      </div>

      <div style={{ marginTop: 18 }}>
        <SignOutButton className="cta quiet" />
      </div>
    </StudentShell>
  );
}
