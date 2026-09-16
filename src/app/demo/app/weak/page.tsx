"use client";

import { Phone, useDemoSubject } from "../../_components/Phone";
import { WEAK_TOPICS } from "@/demo/activity";
import { classSubject } from "@/demo/bank";

export default function WeakSpotsPage() {
  const [subject] = useDemoSubject();
  const cs = classSubject(subject);
  const topics = WEAK_TOPICS[subject] ?? [];

  return (
    <Phone
      eyebrow="Demo · student view"
      title={<>Weak spots, <em>accumulated not guessed</em></>}
      intro="A rolling per-topic accuracy, recalculated after every test. Three tests in, the picture is real — and it is what replaces guesswork before boards."
    >
      <p className="sec-label">Where you are weak · {cs?.subjectName}</p>
      <div className="bars">
        {topics.map((t) => {
          const pct = Math.round((t.correct / t.total) * 100);
          const cls = pct < 50 ? "fill low" : pct < 75 ? "fill mid" : "fill";
          return (
            <div className="bar" key={t.topic}>
              <div className="row">
                <span>{t.topic}</span>
                <b>
                  {t.correct} / {t.total}
                </b>
              </div>
              <div className="track">
                <div className={cls} style={{ width: `${pct}%` }} />
              </div>
              {t.note && <div className="note">{t.note}</div>}
            </div>
          );
        })}
      </div>

      <p className="sec-label">Not tracked here</p>
      <div className="practice idle">
        <h4>Writing and map sections</h4>
        <p>
          Those sections are excluded from this map because a per-topic accuracy on
          &ldquo;writing&rdquo; would not mean anything. Your taps on them still reach your teacher,
          so their picture of the class stays complete.
        </p>
      </div>

      <p className="sec-label">What this is not</p>
      <div className="testcard quiet">
        <h3 style={{ fontSize: 15 }}>No score, no percentage, no rank</h3>
        <div className="meta" style={{ marginTop: 6 }}>
          RIGHT OR WRONG PER QUESTION, NEVER A MARK
        </div>
        <p style={{ fontSize: 12.5, color: "var(--graphite)", margin: "10px 0 0" }}>
          The app deliberately never computes a score. Marking stays with the teacher, on paper.
        </p>
      </div>
    </Phone>
  );
}
