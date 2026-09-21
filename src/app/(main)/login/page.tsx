import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GoogleButton } from "./GoogleButton";
import { SignInForm } from "./PasswordForms";
import { getSession, homePath } from "@/server/session";

export const metadata: Metadata = { title: "Sign in · PaperFlow" };

const configured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Username + password is the default. Google sign-in stays available behind a
// flag, for when a Google Cloud project has been set up (docs/GO-LIVE.md §3).
const googleEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN === "1";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const session = await getSession();
  if (session) redirect(homePath(session));

  return (
    <div className="loginpage">
      <section className="loginhero">
        <p className="eyebrow">Question bank · classes 9 to 12</p>
        <h1>
          The paper still goes on paper. <em>Everything around it gets easier.</em>
        </h1>
        <p>
          A teacher sets a balanced test in a minute instead of an evening. Students tap the
          questions they got wrong. The practice set builds itself from that, on exactly the topics
          they are weak in.
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

        {error && (
          <div className="notice warn" style={{ marginBottom: 14 }}>
            {error === "exchange"
              ? "Sign-in did not complete. Please try again."
              : "Something went wrong signing you in."}
          </div>
        )}

        {configured ? (
          <>
            <SignInForm next={next} />
            {googleEnabled && (
              <>
                <div className="rulebreak">or</div>
                <GoogleButton next={next} />
              </>
            )}
          </>
        ) : (
          <div className="notice warn" style={{ marginBottom: 0 }}>
            <b>Not configured yet.</b> Set <span className="mono">NEXT_PUBLIC_SUPABASE_URL</span>{" "}
            and <span className="mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>. See{" "}
            <span className="mono">docs/GO-LIVE.md</span>.
          </div>
        )}

        <div className="rulebreak">How access works</div>
        <p className="loginnote" style={{ textAlign: "left", margin: 0 }}>
          An account on its own opens nothing. Students join with the batch code their teacher gives
          them. Teachers and staff ask their institute for access, and the institute approves them —
          you never choose your own role. That is what keeps a wrong answer key away from a parent.
        </p>
      </section>
    </div>
  );
}
