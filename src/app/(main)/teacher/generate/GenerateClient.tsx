"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewPaper,
  savePaper,
  type PaperRequest,
  type PreviewResponse,
} from "@/server/actions/paper";
import { flagQuestion } from "@/server/actions/teacher";
import type { BatchOption, ChapterCount } from "@/server/data/teacher";

export interface SubjectBundle {
  classSubjectId: string;
  label: string;
  chapters: ChapterCount[];
  patterns: {
    id: string;
    name: string;
    totalMarks: number;
    durationMin: number | null;
    origin: string;
    sectionCount: number;
  }[];
  batches: BatchOption[];
  /** strands of this class-subject; the balance control shows when there are two or more */
  strands: { id: string; name: string }[];
}

const SPLITS = [
  { label: "30 / 50 / 20", value: { easy: 0.3, medium: 0.5, hard: 0.2 } },
  { label: "40 / 40 / 20", value: { easy: 0.4, medium: 0.4, hard: 0.2 } },
  { label: "20 / 50 / 30", value: { easy: 0.2, medium: 0.5, hard: 0.3 } },
];

const THIN = 8;

type Relax = "difficulty" | "topic_spread" | "strand_balance";

const RELAX_COPY: Record<Relax, { action: string; active: string; effect: string }> = {
  difficulty: {
    action: "Relax the difficulty mix",
    active: "Difficulty mix relaxed",
    effect: "Takes whatever mix of easy, medium and hard the chapters allow.",
  },
  topic_spread: {
    action: "Allow repeated topics",
    active: "Topics may repeat",
    effect: "Lets two questions come from the same topic.",
  },
  strand_balance: {
    action: "Relax the strand balance",
    active: "Strand balance relaxed",
    effect: "Stops holding each strand to its share of the marks.",
  },
};

/** Whole percentages, as even as possible, summing to exactly 100. */
function evenSplit(strands: { id: string }[]): Record<string, number> {
  const n = strands.length;
  if (n === 0) return {};
  const base = Math.floor(100 / n);
  return Object.fromEntries(strands.map((st, i) => [st.id, base + (i < 100 - base * n ? 1 : 0)]));
}

function newSeed(): number {
  return Math.floor(Math.random() * 2_000_000_000);
}

export function GenerateClient({ subjects }: { subjects: SubjectBundle[] }) {
  const router = useRouter();

  const [csId, setCsId] = useState(subjects[0]!.classSubjectId);
  const bundle = subjects.find((s) => s.classSubjectId === csId) ?? subjects[0]!;

  const [patternId, setPatternId] = useState(bundle.patterns[0]?.id ?? "");
  const [chapterIds, setChapterIds] = useState<string[]>(
    bundle.chapters.filter((c) => c.approved > 0).slice(0, 3).map((c) => c.chapterId),
  );
  const [splitIdx, setSplitIdx] = useState(0);
  const [setCount, setSetCount] = useState(1);
  const [batchId, setBatchId] = useState<string | null>(bundle.batches[0]?.id ?? null);
  const [repeatGuard, setRepeatGuard] = useState(true);
  const [title, setTitle] = useState("Unit test");
  // Relaxations are only ever added by the teacher clicking one (C8: never auto-relax).
  const [relaxed, setRelaxed] = useState<Relax[]>([]);
  const [strandOn, setStrandOn] = useState(false);
  const [strandPct, setStrandPct] = useState<Record<string, number>>(() => evenSplit(bundle.strands));
  const strandSum = bundle.strands.reduce((n, st) => n + (strandPct[st.id] ?? 0), 0);
  // Sent only when switched on AND adding up to 100% — a half-edited split is never applied.
  const strandWeights = useMemo(
    () =>
      strandOn && strandSum === 100
        ? Object.fromEntries(bundle.strands.map((st) => [st.id, (strandPct[st.id] ?? 0) / 100]))
        : undefined,
    [strandOn, strandSum, strandPct, bundle.strands],
  );
  const strandKey = JSON.stringify(strandWeights ?? null);

  const [seed, setSeed] = useState(newSeed);
  const [locked, setLocked] = useState<string[]>([]);
  const [swaps, setSwaps] = useState<{ blockKey: string; sectionLabel: string }[]>([]);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, startPreview] = useTransition();
  const [saving, startSave] = useTransition();
  const [flagging, setFlagging] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagError, setFlagError] = useState<string | null>(null);
  const [poolVersion, setPoolVersion] = useState(0);
  const [flagPending, startFlag] = useTransition();

  const pattern = bundle.patterns.find((p) => p.id === patternId) ?? bundle.patterns[0];

  const request = useMemo<PaperRequest | null>(() => {
    if (!pattern) return null;
    return {
      classSubjectId: bundle.classSubjectId,
      patternId: pattern.id,
      chapterIds,
      difficulty: SPLITS[splitIdx]!.value,
      setCount,
      batchId,
      excludeRecentPapers: repeatGuard ? 3 : 0,
      title,
      seed,
      lockedBlockKeys: locked,
      swaps,
      relax: relaxed,
      strandWeights,
    };
  }, [bundle.classSubjectId, pattern, chapterIds, splitIdx, setCount, batchId, repeatGuard, title, seed, locked, swaps, relaxed, strandWeights]);

  const run = useCallback(() => {
    if (!request) return;
    startPreview(async () => {
      setPreview(await previewPaper(request));
    });
  }, [request]);

  // Re-preview whenever an input that changes the paper changes. Title does not.
  // Debounced: ticking five chapters in a row is one preview, not five — each
  // preview counts against the generation rate limit.
  useEffect(() => {
    const t = setTimeout(run, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.classSubjectId, patternId, chapterIds, splitIdx, setCount, batchId, repeatGuard, seed, locked, swaps, poolVersion, relaxed, strandKey]);

  function changeSubject(id: string) {
    const next = subjects.find((s) => s.classSubjectId === id);
    if (!next) return;
    setCsId(id);
    setPatternId(next.patterns[0]?.id ?? "");
    setChapterIds(next.chapters.filter((c) => c.approved > 0).slice(0, 3).map((c) => c.chapterId));
    setBatchId(next.batches[0]?.id ?? null);
    setLocked([]);
    setSwaps([]);
    setRelaxed([]);
    setStrandOn(false);
    setStrandPct(evenSplit(next.strands));
  }

  function toggleChapter(id: string) {
    setChapterIds((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return next.length === 0 ? cur : next;
    });
    setSwaps([]);
  }

  function regenerate() {
    setSwaps([]);
    setSeed(newSeed());
  }

  function save() {
    if (!request) return;
    setSaveError(null);
    startSave(async () => {
      const res = await savePaper(request);
      if (res.ok) router.push(`/teacher/papers/${res.paperId}`);
      else setSaveError(res.reason);
    });
  }

  const lockedSet = new Set(locked);
  const selectedBatch = bundle.batches.find((b) => b.id === batchId);
  let counter = 0;

  return (
    <>
      {/* ------------------------------ controls ------------------------------ */}
      <section className="controls">
        <h3 className="blk">Paper settings</h3>

        <div className="field">
          <label htmlFor="cls">Class and subject</label>
          <select className="sel" id="cls" value={bundle.classSubjectId} onChange={(e) => changeSubject(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.classSubjectId} value={s.classSubjectId}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="title">Title</label>
          <input className="inp" id="title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="field">
          <label>Chapters to cover</label>
          {bundle.chapters.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--graphite)", margin: 0 }}>
              No chapters are set up for this subject yet.
            </p>
          ) : (
            <div className="checks">
              {bundle.chapters.map((c) => (
                <label className="check" key={c.chapterId}>
                  <input
                    type="checkbox"
                    checked={chapterIds.includes(c.chapterId)}
                    disabled={c.approved === 0}
                    onChange={() => toggleChapter(c.chapterId)}
                  />
                  {c.name}
                  <span className={`cnt${c.approved < THIN ? " thin" : ""}`}>{c.approved}</span>
                </label>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11, color: "var(--graphite)", margin: "8px 0 0" }}>
            Each count is the pool you will actually draw from — the shared bank plus your
            institute&rsquo;s own questions, minus anything flagged.
          </p>
        </div>

        <div className="field">
          <label htmlFor="pat">Pattern</label>
          {bundle.patterns.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--pen)", margin: 0 }}>
              No paper pattern exists for this subject yet.
            </p>
          ) : (
            <select className="sel" id="pat" value={pattern?.id ?? ""} onChange={(e) => { setPatternId(e.target.value); setLocked([]); setSwaps([]); }}>
              {bundle.patterns.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.totalMarks} marks{p.origin === "board" ? " · board" : ""}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="field">
          <label>Difficulty mix</label>
          <div className="mixrow">
            {(["easy", "medium", "hard"] as const).map((k) => (
              <div key={k} className={`mix ${k[0]}`}>
                <b>{Math.round(SPLITS[splitIdx]!.value[k] * 100)}%</b>
                <span>{k}</span>
              </div>
            ))}
          </div>
          <div className="btnrow" style={{ marginTop: 8 }}>
            {SPLITS.map((s, i) => (
              <button key={s.label} type="button" className={`btn sm${i === splitIdx ? " solid" : " ghost"}`} onClick={() => setSplitIdx(i)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {bundle.strands.length >= 2 && (
          <div className="field">
            <label>Strand balance</label>
            <label className="toggle">
              <input type="checkbox" checked={strandOn} onChange={(e) => setStrandOn(e.target.checked)} />
              Hold each strand to a share of the questions
            </label>
            {strandOn && (
              <div style={{ marginTop: 4 }}>
                {bundle.strands.map((st) => (
                  <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <label htmlFor={`strand-${st.id}`} style={{ flex: 1, fontSize: 12.5, fontWeight: 400, margin: 0 }}>{st.name}</label>
                    <input
                      id={`strand-${st.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      step={5}
                      className="inp"
                      style={{ width: 72, padding: "5px 7px" }}
                      value={strandPct[st.id] ?? 0}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                        setStrandPct((cur) => ({ ...cur, [st.id]: v }));
                      }}
                    />
                    <span style={{ fontSize: 12, color: "var(--graphite)" }}>%</span>
                  </div>
                ))}
                <p style={{ fontSize: 11.5, margin: "4px 0 6px", color: strandSum === 100 ? "var(--graphite)" : "var(--pen)" }}>
                  {strandSum === 100 ? "Adds up to 100%." : `Adds up to ${strandSum}% — it must be 100% to apply.`}
                </p>
                <button type="button" className="btn sm ghost" onClick={() => setStrandPct(evenSplit(bundle.strands))}>
                  Split evenly
                </button>
              </div>
            )}
          </div>
        )}

        <div className="field">
          <label htmlFor="batch">For batch</label>
          <select className="sel" id="batch" value={batchId ?? ""} onChange={(e) => setBatchId(e.target.value || null)}>
            {bundle.batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {b.students} students
              </option>
            ))}
            <option value="">No batch</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="sets">Printed sets</label>
          <select className="sel" id="sets" value={setCount} onChange={(e) => setSetCount(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "set" : "sets"}
              </option>
            ))}
          </select>
          {setCount > 1 && preview?.ok && (
            <div className="notice plain" style={{ marginTop: 8, marginBottom: 0 }}>
              <b>{selectedBatch?.students ?? 40} students</b> ·{" "}
              <span className="mono">
                {preview.copies.map((c, i) => `${String.fromCharCode(65 + i)}=${c}`).join(" / ")}
              </span>
              <br />
              Hand out in a repeating cycle along each row.
            </div>
          )}
          {setCount > 1 && preview?.ok && preview.warnings.length > 0 && (
            <div className="notice warn" style={{ marginTop: 8, marginBottom: 0 }}>
              {preview.warnings.map((w) => (
                <div key={w.section}>
                  Section {w.section} has {w.blocks} question{w.blocks === 1 ? "" : "s"} — some sets
                  will share its order.
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
          {relaxed.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {relaxed.map((r) => (
                <div key={r} className="notice warn" style={{ margin: 0, padding: "7px 9px", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12 }}>
                    <b>{RELAX_COPY[r].active}.</b> You chose this.
                  </span>
                  <button type="button" className="btn sm ghost" onClick={() => setRelaxed((cur) => cur.filter((x) => x !== r))}>
                    Undo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="gen" onClick={regenerate} disabled={loading || !pattern}>
          {loading ? "Building…" : "Generate a different paper"}
        </button>
        <p className="genmeta">
          {preview?.ok ? `${preview.poolSize} QUESTIONS ELIGIBLE` : " "}
          {locked.length > 0 ? ` · ${locked.length} LOCKED` : ""}
        </p>
      </section>

      {/* ------------------------------ preview ------------------------------ */}
      <section className="preview">
        <div className="pvhead">
          <div>
            <h2>{title || pattern?.name}</h2>
            <div className="sub">
              {bundle.label.toUpperCase()} · {pattern?.totalMarks ?? 0} MARKS
              {pattern?.durationMin ? ` · ${pattern.durationMin} MIN` : ""} · {setCount} SET
              {setCount === 1 ? "" : "S"} · DRAFT
            </div>
          </div>
          <div className="btnrow">
            <button type="button" className="btn solid" onClick={save} disabled={saving || !preview?.ok}>
              {saving ? "Saving…" : "Save and print"}
            </button>
          </div>
        </div>

        {saveError && <div className="notice warn" style={{ marginTop: 12 }}>{saveError}</div>}

        {!preview && <p className="lede" style={{ marginTop: 16 }}>Building a first paper…</p>}

        {preview && !preview.ok && (
          <div style={{ paddingTop: 16 }}>
            <div className="notice warn">
              <b>Could not build this paper.</b> {preview.reason}
            </div>
            {preview.shortfall.length > 0 && (
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
                    {preview.shortfall.map((s) => (
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
            {(preview.suggestions.some((s) => s.relax !== "repeat_guard") || repeatGuard) && (
              <>
                <h3 className="blk">What would help — you choose</h3>
                <div className="cards c3">
                  {preview.suggestions
                    .filter((s): s is typeof s & { relax: Relax } => s.relax !== "repeat_guard")
                    .map((s) => (
                      <div className="card tinted" key={s.relax}>
                        <h4>{RELAX_COPY[s.relax].action}</h4>
                        <p>
                          {RELAX_COPY[s.relax].effect}{" "}
                          {s.would_yield > 0
                            ? <>Fills <b>{s.would_yield}</b> more question{s.would_yield === 1 ? "" : "s"}.</>
                            : <>Lets this paper through with the questions it already has.</>}
                        </p>
                        <div className="btnrow" style={{ marginTop: 10 }}>
                          <button type="button" className="btn sm solid" onClick={() => setRelaxed((cur) => (cur.includes(s.relax) ? cur : [...cur, s.relax]))}>
                            {RELAX_COPY[s.relax].action}
                          </button>
                        </div>
                      </div>
                    ))}
                  {repeatGuard && (
                    <div className="card tinted">
                      <h4>Allow questions from recent papers</h4>
                      <p>Turns off &ldquo;skip anything used in my last 3 papers&rdquo;, which brings those questions back into the pool.</p>
                      <div className="btnrow" style={{ marginTop: 10 }}>
                        <button type="button" className="btn sm solid" onClick={() => setRepeatGuard(false)}>
                          Turn off the repeat rule
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            <p style={{ fontSize: 12, color: "var(--graphite)", marginTop: 12 }}>
              Or tick more chapters. The generator never relaxes a rule on your behalf — each of these only
              applies once you click it, and you can undo it under Rules.
            </p>
          </div>
        )}

        {preview?.ok && (
          <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity .15s" }}>
            {preview.unappliedSwaps > 0 && (
              <div className="notice plain" style={{ marginTop: 12 }}>
                {preview.unappliedSwaps} swap{preview.unappliedSwaps === 1 ? "" : "s"} could not be
                applied — there was no other question with the same marks, chapter and difficulty.
              </div>
            )}
            <div className="paper">
              {preview.sections.map((section) => (
                <div key={section.label}>
                  <p className="qsec">
                    Section {section.label} · {section.marksEach} mark{section.marksEach === 1 ? "" : "s"} each
                  </p>
                  {section.blocks.map((b) => {
                    counter += 1;
                    const n = counter;
                    const isLocked = lockedSet.has(b.key);
                    return (
                      <div className={`q${isLocked ? " locked" : ""}`} key={b.key} style={{ flexWrap: "wrap" }}>
                        <span className="no">{n}.</span>
                        <div className="body">
                          {b.stimulusHtml && (
                            <div className="stimulus">
                              <span className="kind">Read the following and answer the questions</span>
                              <div dangerouslySetInnerHTML={{ __html: b.stimulusHtml }} />
                            </div>
                          )}
                          {b.questions.map((q, i) => (
                            <div key={q.id} style={{ marginBottom: i < b.questions.length - 1 ? 6 : 0 }}>
                              {b.questions.length > 1 && (
                                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--graphite)", marginRight: 6 }}>
                                  ({String.fromCharCode(97 + i)})
                                </span>
                              )}
                              <span dangerouslySetInnerHTML={{ __html: q.html }} />
                            </div>
                          ))}
                          {b.choice && (
                            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--hair)" }}>
                              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--graphite)" }}>OR </span>
                              {b.choice.map((q) => (
                                <span key={q.id} dangerouslySetInnerHTML={{ __html: q.html + " " }} />
                              ))}
                            </div>
                          )}
                          <div className="tags">
                            <span className={`tag ${b.difficulty[0]}`}>{b.difficulty}</span>
                            {b.chapterName && <span className="tag">{b.chapterName}</span>}
                            {b.questions[0]?.source && <span className="tag src">{b.questions[0].source}</span>}
                            {b.isPrivate && <span className="tag priv">Our question</span>}
                            {isLocked && <span className="tag lock">Locked</span>}
                          </div>
                        </div>
                        <span className="mk">{b.marks}</span>
                        <div className="acts">
                          <button
                            type="button"
                            className="iconbtn lk"
                            title={isLocked ? "Unlock" : "Lock — keep this question when regenerating"}
                            aria-pressed={isLocked}
                            onClick={() =>
                              setLocked((cur) => (cur.includes(b.key) ? cur.filter((k) => k !== b.key) : [...cur, b.key]))
                            }
                          >
                            ●
                          </button>
                          <button
                            type="button"
                            className="iconbtn"
                            title="Swap for another with the same marks, chapter and difficulty"
                            disabled={isLocked || loading}
                            onClick={() => setSwaps((s) => [...s, { blockKey: b.key, sectionLabel: section.label }])}
                          >
                            ⟳
                          </button>
                          <button
                            type="button"
                            className="iconbtn"
                            title="Flag as wrong or badly worded"
                            disabled={loading}
                            onClick={() => {
                              setFlagging(flagging === b.key ? null : b.key);
                              setFlagReason("");
                              setFlagError(null);
                            }}
                          >
                            ⚑
                          </button>
                        </div>
                        {flagging === b.key && (
                          <div style={{ flexBasis: "100%", marginTop: 8, paddingLeft: 34 }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <input
                                className="inp"
                                style={{ fontSize: 12, padding: "6px 8px" }}
                                placeholder="What is wrong with it?"
                                value={flagReason}
                                maxLength={500}
                                autoFocus
                                onChange={(e) => setFlagReason(e.target.value)}
                              />
                              <button
                                type="button"
                                className="btn sm solid"
                                disabled={flagPending || flagReason.trim().length < 3}
                                onClick={() =>
                                  startFlag(async () => {
                                    const qid = b.questions[0]?.id;
                                    if (!qid) return;
                                    const res = await flagQuestion(qid, flagReason);
                                    if (!res.ok) {
                                      setFlagError(res.message ?? "Could not flag it.");
                                      return;
                                    }
                                    setFlagging(null);
                                    // the flagged question has left this institute's pool
                                    setLocked((cur) => cur.filter((k) => k !== b.key));
                                    setSwaps([]);
                                    setPoolVersion((v) => v + 1);
                                  })
                                }
                              >
                                {flagPending ? "Flagging…" : "Flag"}
                              </button>
                            </div>
                            <p style={{ fontSize: 11, color: "var(--graphite)", margin: "4px 0 0" }}>
                              It leaves your institute&rsquo;s papers now; the shared bank keeps it until the platform reviews it.
                            </p>
                            {flagError && <p style={{ fontSize: 11.5, color: "var(--pen)", margin: "4px 0 0" }}>{flagError}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="statstrip">
              <div className="stat">
                <b>{preview.sections.reduce((a, s) => a + s.blocks.length, 0)}</b>
                <span>Questions</span>
              </div>
              <div className="stat">
                <b>{preview.totalMarks}</b>
                <span>Marks placed</span>
              </div>
              <div className="stat good">
                <b>
                  {Math.round(preview.difficultyActual.easy * 100)}/{Math.round(preview.difficultyActual.medium * 100)}/
                  {Math.round(preview.difficultyActual.hard * 100)}
                </b>
                <span>Actual E/M/H</span>
              </div>
              <div className={preview.forcedTopicRepeats > 0 ? "stat warn" : "stat"}>
                <b>{preview.forcedTopicRepeats}</b>
                <span>Forced topic repeats</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
