"use client";

import {
  availableFor,
  defaultInstructions,
  kindByKey,
  kindForTypes,
  layoutTotals,
  LIMITS,
  marksOnOffer,
  QUESTION_KINDS,
  sectionFromKind,
  sectionLabel,
  type AvailabilityRow,
  type CustomLayout,
  type LayoutSection,
} from "@/lib/paper-layout";

/**
 * The full-width editor for a custom paper layout: one row per section, with
 * how many matching questions the ticked chapters actually hold, so "100 MCQs
 * from one chapter" shows up as impossible before anyone presses Generate.
 */
export function LayoutEditor({
  layout,
  onChange,
  availability,
  saveAsTemplate,
  onSaveAsTemplate,
  onClose,
}: {
  layout: CustomLayout;
  onChange: (next: CustomLayout) => void;
  /** null until the first preview has come back */
  availability: AvailabilityRow[] | null;
  saveAsTemplate: boolean;
  onSaveAsTemplate: (on: boolean) => void;
  onClose: () => void;
}) {
  const totals = layoutTotals(layout.sections);

  function setSection(i: number, patch: Partial<LayoutSection>) {
    const old = layout.sections[i]!;
    const next = { ...old, ...patch };
    // Instructions follow the kind and marks until the teacher writes their own.
    if (old.instructions === defaultInstructions(old)) next.instructions = defaultInstructions(next);
    onChange({ ...layout, sections: layout.sections.map((s, j) => (j === i ? next : s)) });
  }

  function setKind(i: number, key: string) {
    const kind = kindByKey(key);
    if (!kind) return;
    const offered = availability ? marksOnOffer({ questionTypes: kind.types, requiresStimulus: kind.stimulus }, availability) : [];
    const current = layout.sections[i]!.marksEach;
    setSection(i, {
      questionTypes: kind.types,
      requiresStimulus: kind.stimulus,
      practiceEligible: kind.practice,
      // keep the marks if this kind has questions of those marks; otherwise the most common
      marksEach: offered.length === 0 || offered.some((o) => o.marks === current)
        ? current
        : [...offered].sort((a, b) => b.count - a.count)[0]!.marks,
    });
  }

  function move(i: number, by: -1 | 1) {
    const j = i + by;
    if (j < 0 || j >= layout.sections.length) return;
    const sections = [...layout.sections];
    [sections[i], sections[j]] = [sections[j]!, sections[i]!];
    onChange({ ...layout, sections });
  }

  // Kinds worth offering: the ones these chapters hold, plus whatever is chosen.
  const offeredKinds = QUESTION_KINDS.filter(
    (k) =>
      !availability ||
      marksOnOffer({ questionTypes: k.types, requiresStimulus: k.stimulus }, availability).length > 0 ||
      layout.sections.some((s) => kindForTypes(s.questionTypes, s.requiresStimulus)?.key === k.key),
  );

  const num = (v: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(v) || min)));

  return (
    <div className="layouted">
      <div className="layouted-head">
        <div>
          <h3 className="blk" style={{ margin: 0 }}>Paper layout</h3>
          <p className="layouted-sub">
            {totals.questions} question{totals.questions === 1 ? "" : "s"} · <b>{totals.marks} marks</b>
            {layout.durationMin ? ` · ${layout.durationMin} min` : " · no time limit"}
          </p>
        </div>
        <button type="button" className="btn sm ghost" onClick={onClose}>Done</button>
      </div>

      <div className="layouted-meta">
        <div className="field">
          <label htmlFor="lay-name">Layout name</label>
          <input id="lay-name" className="inp" maxLength={LIMITS.name} value={layout.name} onChange={(e) => onChange({ ...layout, name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="lay-time">Time (minutes)</label>
          <input
            id="lay-time"
            className="inp"
            type="number"
            inputMode="numeric"
            min={LIMITS.durationMin}
            max={LIMITS.durationMax}
            placeholder="No limit"
            value={layout.durationMin ?? ""}
            onChange={(e) =>
              onChange({ ...layout, durationMin: e.target.value === "" ? null : num(e.target.value, LIMITS.durationMin, LIMITS.durationMax) })
            }
          />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="lay-gen">General instructions (printed under the header)</label>
          <textarea
            id="lay-gen"
            className="inp"
            rows={2}
            maxLength={LIMITS.generalInstructions}
            value={layout.generalInstructions}
            placeholder="e.g. All questions are compulsory."
            onChange={(e) => onChange({ ...layout, generalInstructions: e.target.value })}
          />
        </div>
      </div>

      <div className="tablewrap">
        <table className="lt layouted-table">
          <thead>
            <tr>
              <th>Section</th>
              <th>Kind of question</th>
              <th className="num">Questions</th>
              <th className="num">Marks each</th>
              <th>Either / or</th>
              <th>Instructions</th>
              <th className="num">Available</th>
              <th aria-label="Arrange" />
            </tr>
          </thead>
          <tbody>
            {layout.sections.map((s, i) => {
              const kind = kindForTypes(s.questionTypes, s.requiresStimulus);
              const need = s.questionCount * (s.allowChoice ? 2 : 1);
              const have = availability ? availableFor(s, availability) : null;
              const offered = availability ? marksOnOffer(s, availability) : [];
              return (
                <tr key={i}>
                  <td className="mono">{sectionLabel(i)}</td>
                  <td>
                    <select className="sel" value={kind?.key ?? ""} onChange={(e) => setKind(i, e.target.value)} aria-label={`Section ${sectionLabel(i)} kind of question`}>
                      {!kind && <option value="">{s.questionTypes.join(" / ")}</option>}
                      {offeredKinds.map((k) => (
                        <option key={k.key} value={k.key}>{k.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    <input
                      className="inp"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={LIMITS.questionsPerSection}
                      value={s.questionCount}
                      onChange={(e) => setSection(i, { questionCount: num(e.target.value, 1, LIMITS.questionsPerSection) })}
                      aria-label={`Section ${sectionLabel(i)} number of questions`}
                    />
                  </td>
                  <td className="num">
                    <input
                      className="inp"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={LIMITS.marksEach}
                      value={s.marksEach}
                      onChange={(e) => setSection(i, { marksEach: num(e.target.value, 1, LIMITS.marksEach) })}
                      aria-label={`Section ${sectionLabel(i)} marks each`}
                    />
                    {offered.length > 0 && (
                      <div className="markpicks">
                        {offered.map((o) => (
                          <button
                            key={o.marks}
                            type="button"
                            className={`markpick${o.marks === s.marksEach ? " on" : ""}`}
                            title={`${o.count} question${o.count === 1 ? "" : "s"} of ${o.marks} mark${o.marks === 1 ? "" : "s"} in these chapters`}
                            onClick={() => setSection(i, { marksEach: o.marks })}
                          >
                            {o.marks}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <label className="check" style={{ margin: 0 }}>
                      <input type="checkbox" checked={s.allowChoice} onChange={(e) => setSection(i, { allowChoice: e.target.checked })} />
                      Internal choice
                    </label>
                  </td>
                  <td>
                    <input
                      className="inp"
                      maxLength={LIMITS.instructions}
                      value={s.instructions}
                      onChange={(e) => setSection(i, { instructions: e.target.value })}
                      aria-label={`Section ${sectionLabel(i)} instructions`}
                    />
                  </td>
                  <td className="num">
                    {have === null ? (
                      "…"
                    ) : (
                      <span className={have >= need ? "avail ok" : "avail short"} title={s.allowChoice ? "Internal choice needs two questions per position." : undefined}>
                        {have}
                        {have < need ? ` / ${need} needed` : ""}
                      </span>
                    )}
                  </td>
                  <td className="rowacts">
                    <button type="button" className="iconbtn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button type="button" className="iconbtn" title="Move down" disabled={i === layout.sections.length - 1} onClick={() => move(i, 1)}>↓</button>
                    <button
                      type="button"
                      className="iconbtn"
                      title="Remove this section"
                      disabled={layout.sections.length === 1}
                      onClick={() => onChange({ ...layout, sections: layout.sections.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="btnrow" style={{ marginTop: 10, justifyContent: "space-between", alignItems: "center" }}>
        <button
          type="button"
          className="btn sm ghost"
          disabled={layout.sections.length >= LIMITS.sections}
          onClick={() => onChange({ ...layout, sections: [...layout.sections, sectionFromKind(offeredKinds[0]?.key ?? "objective", 5, 1)] })}
        >
          + Add a section
        </button>
        <label className="toggle" style={{ margin: 0 }}>
          <input type="checkbox" checked={saveAsTemplate} onChange={(e) => onSaveAsTemplate(e.target.checked)} />
          Save this layout for my institute when I save the paper
        </label>
      </div>
      {totals.questions > LIMITS.questionsTotal && (
        <div className="notice warn" style={{ marginTop: 10, marginBottom: 0 }}>
          A paper can have at most {LIMITS.questionsTotal} questions; this layout has {totals.questions}.
        </div>
      )}
    </div>
  );
}
