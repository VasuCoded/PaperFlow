import type { Metadata } from "next";
import { getStudentContext, StudentShell } from "../_components/StudentShell";
import { getWeakSpots } from "@/server/data/student";

export const metadata: Metadata = { title: "Weak spots · PaperFlow" };

export default async function WeakSpotsPage() {
  const ctx = await getStudentContext("/app/weak");
  const { topics, excludedSections } = ctx.subjectId
    ? await getWeakSpots(ctx.session, ctx.subjectId)
    : { topics: [], excludedSections: 0 };
  const subjectName = ctx.subject?.label.replace(/^Class \S+ · /, "") ?? "";

  return (
    <StudentShell ctx={ctx} tab="weak">
      <p className="sec-label">Where you are weak · {subjectName}</p>

      {topics.length === 0 ? (
        <div className="practice idle">
          <h4>Nothing to show yet</h4>
          <p>Log a couple of papers and this fills in. After about three tests the picture is real.</p>
        </div>
      ) : (
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
                <div
                  className="track"
                  role="progressbar"
                  aria-label={`${t.topic}: ${t.correct} of ${t.total} right`}
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className={cls} style={{ width: `${pct}%` }} />
                </div>
                {t.streak >= 2 && (
                  <div className="note">
                    Wrong in the last {t.streak} time{t.streak === 1 ? "" : "s"} it came up.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {excludedSections > 0 && (
        <>
          <p className="sec-label">Not tracked here</p>
          <div className="practice idle">
            <h4>Writing and map questions</h4>
            <p>
              They are left out of this map on purpose — a per-topic score on writing would not mean anything.
              Your teacher still sees what you marked.
            </p>
          </div>
        </>
      )}

      <p className="sec-label">What this is not</p>
      <div className="testcard quiet">
        <h3 style={{ fontSize: 15 }}>No score, no percentage, no rank</h3>
        <p style={{ fontSize: 12.5, color: "var(--graphite)", margin: "8px 0 0" }}>
          The app only ever records right or wrong per question. Marking stays with your teacher, on paper.
        </p>
      </div>
    </StudentShell>
  );
}
