"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSelfPractice } from "@/server/actions/student";

const COUNTS = [5, 10, 15, 20] as const;
const LEVELS = [
  ["mixed", "Mixed"],
  ["easy", "Easy"],
  ["medium", "Medium"],
  ["hard", "Hard"],
] as const;

/**
 * Make a practice set of your own: which chapters (or all), how many questions,
 * how hard, and whether to start with the topics you get wrong. Questions you
 * have not seen come first.
 */
export function SelfPractice({ classSubjectId, chapters, startOpen }: { classSubjectId: string; chapters: { id: string; name: string }[]; startOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [picked, setPicked] = useState<string[]>([]);
  const [count, setCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<(typeof LEVELS)[number][0]>("mixed");
  const [weakFirst, setWeakFirst] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" className="cta quiet" onClick={() => setOpen(true)}>
        + Make your own practice set
      </button>
    );
  }

  return (
    <div className="selfpractice">
      <h4>Make your own practice set</h4>

      <p className="sp-label">Chapters <span>{picked.length === 0 ? "· all of them" : `· ${picked.length} chosen`}</span></p>
      <div className="chipset">
        {chapters.map((c) => {
          const on = picked.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className={`chapchip${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => setPicked((cur) => (cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id]))}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      <p className="sp-label">How many questions</p>
      <div className="seg sp-seg" role="group" aria-label="How many questions">
        {COUNTS.map((n) => (
          <button key={n} type="button" className={count === n ? "on" : ""} onClick={() => setCount(n)}>{n}</button>
        ))}
      </div>

      <p className="sp-label">How hard</p>
      <div className="seg sp-seg" role="group" aria-label="How hard">
        {LEVELS.map(([k, label]) => (
          <button key={k} type="button" className={difficulty === k ? "on" : ""} onClick={() => setDifficulty(k)}>{label}</button>
        ))}
      </div>

      <label className="toggle sp-toggle">
        <input type="checkbox" checked={weakFirst} onChange={(e) => setWeakFirst(e.target.checked)} />
        Start with the topics I get wrong
      </label>

      {error && <div className="m-banner offline">{error}</div>}
      <button
        type="button"
        className="cta"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await createSelfPractice({ classSubjectId, chapterIds: picked, count, difficulty, weakFirst });
            if (res.ok) {
              setOpen(false);
              router.push(`/app/practice?set=${res.setId}`);
            } else setError(res.message);
          })
        }
      >
        {pending ? "Building your set…" : `Build a ${count}-question set`}
      </button>
    </div>
  );
}
