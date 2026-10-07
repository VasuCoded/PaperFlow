"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  previewPaper,
  removeSavedLayout,
  savePaper,
  type LayoutChoice,
  type PaperRequest,
  type PreviewResponse,
} from "@/server/actions/paper";
import { flagQuestion } from "@/server/actions/teacher";
import type { BatchOption, ChapterCount } from "@/server/data/teacher";
import {
  kindLabel,
  layoutTotals,
  QUICK_TEMPLATES,
  sectionLabel,
  templateByKey,
  type AvailabilityRow,
  type CustomLayout,
  type LayoutSection,
} from "@/lib/paper-layout";
import { Dropdown, type DropdownOption } from "@/components/ui/Dropdown";
import { Icon } from "@/components/ui/Icon";
import { LayoutEditor } from "./LayoutEditor";

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
    isInstituteTemplate: boolean;
    canRemove: boolean;
    generalInstructions: string;
    sections: LayoutSection[];
  }[];
  batches: BatchOption[];
  /** strands of this class-subject; the balance control shows when there are two or more */
  strands: { id: string; name: string }[];
}

const SPLITS = [
  { label: "Balanced", value: { easy: 0.3, medium: 0.5, hard: 0.2 } },
  { label: "Easier", value: { easy: 0.4, medium: 0.4, hard: 0.2 } },
  { label: "Harder", value: { easy: 0.2, medium: 0.5, hard: 0.3 } },
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

/**
 * The layout picker's value: "p:<patternId>" a stored pattern, "t:<key>" a
 * quick template, "custom" the teacher's own (edited in LayoutEditor).
 */
type LayoutSel = string;

function firstLayout(b: SubjectBundle): LayoutSel {
  return b.patterns[0] ? `p:${b.patterns[0].id}` : `t:${QUICK_TEMPLATES[0]!.key}`;
}

/** Only what changes the paper — so typing a name or instructions never re-generates. */
function structureKey(l: CustomLayout): string {
  return JSON.stringify([l.durationMin, l.sections.map((s) => [s.questionTypes, s.requiresStimulus, s.questionCount, s.marksEach, s.allowChoice])]);
}

export function GenerateClient({ subjects }: { subjects: SubjectBundle[] }) {
  const router = useRouter();

  const [csId, setCsId] = useState(subjects[0]!.classSubjectId);
  const bundle = subjects.find((s) => s.classSubjectId === csId) ?? subjects[0]!;

  const [layoutSel, setLayoutSel] = useState<LayoutSel>(() => firstLayout(bundle));
  const [custom, setCustom] = useState<CustomLayout | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityRow[] | null>(null);
  const [removing, startRemove] = useTransition();
  const [chapterIds, setChapterIds] = useState<string[]>(
    bundle.chapters.filter((c) => c.approved > 0).slice(0, 3).map((c) => c.chapterId),
  );
  // -1 = the teacher's own percentages
  const [splitIdx, setSplitIdx] = useState(0);
  const [customPct, setCustomPct] = useState({ easy: 30, medium: 50, hard: 20 });
  const customSum = customPct.easy + customPct.medium + customPct.hard;
  // Only a mix that adds up to 100% is ever sent; a half-typed one keeps the last good paper.
  const [lastGoodCustom, setLastGoodCustom] = useState(customPct);
  const split = splitIdx >= 0
    ? SPLITS[splitIdx]!.value
    : { easy: lastGoodCustom.easy / 100, medium: lastGoodCustom.medium / 100, hard: lastGoodCustom.hard / 100 };
  const splitKey = JSON.stringify(split);
  const [setCount, setSetCount] = useState(1);
  const [batchId, setBatchId] = useState<string | null>(bundle.batches[0]?.id ?? null);
  const [repeatGuard, setRepeatGuard] = useState(true);
  const [title, setTitle] = useState("");
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

  // What the picker currently means, as a layout — for the summary, the preview
  // header and as the starting point when the teacher chooses to customise.
  const storedPattern = layoutSel.startsWith("p:") ? bundle.patterns.find((p) => `p:${p.id}` === layoutSel) : undefined;
  const template = layoutSel.startsWith("t:") ? templateByKey(layoutSel.slice(2)) : undefined;
  const current: CustomLayout | null =
    layoutSel === "custom"
      ? custom
      : storedPattern
        ? { name: storedPattern.name, durationMin: storedPattern.durationMin, generalInstructions: storedPattern.generalInstructions, sections: storedPattern.sections }
        : (template?.layout ?? null);
  const totals = current ? layoutTotals(current.sections) : { questions: 0, marks: 0 };

  const layoutChoice = useMemo<LayoutChoice | null>(() => {
    if (storedPattern) return { kind: "pattern", patternId: storedPattern.id };
    if (template) return { kind: "custom", layout: template.layout };
    if (layoutSel === "custom" && custom) return { kind: "custom", layout: custom, saveAsTemplate };
    return null;
  }, [storedPattern, template, layoutSel, custom, saveAsTemplate]);
  const layoutKey = layoutSel === "custom" && custom ? `custom:${structureKey(custom)}` : layoutSel;

  function chooseLayout(sel: LayoutSel) {
    if (sel === "custom") {
      // Back to their own layout if they have one; otherwise start from what
      // was chosen, so "custom" means "this, changed".
      if (!custom && current) setCustom({ ...current, name: `${current.name} (custom)` });
      setEditorOpen(true);
    }
    setLayoutSel(sel);
    setLocked([]);
    setSwaps([]);
  }

  function customiseCurrent() {
    if (!current) return;
    setCustom({ ...current, name: layoutSel === "custom" ? current.name : `${current.name} (custom)` });
    setLayoutSel("custom");
    setEditorOpen(true);
    setLocked([]);
    setSwaps([]);
  }

  function editCustom(next: CustomLayout) {
    // a different structure invalidates locks and swaps; names and instructions do not
    if (!custom || structureKey(next) !== structureKey(custom)) {
      setLocked([]);
      setSwaps([]);
    }
    setCustom(next);
  }

  const request = useMemo<PaperRequest | null>(() => {
    if (!layoutChoice) return null;
    return {
      classSubjectId: bundle.classSubjectId,
      layout: layoutChoice,
      chapterIds,
      difficulty: split,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- split is keyed by splitKey
  }, [bundle.classSubjectId, layoutChoice, chapterIds, splitKey, setCount, batchId, repeatGuard, title, seed, locked, swaps, relaxed, strandWeights]);

  const run = useCallback(() => {
    if (!request) return;
    startPreview(async () => {
      const res = await previewPaper(request);
      setPreview(res);
      if (res.availability.length > 0 || res.ok) setAvailability(res.availability);
    });
  }, [request]);

  // Re-preview whenever an input that changes the paper changes. Title does not.
  // Debounced: ticking five chapters in a row is one preview, not five — each
  // preview counts against the generation rate limit.
  useEffect(() => {
    const t = setTimeout(run, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.classSubjectId, layoutKey, chapterIds, splitKey, setCount, batchId, repeatGuard, seed, locked, swaps, poolVersion, relaxed, strandKey]);

  function changeSubject(id: string) {
    const next = subjects.find((s) => s.classSubjectId === id);
    if (!next) return;
    setCsId(id);
    // a custom layout carries over (it names kinds, not a subject); a stored pattern cannot
    if (layoutSel !== "custom") setLayoutSel(firstLayout(next));
    setAvailability(null);
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
  const usable = bundle.chapters.filter((c) => c.approved > 0);
  const placed = preview?.ok ? preview.sections.reduce((a, s) => a + s.blocks.length, 0) : 0;
  let counter = 0;

  const layoutOptions: DropdownOption[] = [
    ...bundle.patterns.filter((p) => !p.isInstituteTemplate).map((p) => ({
      value: `p:${p.id}`,
      label: p.name,
      hint: `${p.totalMarks} marks${p.durationMin ? ` · ${p.durationMin} min` : ""}${p.origin === "board" ? " · board pattern" : ""}`,
      group: "CBSE and standard",
    })),
    ...bundle.patterns.filter((p) => p.isInstituteTemplate).map((p) => ({
      value: `p:${p.id}`,
      label: p.name,
      hint: `${p.totalMarks} marks${p.durationMin ? ` · ${p.durationMin} min` : ""}`,
      group: "Saved by your institute",
    })),
    ...QUICK_TEMPLATES.map((t) => {
      const tt = layoutTotals(t.layout.sections);
      return { value: `t:${t.key}`, label: t.name, hint: `${tt.marks} marks · ${tt.questions} questions`, group: "Quick tests" };
    }),
    { value: "custom", label: custom ? custom.name : "Build your own", hint: custom ? "Your own layout" : "Choose every section yourself", group: "Your own" },
  ];

  return (
    <div className="pb">
      {/* ============================ the recipe (left) ============================ */}
      <div className="pb-panel" aria-label="Paper settings">
        <section className="pb-step">
          <h3 className="pb-h"><span className="pb-n">1</span>Who is it for</h3>
          <label className="pb-l" htmlFor="cls">Class and subject</label>
          <Dropdown
            id="cls"
            value={bundle.classSubjectId}
            onChange={changeSubject}
            options={subjects.map((s) => ({ value: s.classSubjectId, label: s.label, hint: `${s.chapters.filter((c) => c.approved > 0).length} chapters with questions` }))}
          />
          <label className="pb-l" htmlFor="batch">Batch</label>
          <Dropdown
            id="batch"
            value={batchId ?? ""}
            onChange={(v) => setBatchId(v || null)}
            options={[
              ...bundle.batches.map((b) => ({ value: b.id, label: b.name, hint: `${b.students} student${b.students === 1 ? "" : "s"}` })),
              { value: "", label: "No batch", hint: "Just print it" },
            ]}
          />
        </section>

        <section className="pb-step">
          <h3 className="pb-h">
            <span className="pb-n">2</span>Chapters
            <span className="pb-count">{chapterIds.length} of {usable.length}</span>
          </h3>
          {bundle.chapters.length === 0 ? (
            <p className="pb-note">No chapters are set up for this subject yet.</p>
          ) : (
            <>
              <div className="chipset">
                {bundle.chapters.map((c) => {
                  const on = chapterIds.includes(c.chapterId);
                  return (
                    <button
                      key={c.chapterId}
                      type="button"
                      className={`chapchip${on ? " on" : ""}`}
                      aria-pressed={on}
                      disabled={c.approved === 0}
                      title={`${c.approved} question${c.approved === 1 ? "" : "s"} to draw from`}
                      onClick={() => toggleChapter(c.chapterId)}
                    >
                      {on && <Icon name="tick" size={13} className="chapchip-tick" />}
                      {c.name}
                      <span className={`cnt${c.approved < THIN ? " thin" : ""}`}>{c.approved}</span>
                    </button>
                  );
                })}
              </div>
              <div className="pb-links">
                <button type="button" className="pb-link" onClick={() => setChapterIds(usable.map((c) => c.chapterId))}>Select all</button>
                <span aria-hidden="true">·</span>
                <button type="button" className="pb-link" onClick={() => setChapterIds([])}>Clear</button>
                <span className="pb-note inline">The number is how many questions a chapter has.</span>
              </div>
            </>
          )}
        </section>

        <section className="pb-step">
          <h3 className="pb-h"><span className="pb-n">3</span>Paper pattern</h3>
          <Dropdown id="pat" label="Paper pattern" value={layoutSel} onChange={(v) => chooseLayout(v as LayoutSel)} options={layoutOptions} />
          {current && (
            <div className="pb-sections">
              {current.sections.map((s, i) => (
                <div key={i} className="pb-secrow">
                  <span className="pb-seclabel">{sectionLabel(i)}</span>
                  <span className="pb-secwhat">{s.questionCount} × {kindLabel(s.questionTypes, s.requiresStimulus)}{s.allowChoice ? " · choice" : ""}</span>
                  <span className="pb-secmk">{s.questionCount * s.marksEach}</span>
                </div>
              ))}
              <div className="pb-secrow total">
                <span />
                <span className="pb-secwhat">{totals.questions} questions{current.durationMin ? ` · ${current.durationMin} min` : ""}</span>
                <span className="pb-secmk">{totals.marks}</span>
              </div>
            </div>
          )}
          <div className="pb-links">
            <button type="button" className="pb-link" onClick={layoutSel === "custom" ? () => setEditorOpen((o) => !o) : customiseCurrent} disabled={!current}>
              <Icon name="pencil" size={13} />
              {layoutSel === "custom" ? (editorOpen ? "Hide the section editor" : "Edit sections") : "Change sections"}
            </button>
            {storedPattern?.canRemove && (
              <button
                type="button"
                className="pb-link quiet"
                disabled={removing}
                onClick={() =>
                  startRemove(async () => {
                    const res = await removeSavedLayout(storedPattern.id);
                    if (res.ok) {
                      setLayoutSel(`t:${QUICK_TEMPLATES[0]!.key}`);
                      router.refresh();
                    } else setSaveError(res.message ?? "Could not remove it.");
                  })
                }
              >
                {removing ? "Removing…" : "Remove from our list"}
              </button>
            )}
          </div>
        </section>

        <section className="pb-step">
          <h3 className="pb-h"><span className="pb-n">4</span>Difficulty</h3>
          <div className="seg pb-seg" role="group" aria-label="Difficulty mix">
            {SPLITS.map((s, i) => (
              <button key={s.label} type="button" className={i === splitIdx ? "on" : ""} aria-pressed={i === splitIdx} onClick={() => setSplitIdx(i)}>
                {s.label}
              </button>
            ))}
            <button type="button" className={splitIdx === -1 ? "on" : ""} aria-pressed={splitIdx === -1} onClick={() => setSplitIdx(-1)}>
              My own
            </button>
          </div>
          <div className="pb-mix" aria-hidden="true">
            <span className="e" style={{ flexGrow: split.easy }} />
            <span className="m" style={{ flexGrow: split.medium }} />
            <span className="h" style={{ flexGrow: split.hard }} />
          </div>
          <p className="pb-mixkey">
            <span className="e">Easy {Math.round(split.easy * 100)}%</span>
            <span className="m">Medium {Math.round(split.medium * 100)}%</span>
            <span className="h">Hard {Math.round(split.hard * 100)}%</span>
          </p>
          {splitIdx === -1 && (
            <div className="pb-own">
              <div className="mixedit">
                {(["easy", "medium", "hard"] as const).map((k) => (
                  <label key={k} className={`mixin ${k[0]}`}>
                    <span>{k} %</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      step={5}
                      className="inp"
                      value={customPct[k]}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                        const next = { ...customPct, [k]: v };
                        setCustomPct(next);
                        if (next.easy + next.medium + next.hard === 100) setLastGoodCustom(next);
                      }}
                    />
                  </label>
                ))}
              </div>
              <p className={`pb-note${customSum === 100 ? "" : " bad"}`}>
                {customSum === 100 ? "Adds up to 100%." : `Adds up to ${customSum}% — it must be 100% to apply.`}
              </p>
            </div>
          )}
        </section>

        <section className="pb-step">
          <h3 className="pb-h"><span className="pb-n">5</span>Copies</h3>
          <div className="seg pb-seg" role="group" aria-label="Different versions to print">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" className={setCount === n ? "on" : ""} aria-pressed={setCount === n} onClick={() => setSetCount(n)}>
                {n === 1 ? "One version" : `${n} sets`}
              </button>
            ))}
          </div>
          <p className="pb-note">
            {setCount === 1
              ? "Everyone gets the same paper."
              : preview?.ok
                ? `Same questions, shuffled into ${setCount} orders, so neighbours have different papers. For ${selectedBatch?.students ?? 40} students: ${preview.copies.map((c, i) => `${String.fromCharCode(65 + i)} ${c}`).join(", ")}. Hand out A, B, C… along each row.`
                : `Same questions, shuffled into ${setCount} orders, so neighbours have different papers.`}
          </p>
          {setCount > 1 && preview?.ok && preview.warnings.length > 0 && (
            <div className="notice warn pb-tight">
              {preview.warnings.map((w) => (
                <div key={w.section}>
                  Section {w.section} has {w.blocks} question{w.blocks === 1 ? "" : "s"}, so some sets share its order.
                </div>
              ))}
            </div>
          )}
        </section>

        {relaxed.length > 0 && (
          <div className="pb-relaxed">
            {relaxed.map((r) => (
              <div key={r} className="notice warn pb-tight pb-relaxrow">
                <span><b>{RELAX_COPY[r].active}.</b> You chose this.</span>
                <button type="button" className="btn sm ghost" onClick={() => setRelaxed((cur) => cur.filter((x) => x !== r))}>Undo</button>
              </div>
            ))}
          </div>
        )}

        <details className="pb-more" open={(bundle.strands.length >= 2 && strandOn) || undefined}>
          <summary>
            <Icon name="chevronRight" size={14} className="pb-more-chev" />
            More settings
          </summary>
          <div className="pb-morebody">
            <label className="pb-switchrow">
              <span>
                <b>Skip recent questions</b>
                <span>Leave out anything used in your last 3 papers.</span>
              </span>
              <span className={`switch${repeatGuard ? " on" : ""}`}>
                <input type="checkbox" checked={repeatGuard} onChange={(e) => setRepeatGuard(e.target.checked)} />
                <span className="knob" />
              </span>
            </label>
            {bundle.strands.length >= 2 && (
              <>
                <label className="pb-switchrow">
                  <span>
                    <b>Strand balance</b>
                    <span>Hold each strand to a share of the questions.</span>
                  </span>
                  <span className={`switch${strandOn ? " on" : ""}`}>
                    <input type="checkbox" checked={strandOn} onChange={(e) => setStrandOn(e.target.checked)} />
                    <span className="knob" />
                  </span>
                </label>
                {strandOn && (
                  <div className="pb-strands">
                    {bundle.strands.map((st) => (
                      <div key={st.id} className="pb-strand">
                        <label htmlFor={`strand-${st.id}`}>{st.name}</label>
                        <input
                          id={`strand-${st.id}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={100}
                          step={5}
                          className="inp"
                          value={strandPct[st.id] ?? 0}
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)));
                            setStrandPct((cur) => ({ ...cur, [st.id]: v }));
                          }}
                        />
                        <span>%</span>
                      </div>
                    ))}
                    <p className={`pb-note${strandSum === 100 ? "" : " bad"}`}>
                      {strandSum === 100 ? "Adds up to 100%." : `Adds up to ${strandSum}% — it must be 100% to apply.`}{" "}
                      <button type="button" className="pb-link" onClick={() => setStrandPct(evenSplit(bundle.strands))}>Split evenly</button>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </details>
      </div>

      {/* ============================ the paper (right) ============================ */}
      <section className="pb-paper" aria-label="Your paper">
        <div className="pb-bar">
          <div className="pb-status" aria-live="polite">
            {loading ? (
              <span className="pb-busy"><span className="pb-spin" aria-hidden="true" />Building…</span>
            ) : preview?.ok ? (
              <>
                <span className="pb-chip"><b>{placed}</b> questions</span>
                <span className="pb-chip"><b>{preview.totalMarks}</b> marks</span>
                <span className="pb-chip" title="Actual easy / medium / hard">
                  <i className="e" />{Math.round(preview.difficultyActual.easy * 100)}
                  <i className="m" />{Math.round(preview.difficultyActual.medium * 100)}
                  <i className="h" />{Math.round(preview.difficultyActual.hard * 100)}
                </span>
                {locked.length > 0 && <span className="pb-chip"><Icon name="lock" size={12} />{locked.length} kept</span>}
              </>
            ) : preview ? (
              <span className="pb-chip bad">Needs a change</span>
            ) : (
              <span className="pb-busy"><span className="pb-spin" aria-hidden="true" />Building a first paper…</span>
            )}
          </div>
          <div className="pb-actions">
            <button type="button" className="btn ghost pb-shuffle" onClick={regenerate} disabled={loading || !layoutChoice} title="Pick different questions (kept ones stay)">
              <Icon name="swap" size={15} className={loading ? "pb-spinning" : undefined} />
              <span>New questions</span>
            </button>
            <button type="button" className="gen pb-save" onClick={save} disabled={saving || !preview?.ok}>
              <Icon name="printer" size={16} />
              {saving ? "Saving…" : "Save and print"}
            </button>
          </div>
        </div>
        {saveError && <div className="notice warn pb-tight pb-err">{saveError}</div>}

        {layoutSel === "custom" && custom && editorOpen && (
          <div className="pb-editor">
            <LayoutEditor
              layout={custom}
              onChange={editCustom}
              availability={availability}
              saveAsTemplate={saveAsTemplate}
              onSaveAsTemplate={setSaveAsTemplate}
              onClose={() => setEditorOpen(false)}
            />
          </div>
        )}

        <div className={`pb-sheet${loading ? " busy" : ""}`}>
          <div className="pb-titlewrap">
            <input
              className="pb-title"
              id="title"
              aria-label="Paper title"
              value={title}
              maxLength={120}
              placeholder={current?.name ?? "Unit test"}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Icon name="pencil" size={14} className="pb-titleicon" />
          </div>
          <div className="pb-sub">
            {bundle.label} · {totals.marks} marks{current?.durationMin ? ` · ${current.durationMin} min` : ""}
            {setCount > 1 ? ` · ${setCount} sets` : ""}
          </div>

          {!preview && (
            <div className="pb-skel" aria-hidden="true">
              <span /><span /><span className="short" /><span /><span className="short" />
            </div>
          )}

          {preview && !preview.ok && (
            <div className="pb-fail">
              <div className="notice warn">
                <b>This paper can&rsquo;t be built yet.</b> {preview.reason}
              </div>
              {preview.shortfall.length > 0 && (
                <div className="tablewrap pb-short">
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
              <h3 className="blk">Pick one to fix it</h3>
              <div className="pb-fixes">
                <div className="pb-fix">
                  <b>Add more chapters</b>
                  <span>Tick more chapters on the left. Usually the best fix.</span>
                </div>
                {preview.suggestions
                  .filter((s): s is typeof s & { relax: Relax } => s.relax !== "repeat_guard")
                  .map((s) => (
                    <button key={s.relax} type="button" className="pb-fix act" onClick={() => setRelaxed((cur) => (cur.includes(s.relax) ? cur : [...cur, s.relax]))}>
                      <b>{RELAX_COPY[s.relax].action}</b>
                      <span>
                        {RELAX_COPY[s.relax].effect}{" "}
                        {s.would_yield > 0 ? `Fills ${s.would_yield} more question${s.would_yield === 1 ? "" : "s"}.` : "Lets this paper through."}
                      </span>
                    </button>
                  ))}
                {repeatGuard && (
                  <button type="button" className="pb-fix act" onClick={() => setRepeatGuard(false)}>
                    <b>Allow recent questions</b>
                    <span>Brings back questions used in your last 3 papers.</span>
                  </button>
                )}
              </div>
              <p className="pb-note">Nothing is relaxed unless you click it, and you can undo it on the left.</p>
            </div>
          )}

          {preview?.ok && (
            <div className="pb-qs">
              {preview.unappliedSwaps > 0 && (
                <div className="notice plain pb-tight">
                  {preview.unappliedSwaps} swap{preview.unappliedSwaps === 1 ? "" : "s"} could not be applied: no other question has the same marks, chapter and difficulty.
                </div>
              )}
              {current?.generalInstructions && <p className="pvgeneral">{current.generalInstructions}</p>}
              {preview.sections.map((section, si) => (
                <div key={section.label} className="pb-section">
                  <p className="qsec">
                    Section {section.label} · {section.marksEach} mark{section.marksEach === 1 ? "" : "s"} each
                    {(current?.sections[si]?.instructions ?? section.instructions) && (
                      <span className="qsec-ins"> — {current?.sections[si]?.instructions ?? section.instructions}</span>
                    )}
                  </p>
                  {section.blocks.map((b) => {
                    counter += 1;
                    const n = counter;
                    const isLocked = lockedSet.has(b.key);
                    return (
                      <div className={`q pb-q${isLocked ? " locked" : ""}`} key={b.key}>
                        <span className="no">{n}.</span>
                        <div className="body">
                          {b.stimulusHtml && (
                            <div className="stimulus">
                              <span className="kind">Read the following and answer the questions</span>
                              <div dangerouslySetInnerHTML={{ __html: b.stimulusHtml }} />
                            </div>
                          )}
                          {b.questions.map((q, i) => (
                            <div key={q.id} className="pb-part">
                              {b.questions.length > 1 && <span className="pb-partno">({String.fromCharCode(97 + i)})</span>}
                              <span dangerouslySetInnerHTML={{ __html: q.html }} />
                            </div>
                          ))}
                          {b.choice && (
                            <div className="pb-or">
                              <span>OR </span>
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
                            {isLocked && <span className="tag lock">Kept</span>}
                          </div>
                        </div>
                        <span className="mk">{b.marks}</span>
                        <div className="pb-qacts">
                          <button
                            type="button"
                            className={`pb-qbtn${isLocked ? " on" : ""}`}
                            data-tip={isLocked ? "Let it change" : "Keep this question"}
                            aria-label={isLocked ? "Let this question change" : "Keep this question when picking new ones"}
                            aria-pressed={isLocked}
                            onClick={() => setLocked((cur) => (cur.includes(b.key) ? cur.filter((k) => k !== b.key) : [...cur, b.key]))}
                          >
                            <Icon name="lock" size={15} />
                          </button>
                          <button
                            type="button"
                            className="pb-qbtn"
                            data-tip="Swap for a similar one"
                            aria-label="Swap for another with the same marks, chapter and difficulty"
                            disabled={isLocked || loading}
                            onClick={() => setSwaps((s) => [...s, { blockKey: b.key, sectionLabel: section.label }])}
                          >
                            <Icon name="swap" size={15} />
                          </button>
                          <button
                            type="button"
                            className={`pb-qbtn${flagging === b.key ? " on" : ""}`}
                            data-tip="Report a problem"
                            aria-label="Flag as wrong or badly worded"
                            aria-expanded={flagging === b.key}
                            disabled={loading}
                            onClick={() => {
                              setFlagging(flagging === b.key ? null : b.key);
                              setFlagReason("");
                              setFlagError(null);
                            }}
                          >
                            <Icon name="flag" size={15} />
                          </button>
                        </div>
                        {flagging === b.key && (
                          <div className="pb-flag">
                            <div className="pb-flagrow">
                              <input
                                className="inp"
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
                            <p className="pb-note">It leaves your institute&rsquo;s papers now; the shared bank keeps it until the platform reviews it.</p>
                            {flagError && <p className="pb-note bad">{flagError}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              <p className="pb-foot">
                {preview.poolSize} questions were eligible.
                {preview.forcedTopicRepeats > 0 ? ` ${preview.forcedTopicRepeats} topic${preview.forcedTopicRepeats === 1 ? "" : "s"} had to repeat.` : ""}{" "}
                Saved papers stay hidden from students until you mark them as conducted.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
