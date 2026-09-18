"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { logPaper, type LogResult } from "@/server/actions/student";

export interface FlowQuestion {
  html: string;
  partLabel: string | null;
  topic: string | null;
  difficulty: string;
}
export interface FlowPosition {
  position: number;
  number: number;
  marks: number;
  practiceEligible: boolean;
  sectionLabel: string;
  stimulusHtml: string | null;
  questions: FlowQuestion[];
}
export interface FlowSet {
  id: string;
  label: string;
  firstQuestion: string;
  positions: FlowPosition[];
}

/**
 * The student's whole job, and the place a single mistake silently poisons a
 * term of data. BUILD-PLAN 3.4:
 *  - multi-set paper: "Which set did you write?" first, no default, no skip
 *  - then confirm with the first twelve words of question 1 for that set
 *  - single-set papers skip both
 * Taps are display positions; the server resolves them to questions through the
 * chosen set. No score or percentage is ever shown.
 */
export function LogFlow({
  paperId,
  title,
  totalMarks,
  sets,
  existing,
}: {
  paperId: string;
  title: string;
  totalMarks: number;
  sets: FlowSet[];
  existing: { setId: string | null; wrongPositions: number[] } | null;
}) {
  const multi = sets.length > 1;
  const existingSet = existing?.setId ? sets.find((s) => s.id === existing.setId) : undefined;

  const [step, setStep] = useState<"pick" | "confirm" | "log">(!multi || existingSet ? "log" : "pick");
  const [setId, setSetId] = useState<string | null>(existingSet?.id ?? (multi ? null : sets[0]!.id));
  const [wrong, setWrong] = useState<Set<number>>(new Set(existing?.wrongPositions ?? []));
  const [result, setResult] = useState<LogResult | null>(null);
  const [pending, start] = useTransition();

  const chosen = sets.find((s) => s.id === setId) ?? null;

  if (step === "pick") {
    return (
      <div className="setpick" style={{ padding: "8px 0" }}>
        <h3>Which set did you write?</h3>
        <p>
          {title} was printed in {sets.length} sets. The letter is at the top of your question paper and in
          every footer.
        </p>
        <div className="setgrid" style={{ gridTemplateColumns: `repeat(${Math.min(sets.length, 4)}, 1fr)` }}>
          {sets.map((s) => (
            <button key={s.id} type="button" className={`setbtn${setId === s.id ? " on" : ""}`} onClick={() => setSetId(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <button type="button" className="cta" style={{ marginTop: 20 }} disabled={!setId} onClick={() => setStep("confirm")}>
          {chosen ? `Continue with Set ${chosen.label}` : "Pick your set to continue"}
        </button>
        <p style={{ fontSize: 12, color: "var(--graphite)", marginTop: 12 }}>
          Nothing is picked for you on purpose. The wrong set would match every tap to the wrong question.
        </p>
      </div>
    );
  }

  if (step === "confirm" && chosen) {
    return (
      <div className="setpick" style={{ padding: "8px 0" }}>
        <h3>Is this question 1 on your sheet?</h3>
        <p>You said you wrote <b>Set {chosen.label}</b>.</p>
        <div className="confirmq">
          <span className="cap">QUESTION 1 · SET {chosen.label}</span>
          <p className="qq">&ldquo;{chosen.firstQuestion}&rdquo;</p>
        </div>
        <button type="button" className="cta" style={{ marginTop: 18 }} onClick={() => setStep("log")}>
          Yes, that&rsquo;s my question 1
        </button>
        <button type="button" className="cta quiet" style={{ marginTop: 8 }} onClick={() => { setSetId(null); setStep("pick"); }}>
          No — let me pick again
        </button>
      </div>
    );
  }

  if (!chosen) return null;

  const eligibleWrongTopics = new Set<string>();
  for (const p of chosen.positions) {
    if (wrong.has(p.position) && p.practiceEligible) {
      for (const q of p.questions) if (q.topic) eligibleWrongTopics.add(q.topic);
    }
  }
  const ineligibleSections = [...new Set(chosen.positions.filter((p) => !p.practiceEligible).map((p) => p.sectionLabel))];

  return (
    <>
      <div className="testcard">
        <h3>{title}</h3>
        <div className="meta">
          {totalMarks} MARKS{multi ? ` · SET ${chosen.label}` : ""}
          {multi && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => { setSetId(null); setStep("pick"); setResult(null); }}
                style={{ background: "none", border: 0, padding: 0, font: "inherit", color: "var(--pen)", textDecoration: "underline", cursor: "pointer" }}
              >
                WRONG SET?
              </button>
            </>
          )}
        </div>
        <p className="prompt">
          Tap the questions you got <span className="hl">wrong</span>. That is all you need to do.
        </p>

        <ul className="qlist">
          {chosen.positions.map((p, i) => {
            const isWrong = wrong.has(p.position);
            const newSection = i === 0 || chosen.positions[i - 1]!.sectionLabel !== p.sectionLabel;
            return (
              <li key={p.position} style={{ listStyle: "none" }}>
                {newSection && p.sectionLabel && (
                  <p className="sec-label" style={{ margin: "14px 0 4px" }}>
                    Section {p.sectionLabel}
                    {!p.practiceEligible ? " · no practice set for this section" : ""}
                  </p>
                )}
                {p.stimulusHtml && (
                  <div className="stimulus" dangerouslySetInnerHTML={{ __html: p.stimulusHtml }} />
                )}
                <div className={`qrow${isWrong ? " wrong" : ""}`}>
                  <svg className="scrawl" viewBox="0 0 34 34" aria-hidden="true">
                    <path d="M11 5 Q31 5 32 18 Q33 31 17 31 Q3 31 4 18 Q5 6 19 4.5 Q26 4.2 30 7" />
                  </svg>
                  <button
                    type="button"
                    className="qbox"
                    aria-pressed={isWrong}
                    aria-label={`Question ${p.number}: ${isWrong ? "marked wrong, tap to undo" : "tap if you got it wrong"}`}
                    onClick={() => {
                      const next = new Set(wrong);
                      if (next.has(p.position)) next.delete(p.position);
                      else next.add(p.position);
                      setWrong(next);
                      setResult(null);
                    }}
                  >
                    {p.number}
                  </button>
                  <span className="qtext">
                    {p.questions.map((q, qi) => (
                      <span key={qi} style={{ display: "block", marginBottom: qi < p.questions.length - 1 ? 4 : 0 }}>
                        {p.questions.length > 1 && (
                          <span style={{ fontFamily: "var(--mono)", fontSize: 11, marginRight: 4 }}>
                            {q.partLabel ?? `(${String.fromCharCode(97 + qi)})`}
                          </span>
                        )}
                        <span dangerouslySetInnerHTML={{ __html: q.html }} />
                      </span>
                    ))}
                    <span className="topic">
                      {(p.questions[0]?.topic ?? "").toUpperCase()}
                      {p.questions[0]?.topic ? " · " : ""}
                      {(p.questions[0]?.difficulty ?? "").toUpperCase()}
                    </span>
                  </span>
                  <span className="qmarks">{p.marks}m</span>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="tally">
          <span>{wrong.size === 0 ? "Nothing marked yet" : `${wrong.size} marked wrong`}</span>
        </div>
        <button
          type="button"
          className="cta"
          disabled={pending}
          onClick={() =>
            start(async () => {
              // Logging needs a connection; say so plainly instead of failing
              // into a queue the student never hears about (C9 item 8).
              const offlineMessage =
                "You’re offline. Logging needs a connection — nothing was saved. Your marks are still here; save again when you’re back online.";
              if (typeof navigator !== "undefined" && !navigator.onLine) {
                setResult({ ok: false, message: offlineMessage });
                return;
              }
              try {
                setResult(await logPaper(paperId, multi ? chosen.id : null, [...wrong]));
              } catch {
                setResult({ ok: false, message: offlineMessage });
              }
            })
          }
        >
          {pending ? "Saving…" : existing ? "Save changes and rebuild my practice" : "Save and build my practice set"}
        </button>
        {wrong.size === 0 && (
          <p style={{ fontSize: 11.5, color: "var(--graphite)", margin: "8px 0 0" }}>
            Got everything right? Save anyway, so your teacher knows you logged it.
          </p>
        )}
      </div>

      {result && !result.ok && (
        <div className="m-banner offline" role="alert" style={{ marginTop: 12 }}>{result.message}</div>
      )}

      <p className="sec-label">Practice waiting for you</p>
      {result?.ok && result.practice.built ? (
        <div className="practice">
          <h4>{result.practice.count} questions picked for you</h4>
          <p>Same topics, difficulty within one band, none of them seen before.</p>
          <div className="chips">
            {result.practice.topics.map((t) => <span className="chip" key={t}>{t}</span>)}
            <span className="chip dim">ADDED TO WEAK SPOTS</span>
          </div>
          {result.practice.gaps > 0 && (
            <p style={{ marginTop: 10, fontSize: 11.5 }}>
              Some topics had nothing new at your level, so we widened to the chapter.
            </p>
          )}
          <Link className="cta" href="/app/practice" style={{ textAlign: "center", textDecoration: "none", marginTop: 10 }}>
            Start practising
          </Link>
        </div>
      ) : result?.ok && !result.practice.built ? (
        <div className="practice idle">
          <h4>Saved</h4>
          <p>{result.practice.reason}</p>
        </div>
      ) : (
        <div className="practice idle">
          <h4>{wrong.size === 0 ? "Mark a few questions first" : "Save to build your set"}</h4>
          <p>
            {eligibleWrongTopics.size > 0
              ? `Practice will come from: ${[...eligibleWrongTopics].slice(0, 4).join(", ")}.`
              : "Once you save, the app pulls fresh questions on exactly those topics."}
          </p>
          {ineligibleSections.length > 0 && (
            <p style={{ marginTop: 6, fontSize: 11.5 }}>
              No practice set for section{ineligibleSections.length === 1 ? "" : "s"} {ineligibleSections.join(", ")} — your
              teacher still sees what you marked there.
            </p>
          )}
        </div>
      )}
    </>
  );
}
