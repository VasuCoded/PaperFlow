import type { Metadata } from "next";
import { GoogleButton } from "./GoogleButton";

export const metadata: Metadata = { title: "Sign in · PaperFlow" };

const configured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

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
          <GoogleButton next={next} />
        ) : (
          <div className="notice warn" style={{ marginBottom: 0 }}>
            <b>Not configured yet.</b> Set <span className="mono">NEXT_PUBLIC_SUPABASE_URL</span>{" "}
            and <span className="mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>, and enable Google in
            Supabase Auth. See <span className="mono">docs/SETUP.md</span>.
          </div>
        )}

        <p className="loginnote">
          Google is the only way in. Signing in carries no role and no institute — you get access
          when your institute invites you, or when you enter a batch code.
        </p>

        <div className="rulebreak">No account picker</div>
        <p className="loginnote" style={{ textAlign: "left", margin: 0 }}>
          There is deliberately no signup form, no role dropdown and no way to create an institute
          here. Roles come from an invitation matched to your verified email, or from a batch join
          code. It is the single control that keeps a wrong answer key away from a parent.
        </p>
      </section>
    </div>
  );
}
