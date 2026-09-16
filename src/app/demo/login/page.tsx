"use client";

import { useDemoSession } from "@/demo/session";
import { ACCOUNTS, instituteName, ROLE_LABEL } from "@/demo/institutes";

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

export default function DemoLoginPage() {
  const { signIn } = useDemoSession();

  return (
    <div className="loginpage">
      <section className="loginhero">
        <p className="eyebrow">Question bank · classes 9 to 12</p>
        <h1>
          The paper still goes on paper. <em>Everything around it gets easier.</em>
        </h1>
        <p>
          A teacher sets a balanced test in a minute instead of an evening. Students tap the
          questions they got wrong. The practice set builds itself from that, on exactly the
          topics they are weak in.
        </p>
        <div className="loginfacts">
          <div>
            <span className="k">Paper</span>
            <span>
              Tests are printed and marked by hand, as they are today. Nothing moves online, and
              nothing is scored by the app.
            </span>
          </div>
          <div>
            <span className="k">Sets</span>
            <span>
              Up to four printed orderings of the same paper, so neighbours cannot copy — with one
              mapping sheet so marking stays as quick as before.
            </span>
          </div>
          <div>
            <span className="k">Bank</span>
            <span>
              A shared, human-reviewed bank of board papers, NCERT and exemplar material, plus your
              institute&rsquo;s own private questions.
            </span>
          </div>
        </div>
      </section>

      <section className="loginpanel">
        <div className="mark">PaperFlow</div>
        <p className="markcap">Sign in</p>

        <button type="button" className="googlebtn" onClick={() => signIn("acc-desh")}>
          <GoogleMark /> Continue with Google
        </button>
        <p className="loginnote">
          Google is the only way in. Signing in carries no role and no institute — you get access
          when your institute invites you, or when you enter a batch code.
        </p>

        <div className="rulebreak">Demo accounts</div>
        <p className="loginnote" style={{ textAlign: "left", margin: "0 0 12px" }}>
          The real app has no account picker. These exist only so the design can be reviewed
          without a database.
        </p>

        <div className="acctlist">
          {ACCOUNTS.map((a) => {
            const role = a.memberships[0]?.role ?? "none";
            const inst = a.memberships[0]?.instituteId;
            return (
              <button key={a.id} type="button" className="acct" onClick={() => signIn(a.id)}>
                <span className={`av ${role}`}>{a.initials}</span>
                <span>
                  <span className="nm">{a.name}</span>
                  <span className="rl">
                    {ROLE_LABEL[role]}
                    {inst ? ` · ${instituteName(inst)}` : ""}
                    {a.memberships.length > 1 ? ` +${a.memberships.length - 1} more` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="loginnote" style={{ marginTop: 18 }}>
          Every persona lands on the shell its role actually allows. Nothing here is wired to a
          backend.
        </p>
      </section>
    </div>
  );
}
