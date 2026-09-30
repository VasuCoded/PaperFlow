import type { Metadata } from "next";
import Link from "next/link";
import { GoogleButton } from "./GoogleButton";
import { SignInForm } from "./PasswordForms";
import { getSession } from "@/server/session";
import { SignedInAs } from "../_components/SignedInAs";
import { Logo } from "@/components/brand/Logo";
import { Icon, type IconName } from "@/components/ui/Icon";

export const metadata: Metadata = {
  title: "PaperFlow · Question papers and mistake practice for classes 9 to 12",
  description:
    "Teachers set balanced, board-pattern tests in a minute from a human-reviewed question bank. Students log what they got wrong and practise exactly their weak topics.",
};

const configured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Username + password is the default. Google sign-in stays available behind a
// flag, for when a Google Cloud project has been set up (docs/GO-LIVE.md §3).
const googleEnabled = process.env.NEXT_PUBLIC_ENABLE_GOOGLE_SIGNIN === "1";

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "filePlus", title: "Set", text: "Pick the chapters and a board pattern. A balanced paper with its answer key is ready in about a minute." },
  { icon: "printer", title: "Print", text: "Print up to four shuffled sets. Students write the test on paper and you mark it by hand, as you do today." },
  { icon: "pencil", title: "Log", text: "Back from marking, each student taps the questions they got wrong. It takes under a minute on any phone." },
  { icon: "target", title: "Practise", text: "Their practice set builds itself from those mistakes, on exactly the topics they are weak in." },
];

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: "check", title: "A reviewed question bank", text: "Board papers, NCERT and exemplar questions, each checked by a person before a teacher can use it." },
  { icon: "layers", title: "Sets that stop copying", text: "Up to four orderings of the same paper, with one mapping sheet so marking stays as quick as before." },
  { icon: "clipboard", title: "Board patterns built in", text: "CBSE section layouts, internal choices and case studies, or your own layout saved for next time." },
  { icon: "target", title: "Weak spots, per student", text: "Every logged mistake points at a topic. Students see where they slip, and teachers see it across the batch." },
  { icon: "phone", title: "Made for phones", text: "The student app opens instantly, installs like an app, and keeps working when the connection drops." },
  { icon: "shield", title: "Your institute's data stays yours", text: "Each institute sees only its own people and papers. Export everything, any time." },
];

const ROLES: { icon: IconName; who: string; points: string[] }[] = [
  {
    icon: "idcard",
    who: "Teachers",
    points: ["Set a balanced paper in a minute", "Print sets with answer keys", "See who logged and what the class got wrong", "Flag a question that looks wrong"],
  },
  {
    icon: "user",
    who: "Students",
    points: ["Join with a six-letter batch code", "Tap the questions you got wrong", "Practise your own weak topics", "Check solutions after trying"],
  },
  {
    icon: "building",
    who: "Institutes",
    points: ["Invite teachers and students", "Choose which teacher takes which subject", "Watch logging across every batch", "Export your data whenever you like"],
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const session = await getSession();

  return (
    <div className="lp">
      <header className="lp-nav">
        <Link href="/login" aria-label="PaperFlow home">
          <Logo size={32} />
        </Link>
        <nav className="lp-links" aria-label="On this page">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#roles">Who it&rsquo;s for</a>
        </nav>
        <a className="btn sm lp-navcta" href="#signin">
          Sign in
        </a>
      </header>

      <section className="lp-hero">
        <div className="lp-copy">
          <p className="eyebrow">Question bank · Classes 9 to 12</p>
          <h1>
            Set a balanced test in a minute. <em>Turn every mistake into practice.</em>
          </h1>
          <p className="lp-lede">
            PaperFlow is the question paper and practice app for coaching institutes and schools. The test still
            goes on paper. Everything around it gets easier.
          </p>
          <ul className="lp-ticks">
            <li><Icon name="check" size={17} /> Board-pattern papers with answer keys</li>
            <li><Icon name="check" size={17} /> Up to four shuffled sets per paper</li>
            <li><Icon name="check" size={17} /> Practice built from each student&rsquo;s own mistakes</li>
          </ul>
        </div>

        <div className="lp-panel" id="signin">
          <h2>Sign in</h2>
          <p className="lp-panelsub">Use the username and password you signed up with.</p>

          {error && (
            <div className="notice warn" style={{ marginBottom: 14 }}>
              {error === "exchange"
                ? "Sign-in did not complete. Please try again."
                : "Something went wrong signing you in."}
            </div>
          )}

          {session ? (
            <SignedInAs session={session} />
          ) : configured ? (
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

          <div className="lp-access">
            <Icon name="lock" size={15} />
            <span>
              An account on its own opens nothing. Students join with their teacher&rsquo;s batch code; staff are
              approved by their institute. Nobody picks their own role.
            </span>
          </div>
        </div>
      </section>

      <section className="lp-sec" id="how">
        <p className="eyebrow">How it works</p>
        <h2>Four steps, and only one of them is new.</h2>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="lp-stepn">{i + 1}</span>
              <Icon name={s.icon} size={22} />
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-sec lp-show">
        <div className="lp-sheet" aria-hidden="true">
          <div className="lp-sheethead">
            <b>Class 10 · Science</b>
            <span>Life Processes · 40 marks · Set B</span>
          </div>
          {[
            ["1", "Name the process by which plants make food.", false],
            ["2", "Why do veins have valves?", true],
            ["3", "State two functions of the kidney.", false],
            ["4", "Draw the structure of a nephron.", true],
            ["5", "What is the role of saliva in digestion?", false],
          ].map(([n, q, wrong]) => (
            <div key={n as string} className={`lp-q${wrong ? " wrong" : ""}`}>
              <span className="lp-qbox">{wrong ? "✕" : n}</span>
              <span>{q}</span>
            </div>
          ))}
          <div className="lp-sheetfoot">
            <span>2 wrong · Transportation, Excretion</span>
            <span className="lp-pill">Practice ready</span>
          </div>
        </div>
        <div className="lp-showtext">
          <p className="eyebrow">The practice loop</p>
          <h2>Mistakes become the next thing to practise.</h2>
          <p>
            Logging a paper is a tap per wrong question. PaperFlow knows the topic behind every question, so each
            student gets a short practice set on exactly what they missed, and their weak spots build up over the
            term.
          </p>
          <p>
            Teachers see the same picture for the whole batch: who has logged, and which topics the class keeps
            getting wrong.
          </p>
        </div>
      </section>

      <section className="lp-sec" id="features">
        <p className="eyebrow">Features</p>
        <h2>Everything a test needs, nothing it doesn&rsquo;t.</h2>
        <div className="lp-feats">
          {FEATURES.map((f) => (
            <div key={f.title} className="lp-feat">
              <span className="lp-featic"><Icon name={f.icon} size={20} /></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-sec" id="roles">
        <p className="eyebrow">Who it&rsquo;s for</p>
        <h2>One place for the whole institute.</h2>
        <div className="lp-roles">
          {ROLES.map((r) => (
            <div key={r.who} className="lp-role">
              <h3><Icon name={r.icon} size={20} /> {r.who}</h3>
              <ul>
                {r.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-cta">
        <h2>Ready when you are.</h2>
        <p>Sign in above, or create an account and join your institute with a batch code.</p>
        <div className="btnrow" style={{ justifyContent: "center" }}>
          <a className="btn solid" href="#signin">Sign in</a>
          <Link className="btn" href="/signup">Create an account</Link>
        </div>
      </section>

      <footer className="lp-foot">
        <Logo size={24} />
        <span>Question papers and mistake practice for classes 9 to 12.</span>
        <span>© {new Date().getFullYear()} PaperFlow</span>
      </footer>
    </div>
  );
}
