"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Phone } from "../../../_components/Phone";
import { PAPERS, STUDENT_PAPER_QUESTIONS } from "@/demo/activity";
import { BIOLOGY_BANK } from "@/demo/bank";
import { buildSets } from "@/server/sets";
import { buildPracticeSet, type Candidate, type WrongItem } from "@/server/practice";
import type { Difficulty } from "@/server/generator/types";

const DIFF: Record<string, Difficulty> = { Easy: "easy", Medium: "medium", Hard: "hard" };

export default function LogPage() {
  const params = useParams<{ id: string }>();
  const paper = PAPERS.find((p) => p.id === params.id) ?? PAPERS[0]!;
  const multi = paper.setCount > 1;

  const [step, setStep] = useState<"pick" | "confirm" | "log">(multi ? "pick" : "log");
  const [chosenSet, setChosenSet] = useState<string | null>(null);
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [saved, setSaved] = useState(false);

  // Real shuffle engine: derive each set's display order from the same paper.
  const sets = useMemo(() => {
    const shufflePaper = {
      sections: [
        {
          label: "A",
          blocks: STUDENT_PAPER_QUESTIONS.map((q) => ({
            key: `q${q.n}`,
            marks: q.marks,
            positionLocked: false,
            questions: [{ key: `q${q.n}`, optionsShufflable: false, optionKeys: null }],
          })),
        },
      ],
    };
    return buildSets(shufflePaper, Math.max(paper.setCount, 1), 40, 424242);
  }, [paper.setCount]);

  const setLabels = sets.sets.map((s) => s.setLabel);

  /** Questions in the display order of the chosen set. */
  const ordered = useMemo(() => {
    const label = chosenSet ?? setLabels[0];
    const set = sets.sets.find((s) => s.setLabel === label) ?? sets.sets[0]!;
    const byPos = [...set.items].sort((a, b) => a.displayPosition - b.displayPosition);
    return byPos.map((it, i) => {
      const n = Number(it.blockKey.replace("q", ""));
      const q = STUDENT_PAPER_QUESTIONS.find((x) => x.n === n)!;
      return { ...q, printedNumber: i + 1 };
    });
  }, [chosenSet, sets, setLabels]);

  const firstTwelve = useMemo(() => {
    const body = ordered[0]?.body ?? "";
    const words = body.split(/\s+/);
    const head = words.slice(0, 12).join(" ");
    if (words.length <= 12) return head;
    // the source text may already end in an ellipsis — don't double it
    return /[….]$/.test(head) ? head : `${head}…`;
  }, [ordered]);

  // Real practice matcher over the demo bank
  const practice = useMemo(() => {
    if (!saved || wrong.size === 0) return null;
    const wrongItems: WrongItem[] = ordered
      .filter((q) => wrong.has(q.printedNumber))
      .map((q) => {
        const src = BIOLOGY_BANK.find((b) => b.topicName === q.topic);
        return {
          questionId: `q${q.n}`,
          topicId: q.topic,
          chapterId: src?.chapterId ?? "bio-inh",
          strandId: null,
          difficulty: DIFF[q.difficulty] ?? "medium",
          practiceEligible: true,
        };
      });
    const candidates: Candidate[] = BIOLOGY_BANK.map((b) => ({
      id: b.id,
      ownerInstituteId: b.ownerInstituteId,
      topicId: b.topicName,
      chapterId: b.chapterId,
      strandId: null,
      difficulty: b.difficulty,
      hasSolution: true,
      stimulusId: b.stimulusId ?? null,
    }));
    return buildPracticeSet({ wrongItems, candidates, exposedQuestionIds: new Set() });
  }, [saved, wrong, ordered]);

  const wrongTopics = Array.from(
    new Set(ordered.filter((q) => wrong.has(q.printedNumber)).map((q) => q.topic)),
  );

  // ---------------- set picker ----------------
  if (step === "pick") {
    return (
      <Phone
        eyebrow="Demo · student view"
        title={<>First: <em>which set did you write?</em></>}
        intro="Asked before anything else, with no default and no way to skip. This one screen is what stops a whole term of weak-spot data being quietly wrong."
        showChrome={false}
      >
        <div className="setpick">
          <h3>Which set did you write?</h3>
          <p>
            {paper.title} · {paper.setCount} sets were printed. The letter is at the top of your
            question paper and in every footer.
          </p>
          <div className="setgrid">
            {setLabels.map((l) => (
              <button
                key={l}
                className={`setbtn${chosenSet === l ? " on" : ""}`}
                onClick={() => setChosenSet(l)}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            className="cta"
            style={{ marginTop: 20 }}
            disabled={!chosenSet}
            onClick={() => setStep("confirm")}
          >
            {chosenSet ? `Continue with Set ${chosenSet}` : "Pick a set to continue"}
          </button>
          <p style={{ fontSize: 11.5, color: "var(--graphite)", marginTop: 12 }}>
            No default is pre-selected on purpose. A wrong guess here maps every tap to the wrong
            question.
          </p>
        </div>
      </Phone>
    );
  }

  // ---------------- confirmation ----------------
  if (step === "confirm") {
    return (
      <Phone
        eyebrow="Demo · student view"
        title={<>Then: <em>one-tap confirmation</em></>}
        intro="The first twelve words of question 1 for the set they chose. If it does not match the sheet in their hand, they go back — before any data is written."
        showChrome={false}
      >
        <div className="setpick">
          <h3>Is this question 1 on your sheet?</h3>
          <p>You said you wrote <b>Set {chosenSet}</b>.</p>
          <div className="confirmq">
            <span className="cap">QUESTION 1 · SET {chosenSet}</span>
            <p className="qq">&ldquo;{firstTwelve}&rdquo;</p>
          </div>
          <button className="cta" style={{ marginTop: 18 }} onClick={() => setStep("log")}>
            Yes, that&rsquo;s my question 1
          </button>
          <button
            className="cta quiet"
            style={{ marginTop: 8 }}
            onClick={() => {
              setChosenSet(null);
              setStep("pick");
            }}
          >
            No — let me pick again
          </button>
        </div>
      </Phone>
    );
  }

  // ---------------- logging ----------------
  return (
    <Phone
      eyebrow="Demo · student view"
      title={<>Tap what was <em>wrong</em></>}
      intro={
        multi
          ? `Questions are shown in Set ${chosenSet}'s printed order, so the numbers match the sheet in their hand.`
          : "One tap per wrong question. No score is ever shown — only right or wrong per question."
      }
    >
      <p className="sec-label">
        {paper.title}
        {multi ? ` · Set ${chosenSet}` : ""}
      </p>
      <div className="testcard">
        <h3>{paper.title}</h3>
        <div className="meta">
          {paper.chapters.join(" · ").toUpperCase()} · {paper.totalMarks} MARKS ·{" "}
          {paper.date.toUpperCase()}
        </div>
        <p className="prompt">
          Tap the questions you got <span className="hl">wrong</span>. That is all you need to do.
        </p>

        <ul className="qlist">
          {ordered.map((q) => {
            const isWrong = wrong.has(q.printedNumber);
            return (
              <li className={`qrow${isWrong ? " wrong" : ""}`} key={q.printedNumber}>
                <svg className="scrawl" viewBox="0 0 34 34" aria-hidden="true">
                  <path d="M11 5 Q31 5 32 18 Q33 31 17 31 Q3 31 4 18 Q5 6 19 4.5 Q26 4.2 30 7" />
                </svg>
                <button
                  className="qbox"
                  aria-label={`Mark question ${q.printedNumber} wrong`}
                  onClick={() => {
                    const next = new Set(wrong);
                    if (next.has(q.printedNumber)) next.delete(q.printedNumber);
                    else next.add(q.printedNumber);
                    setWrong(next);
                    setSaved(false);
                  }}
                >
                  {q.printedNumber}
                </button>
                <span className="qtext">
                  {q.body}
                  <span className="topic">
                    {q.topic.toUpperCase()} · {q.difficulty.toUpperCase()}
                  </span>
                </span>
                <span className="qmarks">{q.marks}m</span>
              </li>
            );
          })}
        </ul>

        <div className="tally">
          <span>{wrong.size === 0 ? "Nothing marked yet" : `${wrong.size} marked wrong`}</span>
          <span>{wrong.size === 0 ? "—" : `${ordered.length - wrong.size} / ${ordered.length} right`}</span>
        </div>
        <button className="cta" disabled={wrong.size === 0} onClick={() => setSaved(true)}>
          {saved ? "Practice set ready" : "Save and build my practice set"}
        </button>
      </div>

      <p className="sec-label">Practice waiting for you</p>
      {practice && practice.ok ? (
        <div className="practice">
          <h4>{practice.items.length} questions picked for you</h4>
          <p>
            Same topics, difficulty within one band, none of them seen before. Roughly{" "}
            {practice.items.length * 2} minutes of work.
          </p>
          <div className="chips">
            {wrongTopics.map((t) => (
              <span className="chip" key={t}>
                {t}
              </span>
            ))}
            <span className="chip dim">ADDED TO WEAK SPOTS</span>
          </div>
          {practice.coverageGaps.length > 0 && (
            <p style={{ marginTop: 10, fontSize: 11.5 }}>
              {practice.coverageGaps.length} topic(s) had nothing fresh at that level, so the
              matcher widened to the chapter and logged a coverage gap for us.
            </p>
          )}
          <Link className="cta" href="/demo/app/practice" style={{ textAlign: "center", textDecoration: "none", marginTop: 10 }}>
            Start practising
          </Link>
        </div>
      ) : (
        <div className="practice idle">
          <h4>{wrong.size === 0 ? "Mark a few questions first" : "Save to build your set"}</h4>
          <p>
            Once you save, the app pulls fresh questions on exactly those topics. Nothing you have
            already seen.
          </p>
        </div>
      )}
    </Phone>
  );
}
