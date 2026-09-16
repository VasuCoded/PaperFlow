"use client";

import { useMemo, useState } from "react";
import { Shell } from "../../_components/Shell";
import { useDemoSession } from "@/demo/session";
import {
  BANK_INDEX, bankFor, chaptersFor, classSubject, csLabel, toGenQuestions,
} from "@/demo/bank";
import { ACTIVE_CLASS_SUBJECTS, PATTERNS, TEACHER_SUBJECTS, batchesFor } from "@/demo/activity";
import { PLATFORM_ID } from "@/demo/institutes";
import { buildBlocks, generatePaper, swapBlock } from "@/server/generator";
import type { Block, GenerateInput, GenerateResult } from "@/server/generator";
import { buildSets, copiesBreakdown } from "@/server/sets";
import type { BankItem } from "@/demo/types";

const SPLITS = [
  { label: "30 / 50 / 20", value: { easy: 0.3, medium: 0.5, hard: 0.2 } },
  { label: "40 / 40 / 20", value: { easy: 0.4, medium: 0.4, hard: 0.2 } },
  { label: "20 / 50 / 30", value: { easy: 0.2, medium: 0.5, hard: 0.3 } },
];

function items(block: Block): BankItem[] {
  return block.questions.map((q) => BANK_INDEX.get(q.id)).filter((x): x is BankItem => !!x);
}

export default function GeneratePage() {
  const { account, instituteId } = useDemoSession();

  // class-subjects this teacher may generate for: their teacher_subjects,
  // intersected with what the institute has ACTIVE (my_active_class_subjects).
  const mine = useMemo(() => {
    if (!account || !instituteId) return [];
    const assigned = TEACHER_SUBJECTS[account.id] ?? [];
    const active = ACTIVE_CLASS_SUBJECTS[instituteId] ?? [];
    const own = assigned.filter((a) => a.instituteId === instituteId).map((a) => a.classSubjectId);
    // an institute_admin sees everything active at their institute
    const list = own.length > 0 ? own : active;
    return list.filter((id) => active.includes(id));
  }, [account, instituteId]);

  const [csId, setCsId] = useState<string>(mine[0] ?? "");
  const effectiveCs = csId && mine.includes(csId) ? csId : (mine[0] ?? "");

  const chapters = useMemo(() => chaptersFor(effectiveCs), [effectiveCs]);
  const bank = useMemo(() => bankFor(effectiveCs), [effectiveCs]);

  const patterns = useMemo(
    () => PATTERNS.filter((p) => p.id !== "pat-board-70" || effectiveCs === "cs-12-bio"),
    [effectiveCs],
  );
  const [patternId, setPatternId] = useState("pat-unit-30");
  const pattern = patterns.find((p) => p.id === patternId) ?? patterns[0]!;

  const [chosen, setChosen] = useState<string[]>([]);
  const activeChapters = chosen.length > 0 ? chosen : chapters.slice(0, 3).map((c) => c.id);

  const [splitIdx, setSplitIdx] = useState(0);
  const [setCount, setSetCount] = useState(3);
  const [repeatGuard, setRepeatGuard] = useState(true);
  const [followPattern, setFollowPattern] = useState(true);
  const [weakWeight, setWeakWeight] = useState(false);

  const [seed, setSeed] = useState(20260916);
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [building, setBuilding] = useState(false);
  const [swapped, setSwapped] = useState<Record<string, string>>({});

  // --- per-chapter eligible counts (shared + this institute, honest numbers) --
  const chapterCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bank) {
      if (b.ownerInstituteId !== PLATFORM_ID && b.ownerInstituteId !== instituteId) continue;
      m.set(b.chapterId, (m.get(b.chapterId) ?? 0) + 1);
    }
    return m;
  }, [bank, instituteId]);

  // --- run the REAL generator ------------------------------------------------
  const input: GenerateInput = useMemo(
    () => ({
      instituteId: instituteId ?? "",
      classSubjectId: effectiveCs,
      allowedOwnerIds: [PLATFORM_ID, instituteId ?? ""],
      difficultySplit: SPLITS[splitIdx]!.value,
      seed,
    }),
    [instituteId, effectiveCs, splitIdx, seed],
  );

  const allBlocks = useMemo(() => {
    const pool = bank.filter((b) => activeChapters.includes(b.chapterId));
    return buildBlocks(toGenQuestions(pool));
  }, [bank, activeChapters]);

  const result: GenerateResult = useMemo(
    () => generatePaper(input, allBlocks, pattern),
    [input, allBlocks, pattern],
  );

  // apply local swaps on top of the generated paper
  const paper = useMemo(() => {
    if (!result.ok) return result;
    let p = result;
    for (const [fromKey, sectionLabel] of Object.entries(swapped)) {
      const r = swapBlock(p, sectionLabel, fromKey, allBlocks, input);
      if (r.ok) p = r.paper;
    }
    return p;
  }, [result, swapped, allBlocks, input]);

  const sets = useMemo(() => {
    if (!paper.ok) return null;
    const shufflePaper = {
      sections: paper.sections.map((s) => ({
        label: s.label,
        blocks: s.blocks.map((pb) => ({
          key: pb.block.key,
          marks: pb.positionMarks,
          positionLocked: locked.has(pb.block.key),
          questions: pb.block.questions.map((q) => ({
            key: q.id,
            optionsShufflable: q.optionsShufflable,
            optionKeys: q.optionsShufflable ? ["A", "B", "C", "D"] : null,
          })),
        })),
      })),
    };
    const batch = batchesFor(instituteId ?? "").find((b) => b.classSubjectId === effectiveCs);
    return buildSets(shufflePaper, setCount, batch?.students ?? 40, seed);
  }, [paper, setCount, seed, locked, instituteId, effectiveCs]);

  const eligible = allBlocks.reduce((n, b) => n + b.questions.length, 0);
  const cs = classSubject(effectiveCs);
  const batch = batchesFor(instituteId ?? "").find((b) => b.classSubjectId === effectiveCs);

  function regenerate() {
    setBuilding(true);
    setSwapped({});
    setTimeout(() => {
      setSeed(Math.floor(Math.random() * 1e8));
      setBuilding(false);
    }, 420);
  }

  let counter = 0;

  return (
    <Shell
      area="teacher"
      eyebrow="Teacher · set a paper"
      title={
        <>
          Setting a paper, <em>start to print</em>
        </>
      }
      intro="Pick class, chapters, marks and difficulty. The paper and the answer key come out together. This is the only new habit in the whole system."
      split
    >
      {/* ------------------------------ controls ------------------------------ */}
      <section className="controls">
        <h3 className="blk">Paper settings</h3>

        <div className="field">
          <label htmlFor="cls">Class and subject</label>
          <select
            className="sel"
            id="cls"
            value={effectiveCs}
            onChange={(e) => {
              setCsId(e.target.value);
              setChosen([]);
              setSwapped({});
              setLocked(new Set());
              if (e.target.value !== "cs-12-bio" && patternId === "pat-board-70") {
                setPatternId("pat-unit-30");
              }
            }}
          >
            {mine.map((id) => (
              <option key={id} value={id}>
                {csLabel(id)}
              </option>
            ))}
          </select>
          <p style={{ fontSize: 11, color: "var(--graphite)", margin: "6px 0 0" }}>
            Only subjects you are assigned that are active for this institute. Read from{" "}
            <span style={{ fontFamily: "var(--mono)" }}>my_active_class_subjects</span>.
          </p>
        </div>

        <div className="field">
          <label>Chapters to cover</label>
          <div className="checks">
            {chapters.map((c) => {
              const n = chapterCounts.get(c.id) ?? 0;
              const on = activeChapters.includes(c.id);
              return (
                <label className="check" key={c.id}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const base = activeChapters;
                      const next = on ? base.filter((x) => x !== c.id) : [...base, c.id];
                      setChosen(next.length ? next : [c.id]);
                      setSwapped({});
                    }}
                  />
                  {c.name}
                  <span className={`cnt${n < 8 ? " thin" : ""}`}>{n}</span>
                </label>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "var(--graphite)", margin: "8px 0 0" }}>
            Counts are the pool you will actually draw from — shared bank plus this
            institute&rsquo;s private questions, minus anything you have flagged.
          </p>
        </div>

        <div className="field">
          <label htmlFor="mk">Pattern</label>
          <select
            className="sel"
            id="mk"
            value={pattern.id}
            onChange={(e) => {
              setPatternId(e.target.value);
              setSwapped({});
            }}
          >
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Difficulty mix</label>
          <div className="mixrow">
            {(["easy", "medium", "hard"] as const).map((k, i) => (
              <div key={k} className={`mix ${k[0]}`}>
                <b>{Math.round(SPLITS[splitIdx]!.value[k] * 100)}%</b>
                <span>{k}</span>
                {i === 3 && null}
              </div>
            ))}
          </div>
          <div className="btnrow" style={{ marginTop: 8 }}>
            {SPLITS.map((s, i) => (
              <button
                key={s.label}
                className={`btn sm${i === splitIdx ? " solid" : " ghost"}`}
                onClick={() => setSplitIdx(i)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="sets">Printed sets</label>
          <select
            className="sel"
            id="sets"
            value={setCount}
            onChange={(e) => setSetCount(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "set" : "sets"}
              </option>
            ))}
          </select>
          {setCount > 1 && batch && (
            <div className="notice plain" style={{ marginTop: 8, marginBottom: 0 }}>
              <b>{batch.students} students</b> ·{" "}
              <span className="mono">
                {copiesBreakdown(batch.students, setCount)
                  .map((c, i) => `${String.fromCharCode(65 + i)}=${c}`)
                  .join(" / ")}
              </span>
              <br />
              Hand out in a repeating cycle along each row.
            </div>
          )}
          {sets && sets.warnings.length > 0 && (
            <div className="notice warn" style={{ marginTop: 8, marginBottom: 0 }}>
              {sets.warnings.map((w) => (
                <div key={w.section}>
                  Section {w.section} has only {w.blocks} block{w.blocks === 1 ? "" : "s"} — two
                  sets must share its ordering.
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <label>Rules</label>
          <label className="toggle">
            <input type="checkbox" checked={repeatGuard} onChange={(e) => setRepeatGuard(e.target.checked)} />
            Skip anything used in my last 3 papers
          </label>
          <label className="toggle">
            <input type="checkbox" checked={followPattern} onChange={(e) => setFollowPattern(e.target.checked)} />
            Follow the section pattern exactly
          </label>
          <label className="toggle">
            <input type="checkbox" checked={weakWeight} onChange={(e) => setWeakWeight(e.target.checked)} />
            Weight towards this batch&rsquo;s weak topics
          </label>
        </div>

        <button className="gen" onClick={regenerate} disabled={building}>
          {building ? "Building…" : "Generate paper"}
        </button>
        <p className="genmeta">
          SEED {seed} · {eligible} QUESTIONS ELIGIBLE
        </p>
      </section>

      {/* ------------------------------ preview ------------------------------ */}
      <section className="preview">
        <div className="pvhead">
          <div>
            <h2>
              {pattern.name} · {cs ? `Class ${cs.className} ${cs.subjectName}` : ""}
            </h2>
            <div className="sub">
              {pattern.totalMarks} MARKS · {activeChapters.length} CHAPTER
              {activeChapters.length === 1 ? "" : "S"} · {setCount} SET
              {setCount === 1 ? "" : "S"} · DRAFT
            </div>
          </div>
          <div className="btnrow">
            <button className="btn" onClick={regenerate}>Swap all</button>
            <a className="btn" href="/print/sample" target="_blank" rel="noreferrer">Answer key</a>
            <a className="btn solid" href="/print/sample" target="_blank" rel="noreferrer">Print</a>
          </div>
        </div>

        {!paper.ok ? (
          <div style={{ paddingTop: 16 }}>
            <div className="notice warn">
              <b>Could not build this paper.</b> {paper.reason}
            </div>
            {paper.shortfall.length > 0 && (
              <div className="tablewrap" style={{ marginBottom: 14 }}>
                <table className="lt">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th className="num">Marks each</th>
                      <th className="num">Needed</th>
                      <th className="num">Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paper.shortfall.map((s) => (
                      <tr key={s.section}>
                        <td>Section {s.section}</td>
                        <td className="num">{s.marks}</td>
                        <td className="num">{s.needed}</td>
                        <td className="num" style={{ color: "var(--pen)" }}>{s.available}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {paper.suggestions.length > 0 && (
              <>
                <h3 className="blk">What would help</h3>
                <div className="cards c3">
                  {paper.suggestions.map((s) => (
                    <div className="card tinted" key={s.relax}>
                      <h4>Relax {s.relax.replace("_", " ")}</h4>
                      <p>Would fill {s.would_yield} more position{s.would_yield === 1 ? "" : "s"}.</p>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: "var(--graphite)", marginTop: 12 }}>
                  The generator never quietly relaxes a rule to avoid saying no — the teacher
                  chooses which constraint to give up.
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="paper">
              {paper.sections.map((section) => (
                <div key={section.label}>
                  <p className="qsec">
                    Section {section.label} · {section.blocks[0]?.positionMarks ?? 0} mark
                    {(section.blocks[0]?.positionMarks ?? 0) === 1 ? "" : "s"} each
                  </p>
                  {section.blocks.map((pb) => {
                    const bits = items(pb.block);
                    const first = bits[0];
                    const isLocked = locked.has(pb.block.key);
                    counter += 1;
                    const n = counter;
                    return (
                      <div key={pb.block.key}>
                        {pb.block.isStimulus && first?.stimulusBody && (
                          <div className="stimulus">
                            <span className="kind">
                              {(first.stimulusKind ?? "stimulus").replace("_", " ")} · read for{" "}
                              {bits.length} question{bits.length === 1 ? "" : "s"}
                            </span>
                            {first.stimulusBody}
                          </div>
                        )}
                        <div className={`q${isLocked ? " locked" : ""}`}>
                          <span className="no">{n}.</span>
                          <div className="body">
                            {bits.map((b, i) => (
                              <div key={b.id} style={{ marginBottom: i < bits.length - 1 ? 6 : 0 }}>
                                {bits.length > 1 && (
                                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--graphite)", marginRight: 6 }}>
                                    ({String.fromCharCode(97 + i)})
                                  </span>
                                )}
                                {b.body}
                              </div>
                            ))}
                            <div className="tags">
                              <span className={`tag ${pb.block.difficulty[0]}`}>
                                {pb.block.difficulty}
                              </span>
                              <span className="tag">{first?.topicName}</span>
                              <span className="tag src">{first?.source}</span>
                              {pb.block.ownerInstituteId !== PLATFORM_ID && (
                                <span className="tag priv">Our question</span>
                              )}
                              {isLocked && <span className="tag lock">Locked</span>}
                              {pb.choiceAlternative && <span className="tag">OR-choice</span>}
                            </div>
                          </div>
                          <span className="mk">{pb.positionMarks}</span>
                          <div className="acts">
                            <button
                              className={`iconbtn lk`}
                              title={isLocked ? "Unlock" : "Lock this question"}
                              onClick={() => {
                                const next = new Set(locked);
                                if (next.has(pb.block.key)) next.delete(pb.block.key);
                                else next.add(pb.block.key);
                                setLocked(next);
                              }}
                            >
                              ●
                            </button>
                            <button
                              className="iconbtn"
                              title="Swap for another"
                              disabled={isLocked}
                              onClick={() =>
                                setSwapped((s) => ({ ...s, [pb.block.key]: section.label }))
                              }
                            >
                              ⟳
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="statstrip">
              <div className="stat">
                <b>{paper.sections.reduce((n, s) => n + s.blocks.length, 0)}</b>
                <span>Questions</span>
              </div>
              <div className="stat">
                <b>{paper.totalMarks}</b>
                <span>Marks placed</span>
              </div>
              <div className="stat good">
                <b>
                  {Math.round(paper.difficultyActual.easy * 100)}/
                  {Math.round(paper.difficultyActual.medium * 100)}/
                  {Math.round(paper.difficultyActual.hard * 100)}
                </b>
                <span>Actual E/M/H</span>
              </div>
              <div className={paper.forcedTopicRepeats > 0 ? "stat warn" : "stat"}>
                <b>{paper.forcedTopicRepeats}</b>
                <span>Forced topic repeats</span>
              </div>
            </div>

            {sets && setCount > 1 && (
              <div className="notice" style={{ marginTop: 14 }}>
                <b>{setCount} printed sets built.</b> Mean positional overlap{" "}
                <span className="mono">{Math.round(sets.pairwiseOverlap * 100)}%</span> — same
                questions, different order, identical marks at every position.
              </div>
            )}
          </>
        )}
      </section>
    </Shell>
  );
}
