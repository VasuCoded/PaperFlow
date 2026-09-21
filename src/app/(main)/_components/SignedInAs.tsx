import Link from "next/link";
import { displayIdentity } from "@/lib/identity";
import { homePath, type Session } from "@/server/session";
import { SignOutButton } from "./SignOutButton";

/**
 * Shown on /login and /signup to someone who is already signed in. Silently
 * redirecting them home made it impossible to switch accounts: a tester who
 * had been signed in as an institute admin opened the sign-in link to try a
 * teacher account and simply landed back in the institute console.
 */
export function SignedInAs({ session }: { session: Session }) {
  return (
    <>
      <div className="notice" style={{ marginBottom: 16 }}>
        You are signed in as <b>{session.fullName ?? displayIdentity(session.email)}</b>{" "}
        ({displayIdentity(session.email)}).
      </div>
      <Link href={homePath(session)} className="btn" style={{ display: "block", textAlign: "center", marginBottom: 10 }}>
        Continue as {displayIdentity(session.email)}
      </Link>
      <SignOutButton className="btn ghost" label="Sign out and use another account" block />
    </>
  );
}
