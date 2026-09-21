import type { Metadata } from "next";
import { SignUpForm } from "../login/PasswordForms";
import { getSession } from "@/server/session";
import { SignedInAs } from "../_components/SignedInAs";

export const metadata: Metadata = { title: "Create an account · PaperFlow" };

/**
 * Username accounts (migration 0019). Deliberately asks for no role and no
 * institute: those come afterwards, from a join code or an approved request.
 */
export default async function SignUpPage() {
  const session = await getSession();

  return (
    <div className="loginpage">
      <section className="loginhero">
        <p className="eyebrow">Create an account</p>
        <h1>
          One account, <em>then your institute lets you in.</em>
        </h1>
        <p>Signing up takes a minute. What happens next depends on who you are:</p>
        <div className="loginfacts">
          <div>
            <span className="k">Students</span>
            <span>Enter the six-character batch code your teacher gives you. You are in straight away.</span>
          </div>
          <div>
            <span className="k">Teachers</span>
            <span>
              Ask your institute for access and say what you teach. Your institute admin approves you, and
              your subjects appear.
            </span>
          </div>
          <div>
            <span className="k">Institutes</span>
            <span>Ask for access to your institute; the platform sets up its first admin.</span>
          </div>
        </div>
      </section>

      <section className="loginpanel">
        <div className="mark">PaperFlow</div>
        <p className="markcap">Create an account</p>
        {session ? <SignedInAs session={session} /> : <SignUpForm />}
        <p className="loginnote" style={{ textAlign: "left", marginTop: 16 }}>
          There is no email and no password reset by email. If you forget your password, ask your
          institute admin or the platform to reset it.
        </p>
      </section>
    </div>
  );
}
