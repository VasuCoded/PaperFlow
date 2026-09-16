"use client";

import Link from "next/link";
import { Phone, useDemoSubject } from "../_components/Phone";
import { useDemoSession } from "@/demo/session";
import { papersFor, PAPERS } from "@/demo/activity";
import { classSubject, csLabel } from "@/demo/bank";

export default function StudentTestsPage() {
  const { instituteId } = useDemoSession();
  const [subject] = useDemoSubject();
  const cs = classSubject(subject);

  const papers = papersFor(instituteId ?? "", subject);
  // "needs logging" spans EVERY subject, because that is the habit we want
  const unlogged = PAPERS.filter((p) => p.instituteId === instituteId && p.loggedCount === 0);
  const latest = papers[0];
  const earlier = papers.slice(1);

  return (
    <Phone
      eyebrow="Demo · student view"
      title={
        <>
          What a student does <em>after the paper comes back</em>
        </>
      }
      intro="One minute of work. The practice set builds itself from the questions they got wrong."
      aside={
        <>
          <h2>What sits behind each screen</h2>
          <p className="lede">
            The student only ever taps. Everything else is a consequence of the paper having been
            generated inside the app rather than in a word processor.
          </p>
          <div className="note">
            <h5>Open the test</h5>
            <p>
              The paper the teacher generated is already here. Read from{" "}
              <code>papers</code> and <code>paper_questions</code>, filtered to this
              student&rsquo;s batch — and to this institute.
            </p>
          </div>
          <div className="note">
            <h5>Which set did you write?</h5>
            <p>
              Asked before anything else on a multi-set paper, with no default and no skip. If the
              app thinks they wrote Set A and they wrote Set C, every tap maps to the wrong
              question and the weak-spot map is quietly poisoned.
            </p>
          </div>
          <div className="note">
            <h5>Tap what was wrong</h5>
            <p>
              One tap per wrong question. Writes one <code>attempt_items</code> row each with{" "}
              <code>is_correct = false</code>. This is the only data entry anyone does — and no
              score is ever shown.
            </p>
          </div>
          <div className="note">
            <h5>Practice builds itself</h5>
            <p>
              On save, the matcher reads the topic and difficulty of every wrong question and pulls
              unseen questions with the same tags, from the shared bank plus this
              institute&rsquo;s own.
            </p>
          </div>
        </>
      }
    >
      {unlogged.length > 0 && (
        <>
          <p className="sec-label">Needs logging</p>
          <div className="needstrip">
            <h4>● {unlogged.length} paper waiting</h4>
            <p>
              {unlogged.map((u) => `${u.title} · ${csLabel(u.classSubjectId)}`).join(", ")}. Logging
              takes under a minute and it is what makes the practice set worth anything.
            </p>
          </div>
        </>
      )}

      <p className="sec-label">Latest test · {cs?.subjectName}</p>
      {latest ? (
        <div className="testcard">
          <h3>{latest.title}</h3>
          <div className="meta">
            {latest.chapters.join(" · ").toUpperCase()} · {latest.totalMarks} MARKS ·{" "}
            {latest.date.toUpperCase()}
            {latest.setCount > 1 ? ` · ${latest.setCount} SETS` : ""}
          </div>
          <p className="prompt">
            Tap the questions you got <span className="hl">wrong</span>. That is all you need to do.
          </p>
          <Link className="cta" href={`/demo/app/log/${latest.id}`} style={{ textAlign: "center", textDecoration: "none" }}>
            {latest.loggedCount > 0 ? "Review what I logged" : "Start logging"}
          </Link>
        </div>
      ) : (
        <div className="practice idle">
          <h4>No tests yet in {cs?.subjectName}</h4>
          <p>Papers your teacher generates for your batch appear here.</p>
        </div>
      )}

      <p className="sec-label">Earlier tests</p>
      {earlier.map((p) => (
        <div className="testcard quiet" key={p.id} style={{ marginBottom: 8 }}>
          <h3 style={{ fontSize: 16 }}>{p.title}</h3>
          <div className="meta">
            {p.loggedCount > 0 ? "LOGGED" : "NOT LOGGED"} · {p.date.toUpperCase()} ·{" "}
            {p.totalMarks} MARKS
          </div>
        </div>
      ))}
      {earlier.length === 0 && (
        <p style={{ fontSize: 12.5, color: "var(--graphite)" }}>Nothing earlier in this subject.</p>
      )}
    </Phone>
  );
}
