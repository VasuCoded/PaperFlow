"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewPaper,
  savePaper,
  type PaperRequest,
  type PreviewResponse,
} from "@/server/actions/paper";
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
}

const SPLITS = [
  { label: "30 / 50 / 20", value: { easy: 0.3, medium: 0.5, hard: 0.2 } },
  { label: "40 / 40 / 20", value: { easy: 0.4, medium: 0.4, hard: 0.2 } },
  { label: "20 / 50 / 30", value: { easy: 0.2, medium: 0.5, hard: 0.3 } },
];

const THIN = 8;

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

  const [seed, setSeed] = useState(newSeed);
  const [locked, setLocked] = useState<string[]>([]);
  const [swaps, setSwaps] = useState<{ blockKey: string; sectionLabel: string }[]>([]);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, startPreview] = useTransition();
  const [saving, startSave] = useTransition();

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
    };
  }, [bundle.classSubjectId, pattern, chapterIds, splitIdx, setCount, batchId, repeatGuard, title, seed, locked, swaps]);

  const run = useCallback(() => {
    if (!request) return;
    startPreview(async () => {
      setPreview(await previewPaper(request));
    });
  }, [request]);

  // Re-preview whenever an input that changes the paper changes. Title does not.
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.classSubjectId, patternId, chapterIds, splitIdx, setCount, batchId, repeatGuard, seed, locked, swaps]);

  function changeSubject(id: string) {
    const next = subjects.find((s) => s.classSubjectId === id);
    if (!next) return;
    setCsId(id);
    setPatternId(next.patterns[0]?.id ?? "");
    setChapterIds(next.chapters.filter((c) => c.approved > 0).slice(0, 3).map((c) => c.chapterId));
    setBatchId(next.batches[0]?.id ?? null);
    setLocked([]);
    setSwaps([]);
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
            {preview.suggestions.length > 0 && (
              <>
                <h3 className="blk">What would help</h3>
                <div className="cards c3">
                  {preview.suggestions.map((s) => (
                    <div className="card tinted" key={s.relax}>
                      <h4>Relax {s.relax.replace("_", " ")}</h4>
                      <p>Would fill {s.would_yield} more question{s.would_yield === 1 ? "" : "s"}.</p>
                    </div>
                  ))}
                </div>
              </>
            )}
            <p style={{ fontSize: 12, color: "var(--graphite)", marginTop: 12 }}>
              Try ticking more chapters, turning off the repeat rule, or a different difficulty mix.
              The generator never quietly relaxes a rule on your behalf.
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
                      <div className={`q${isLocked ? " locked" : ""}`} key={b.key}>
                        <span className="no">{n}.</span>
                        <div className="body">
                          {b.questions.map((q, i) => (
                            <div key={q.id} style={{ marginBottom: i < b.questions.length - 1 ? 6 : 0 }}>
                              {b.questions.length > 1 && (
                                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--graphite)", marginRight: 6 }}>
                                  ({String.fromCharCode(97 + i)})
                                </span>
                              )}
                              {q.body}
                            </div>
                          ))}
                          {b.choice && (
                            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--hair)" }}>
                              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--graphite)" }}>OR </span>
                              {b.choice.map((q) => q.body).join(" ")}
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
                        </div>
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
