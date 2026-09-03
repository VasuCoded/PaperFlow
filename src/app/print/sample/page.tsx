import { QuestionPaper } from "@/components/print/QuestionPaper";
import { AnswerKey } from "@/components/print/AnswerKey";
import { MappingSheet } from "@/components/print/MappingSheet";
import { buildSampleModel, type AnswerKeyModel, type MappingSheetModel } from "@/lib/print/model";

/**
 * C7 print preview with sample data. Renders exactly what prints. In the real
 * app this route is /teacher/papers/[id]/print with a set selector and data from
 * the DB. "Print everything" = all set papers, then all keys, then the mapping
 * sheet, as one document.
 */
export default function PrintSamplePage() {
  const setLabels = ["A", "B", "C"];
  const papers = setLabels.map((l) => buildSampleModel(l));

  const keys: AnswerKeyModel[] = setLabels.map((l) => ({
    instituteName: "Sunrise Coaching Classes",
    title: "Unit Test 1 — Chemical Reactions",
    setLabel: l,
    entries: [
      { displayNumber: "1", answer: "(A) Fe + CuSO₄ → FeSO₄ + Cu", marks: 1 },
      { displayNumber: "2", answer: "(A) लवाइज़िए", marks: 1, script: "devanagari" },
      { displayNumber: "3", partLabel: "(a)", answer: "Displacement reaction", marks: 1 },
      { displayNumber: "3", partLabel: "(b)", answer: "Cu²⁺ ions enter solution", marks: 2 },
      { displayNumber: "3", partLabel: "(c)", answer: "Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag", marks: 2 },
    ],
  }));

  const mapping: MappingSheetModel = {
    instituteName: "Sunrise Coaching Classes",
    title: "Unit Test 1 — Chemical Reactions",
    setLabels,
    copies: { A: 14, B: 13, C: 13 },
    rows: [
      { canonicalNumber: 1, positionInSet: { A: 1, B: 2, C: 1 }, answer: "(A)", marks: 1 },
      { canonicalNumber: 2, positionInSet: { A: 2, B: 1, C: 2 }, answer: "(A)", marks: 1 },
      { canonicalNumber: 3, positionInSet: { A: 3, B: 3, C: 3 }, answer: "see key", marks: 5 },
    ],
  };

  return (
    <main>
      <div className="pf-no-print" style={{ padding: 16, fontFamily: "system-ui" }}>
        <strong>Print preview (sample data).</strong> Use your browser&apos;s Print to PDF to
        check A4 layout, the set badge, page breaks, and Devanagari matra positioning.
      </div>
      {papers.map((p) => (
        <QuestionPaper key={p.setLabel} model={p} />
      ))}
      {keys.map((k) => (
        <AnswerKey key={k.setLabel} model={k} />
      ))}
      <MappingSheet model={mapping} />
    </main>
  );
}
