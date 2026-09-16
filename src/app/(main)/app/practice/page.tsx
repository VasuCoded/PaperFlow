import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getStudentContext, StudentShell } from "../_components/StudentShell";
import { getPracticeSets } from "@/server/data/student";
import { renderRich } from "@/lib/print/math";
import { PracticeItem } from "./PracticeItem";

export const metadata: Metadata = { title: "Practice · PaperFlow" };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });

export default async function PracticePage() {
  const ctx = await getStudentContext("/app/practice");
  const sets = ctx.subjectId ? await getPracticeSets(ctx.session, ctx.subjectId) : [];
  const current = sets[0];

  return (
    <StudentShell ctx={ctx} tab="practice">
      {!current ? (
        <>
          <p className="sec-label">Practice</p>
          <div className="practice idle">
            <h4>No practice set yet</h4>
            <p>
              Log a paper and mark the questions you got wrong — your practice set is built from exactly those
              topics.
            </p>
          </div>
          <Link className="cta" href="/app" style={{ textAlign: "center", textDecoration: "none" }}>
            Go to my tests
          </Link>
        </>
      ) : (
        <>
          <p className="sec-label">Your set · built {dateFmt.format(new Date(current.builtAt))}</p>
          <div className="practice" style={{ marginBottom: 14 }}>
            <h4>
              {current.items.filter((i) => i.done).length} of {current.items.length} done
            </h4>
            <p>Same topics as your mistakes, none of them seen before. Solutions unlock as you go.</p>
            <div className="track" style={{ marginTop: 10 }}>
              <div
                className="fill"
                style={{ width: `${current.items.length ? (current.items.filter((i) => i.done).length / current.items.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {current.items.map((it, i) => (
            <PracticeItem
              key={it.id}
              itemId={it.id}
              questionId={it.questionId}
              number={i + 1}
              bodyHtml={renderRich(it.body)}
              optionsHtml={it.options ? it.options.map((o) => renderRich(o)) : null}
              topic={it.topic}
              difficulty={it.difficulty}
              done={it.done}
            />
          ))}
        </>
      )}

      <p className="sec-label">Where practice does not apply</p>
      <div className="practice idle">
        <h4>No practice set for writing or map sections</h4>
        <p>
          &ldquo;You lost marks on a letter&rdquo; cannot become a useful next letter, so the app does not pretend.
          What you mark there still reaches your teacher.
        </p>
      </div>
    </StudentShell>
  );
}
