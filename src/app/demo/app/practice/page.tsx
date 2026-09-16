"use client";

import { useState } from "react";
import { Phone, useDemoSubject } from "../../_components/Phone";
import { PRACTICE_ITEMS } from "@/demo/activity";
import { classSubject } from "@/demo/bank";

export default function PracticePage() {
  const [subject] = useDemoSubject();
  const cs = classSubject(subject);
  const [items, setItems] = useState(PRACTICE_ITEMS);
  const [revealed, setRevealed] = useState<number[]>([]);

  const done = items.filter((i) => i.done).length;

  return (
    <Phone
      eyebrow="Demo · student view"
      title={<>Practice, <em>built from their own mistakes</em></>}
      intro="Same topics, difficulty within one band, nothing they have already been served. No spaced repetition — that is a later phase, deliberately."
      aside={
        <>
          <h2>Where the loop does not apply</h2>
          <p className="lede">
            The practice loop is the differentiator, and it does not transfer evenly. Saying so in
            the product is better than pretending.
          </p>
          <div className="note">
            <h5>Strong</h5>
            <p>
              PCMB objective, short answer and numerical questions. Social Science factual and
              source-based. Wrong on a topic, get more of that topic — exactly as pitched.
            </p>
          </div>
          <div className="note">
            <h5>Moderate</h5>
            <p>
              English and Hindi grammar. Matching on a grammar topic works; matching on
              &ldquo;comprehension&rdquo; does not, because the skill is not the passage.
            </p>
          </div>
          <div className="note">
            <h5>Does not apply</h5>
            <p>
              Writing tasks, maps and diagram-marking. &ldquo;You lost marks on a letter&rdquo;
              cannot generate a useful next letter. Those sections are still tappable so the
              teacher&rsquo;s data is complete, but the app says{" "}
              <b>&ldquo;no practice set for the writing section&rdquo;</b> rather than serving three
              random essay prompts.
            </p>
          </div>
        </>
      }
    >
      <p className="sec-label">Your set · {cs?.subjectName}</p>
      <div className="practice" style={{ marginBottom: 14 }}>
        <h4>
          {done} of {items.length} done
        </h4>
        <p>Built after Unit Test 5. Solutions unlock as you go.</p>
        <div className="track" style={{ marginTop: 10 }}>
          <div className="fill" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
      </div>

      {items.map((it, idx) => (
        <div className="testcard quiet" key={idx} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <button
              className="qbox"
              style={{
                borderColor: it.done ? "var(--ledger)" : "var(--graphite)",
                color: it.done ? "var(--ledger)" : "var(--graphite)",
              }}
              aria-label={it.done ? "Mark not done" : "Mark done"}
              onClick={() =>
                setItems((s) => s.map((x, i) => (i === idx ? { ...x, done: !x.done } : x)))
              }
            >
              {it.done ? "✓" : idx + 1}
            </button>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.42 }}>{it.body}</p>
              <span className="topic" style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, color: "var(--graphite)", marginTop: 4, letterSpacing: "0.04em" }}>
                {it.topic.toUpperCase()} · {it.difficulty.toUpperCase()}
              </span>
              {revealed.includes(idx) ? (
                <div className="notice" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
                  <b>Solution unlocked.</b> In the real app this comes from a server route that
                  checks the attempt gate — the answer columns are not readable by the client at all.
                </div>
              ) : (
                <button
                  className="btn sm ghost"
                  style={{ marginTop: 8 }}
                  onClick={() => setRevealed((r) => [...r, idx])}
                >
                  Show solution
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      <p className="sec-label">Writing section</p>
      <div className="practice idle">
        <h4>No practice set for the writing section</h4>
        <p>
          You lost marks on a long-answer prompt. Practice on that is not something the app can
          generate usefully, so it will not pretend to — ask your teacher for a model answer.
        </p>
      </div>
    </Phone>
  );
}
