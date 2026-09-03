/**
 * Print models (BUILD-PLAN C7). Decoupled from the DB so the print components
 * are pure and reviewable. The institute name and logo ALWAYS come from the
 * institutes row — printing institute A's name on institute B's paper ends a
 * customer relationship in one afternoon (§C7 item 1), so it is data, never a
 * constant.
 */
export type Script = "latin" | "devanagari";

export interface PrintOption {
  letter: string; // as printed for this set (already shuffled if applicable)
  text: string;
}

export interface PrintQuestion {
  displayNumber: string; // e.g. "1", "6"
  partLabel?: string; // e.g. "(a)"
  body: string;
  marks: number;
  options?: PrintOption[];
  script?: Script;
}

export interface PrintStimulus {
  kind: string; // passage | case_study | source_extract | map | data_table | diagram
  body: string;
  script?: Script;
  imageUrl?: string | null;
}

export interface PrintBlock {
  stimulus?: PrintStimulus;
  questions: PrintQuestion[];
  positionLocked?: boolean;
}

export interface PrintSection {
  label: string;
  instructions?: string;
  blocks: PrintBlock[];
}

export interface PaperPrintModel {
  instituteName: string;
  instituteLogoUrl?: string | null;
  className: string;
  subjectName: string;
  title: string;
  totalMarks: number;
  durationMin?: number;
  setLabel: string;
  setCount: number;
  sections: PrintSection[];
}

export interface AnswerKeyEntry {
  displayNumber: string;
  partLabel?: string;
  answer: string;
  marks: number;
  script?: Script;
}
export interface AnswerKeyModel {
  instituteName: string;
  title: string;
  setLabel: string;
  entries: AnswerKeyEntry[];
}

export interface MappingRow {
  canonicalNumber: number;
  /** setLabel -> display position (1-based) in that set */
  positionInSet: Record<string, number>;
  answer: string;
  marks: number;
}
export interface MappingSheetModel {
  instituteName: string;
  title: string;
  setLabels: string[];
  rows: MappingRow[];
  /** copies per set, e.g. { A: 14, B: 13, C: 13 } */
  copies: Record<string, number>;
}

// ---------------------------------------------------------------------------
// A sample model for the print preview and for eyeballing layout, including a
// Devanagari question and a comprehension stimulus block (both are the cases
// that only reveal problems on paper — §2.2, §C7).
// ---------------------------------------------------------------------------
export function buildSampleModel(setLabel = "A"): PaperPrintModel {
  return {
    instituteName: "Sunrise Coaching Classes",
    instituteLogoUrl: null,
    className: "10",
    subjectName: "Science",
    title: "Unit Test 1 — Chemical Reactions",
    totalMarks: 25,
    durationMin: 60,
    setLabel,
    setCount: 3,
    sections: [
      {
        label: "A",
        instructions: "Objective questions. 1 mark each.",
        blocks: [
          {
            questions: [
              {
                displayNumber: "1",
                body: "Which of the following is a displacement reaction?",
                marks: 1,
                options: [
                  { letter: "A", text: "Fe + CuSO₄ → FeSO₄ + Cu" },
                  { letter: "B", text: "H₂ + Cl₂ → 2HCl" },
                  { letter: "C", text: "CaCO₃ → CaO + CO₂" },
                  { letter: "D", text: "NaOH + HCl → NaCl + H₂O" },
                ],
              },
            ],
          },
          {
            questions: [
              {
                displayNumber: "2",
                body: "संतुलित समीकरण में द्रव्यमान संरक्षण का नियम किसने दिया?",
                marks: 1,
                script: "devanagari",
                options: [
                  { letter: "A", text: "लवाइज़िए" },
                  { letter: "B", text: "डाल्टन" },
                  { letter: "C", text: "रदरफोर्ड" },
                  { letter: "D", text: "बोर" },
                ],
              },
            ],
          },
        ],
      },
      {
        label: "B",
        instructions: "Case-based question. Read the passage and answer.",
        blocks: [
          {
            stimulus: {
              kind: "case_study",
              body:
                "When a strip of copper is placed in silver nitrate solution, the " +
                "solution slowly turns blue and shining silver deposits on the copper. " +
                "This is an example of a displacement reaction driven by the reactivity series.",
            },
            questions: [
              { displayNumber: "3", partLabel: "(a)", body: "Name the type of reaction.", marks: 1 },
              { displayNumber: "3", partLabel: "(b)", body: "Why does the solution turn blue?", marks: 2 },
              { displayNumber: "3", partLabel: "(c)", body: "Write the balanced equation.", marks: 2 },
            ],
          },
        ],
      },
    ],
  };
}
