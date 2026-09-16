"use client";

import { useState, useTransition } from "react";
import { revealSolution, setPracticeItemDone, type SolutionResult } from "@/server/actions/student";

export function PracticeItem({
  itemId,
  questionId,
  number,
  bodyHtml,
  optionsHtml,
  topic,
  difficulty,
  done: initialDone,
}: {
  itemId: string;
  questionId: string;
  number: number;
  bodyHtml: string;
  optionsHtml: string[] | null;
  topic: string | null;
  difficulty: string;
  done: boolean;
}) {
  const [done, setDone] = useState(initialDone);
  const [solution, setSolution] = useState<SolutionResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="testcard quiet" style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <button
          type="button"
          className="qbox"
          aria-pressed={done}
          aria-label={done ? `Question ${number} done — tap to undo` : `Mark question ${number} done`}
          style={{ borderColor: done ? "var(--ledger)" : "var(--graphite)", color: done ? "var(--ledger)" : "var(--graphite)" }}
          onClick={() => {
            const next = !done;
            setDone(next);
            start(async () => {
              const res = await setPracticeItemDone(itemId, next);
              if (!res.ok) setDone(!next);
            });
          }}
        >
          {done ? "✓" : number}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.45 }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          {optionsHtml && (
            <div style={{ display: "grid", gap: 4, marginTop: 6, fontSize: 13 }}>
              {optionsHtml.map((o, i) => (
                <div key={i} dangerouslySetInnerHTML={{ __html: o }} />
              ))}
            </div>
          )}
          <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, color: "var(--graphite)", marginTop: 5, letterSpacing: "0.04em" }}>
            {(topic ?? "").toUpperCase()}{topic ? " · " : ""}{difficulty.toUpperCase()}
          </span>

          {solution?.ok ? (
            <div className="notice" style={{ marginTop: 8, marginBottom: 0, fontSize: 12.5 }}>
              {solution.correctHtml && (
                <div><b>Answer:</b> <span dangerouslySetInnerHTML={{ __html: solution.correctHtml }} /></div>
              )}
              {!solution.correctHtml && solution.answerHtml && (
                <div><b>Answer:</b> <span dangerouslySetInnerHTML={{ __html: solution.answerHtml }} /></div>
              )}
              {solution.solutionHtml && (
                <div style={{ marginTop: 6 }} dangerouslySetInnerHTML={{ __html: solution.solutionHtml }} />
              )}
              {solution.rubricHtml && (
                <div style={{ marginTop: 6 }}>
                  <b>What earns marks:</b> <span dangerouslySetInnerHTML={{ __html: solution.rubricHtml }} />
                </div>
              )}
              {!solution.correctHtml && !solution.answerHtml && !solution.solutionHtml && !solution.rubricHtml && (
                <div>No worked solution is stored for this one yet.</div>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                className="btn sm ghost"
                style={{ marginTop: 8 }}
                disabled={pending}
                onClick={() => start(async () => setSolution(await revealSolution(questionId)))}
              >
                {pending ? "Loading…" : "Show solution"}
              </button>
              {solution && !solution.ok && (
                <p style={{ fontSize: 11.5, color: "var(--pen)", margin: "6px 0 0" }}>{solution.message}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
