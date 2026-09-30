import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "../login/PasswordForms";
import { getSession } from "@/server/session";
import { SignedInAs } from "../_components/SignedInAs";
import { Logo } from "@/components/brand/Logo";
import { Icon, type IconName } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Create an account · PaperFlow" };

const NEXT: { icon: IconName; who: string; text: string }[] = [
  { icon: "user", who: "Students", text: "Enter the six-character batch code your teacher gives you. You are in straight away." },
  { icon: "idcard", who: "Teachers", text: "Ask your institute for access and say what you teach. Your institute admin approves you, and your subjects appear." },
  { icon: "building", who: "Institutes", text: "Ask for access to your institute; the platform sets up its first admin." },
];

/**
 * Username accounts (migration 0019). Deliberately asks for no role and no
 * institute: those come afterwards, from a join code or an approved request.
 */
export default async function SignUpPage() {
  const session = await getSession();

  return (
    <div className="authpage">
      <header className="lp-nav slim">
        <Link href="/login" aria-label="PaperFlow home">
          <Logo size={30} />
        </Link>
        <Link className="btn sm" href="/login">Sign in</Link>
      </header>

      <div className="authgrid">
        <section className="lp-panel">
          <h2>Create an account</h2>
          <p className="lp-panelsub">It takes a minute. No email needed.</p>
          {session ? <SignedInAs session={session} /> : <SignUpForm />}
          <p className="loginnote" style={{ textAlign: "left", marginTop: 16 }}>
            There is no password reset by email. If you forget your password, ask your institute admin or the
            platform to reset it.
          </p>
        </section>

        <aside className="authside">
          <p className="eyebrow">What happens next</p>
          <h1>
            One account, <em>then your institute lets you in.</em>
          </h1>
          <div className="authsteps">
            {NEXT.map((n) => (
              <div key={n.who}>
                <span className="lp-featic"><Icon name={n.icon} size={18} /></span>
                <span>
                  <b>{n.who}</b>
                  {n.text}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
