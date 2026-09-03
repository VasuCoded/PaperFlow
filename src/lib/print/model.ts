/**
 * Print models (BUILD-PLAN C7). Decoupled from the DB so the print components
 * are pure and reviewable. The institute name and logo ALWAYS come from the
 * institutes row — printing institute A's name on institute B's paper ends a
 * customer relationship in one afternoon (§C7 item 1), so it is data, never a
 * constant.
 *
 * Question and answer text may carry TeX between $...$ (inline) or $$...$$
 * (display); see lib/print/math.ts. Chemistry uses \ce{...} via mhchem.
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

const INSTITUTE = "Sunrise Coaching Classes";

// ---------------------------------------------------------------------------
// Sample: Class 10 Science unit test. English throughout — a Science paper is
// a Science paper. Notation is the point here: lens/mirror formulae, Ohm's law
// and balanced chemical equations must all survive the printer.
// ---------------------------------------------------------------------------
export function buildSampleModel(setLabel = "A"): PaperPrintModel {
  return {
    instituteName: INSTITUTE,
    instituteLogoUrl: null,
    className: "10",
    subjectName: "Science",
    title: "Unit Test 1 — Reactions, Light & Current",
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
                  { letter: "A", text: "$\\ce{Fe + CuSO4 -> FeSO4 + Cu}$" },
                  { letter: "B", text: "$\\ce{H2 + Cl2 -> 2HCl}$" },
                  { letter: "C", text: "$\\ce{CaCO3 ->[\\Delta] CaO + CO2}$" },
                  { letter: "D", text: "$\\ce{NaOH + HCl -> NaCl + H2O}$" },
                ],
              },
            ],
          },
          {
            questions: [
              {
                displayNumber: "2",
                body:
                  "An object is placed $20\\ \\mathrm{cm}$ in front of a concave mirror of " +
                  "focal length $15\\ \\mathrm{cm}$. The image distance $v$ is:",
                marks: 1,
                options: [
                  { letter: "A", text: "$+60\\ \\mathrm{cm}$" },
                  { letter: "B", text: "$-60\\ \\mathrm{cm}$" },
                  { letter: "C", text: "$-8.6\\ \\mathrm{cm}$" },
                  { letter: "D", text: "$+8.6\\ \\mathrm{cm}$" },
                ],
              },
            ],
          },
          {
            questions: [
              {
                displayNumber: "3",
                body:
                  "Three resistors of $2\\,\\Omega$, $3\\,\\Omega$ and $6\\,\\Omega$ are connected " +
                  "in parallel. The equivalent resistance is:",
                marks: 1,
                options: [
                  { letter: "A", text: "$1\\,\\Omega$" },
                  { letter: "B", text: "$11\\,\\Omega$" },
                  { letter: "C", text: "$\\frac{11}{6}\\,\\Omega$" },
                  { letter: "D", text: "$\\frac{6}{11}\\,\\Omega$" },
                ],
              },
            ],
          },
        ],
      },
      {
        label: "B",
        instructions: "Short answer. Show your working.",
        blocks: [
          {
            questions: [
              {
                displayNumber: "4",
                body:
                  "Balance the equation and identify the type of reaction:\n" +
                  "$$\\ce{Fe + H2O -> Fe3O4 + H2}$$",
                marks: 3,
              },
            ],
          },
          {
            questions: [
              {
                displayNumber: "5",
                body:
                  "A convex lens forms a real image at $30\\ \\mathrm{cm}$ when the object is at " +
                  "$20\\ \\mathrm{cm}$. Using the lens formula " +
                  "$$\\frac{1}{f} = \\frac{1}{v} - \\frac{1}{u}$$ " +
                  "find the focal length $f$ and the magnification $m$.",
                marks: 3,
              },
            ],
          },
        ],
      },
      {
        label: "C",
        instructions: "Case-based question. Read the passage and answer.",
        blocks: [
          {
            stimulus: {
              kind: "case_study",
              body:
                "A strip of copper is dipped into silver nitrate solution. Over an hour the " +
                "colourless solution turns pale blue and a greyish-white deposit forms on the " +
                "copper. A student measures the current through a $4\\,\\Omega$ coil in the same " +
                "circuit as $1.5\\ \\mathrm{A}$.",
            },
            questions: [
              {
                displayNumber: "6",
                partLabel: "(a)",
                body: "Write the balanced equation for the reaction and name its type.",
                marks: 2,
              },
              {
                displayNumber: "6",
                partLabel: "(b)",
                body: "Why does the solution turn blue?",
                marks: 2,
              },
              {
                displayNumber: "6",
                partLabel: "(c)",
                body:
                  "Using $P = I^{2}R$, calculate the power dissipated in the coil.",
                marks: 2,
              },
            ],
          },
        ],
      },
    ],
  };
}

export function buildSampleKey(setLabel: string): AnswerKeyModel {
  return {
    instituteName: INSTITUTE,
    title: "Unit Test 1 — Reactions, Light & Current",
    setLabel,
    entries: [
      { displayNumber: "1", answer: "(A) $\\ce{Fe + CuSO4 -> FeSO4 + Cu}$", marks: 1 },
      { displayNumber: "2", answer: "(B) $v = -60\\ \\mathrm{cm}$", marks: 1 },
      { displayNumber: "3", answer: "(A) $1\\,\\Omega$", marks: 1 },
      { displayNumber: "4", answer: "$\\ce{3Fe + 4H2O -> Fe3O4 + 4H2}$ — displacement", marks: 3 },
      { displayNumber: "5", answer: "$f = 12\\ \\mathrm{cm}$, $m = -1.5$", marks: 3 },
      { displayNumber: "6", partLabel: "(a)", answer: "$\\ce{Cu + 2AgNO3 -> Cu(NO3)2 + 2Ag}$ — displacement", marks: 2 },
      { displayNumber: "6", partLabel: "(b)", answer: "$\\ce{Cu^2+}$ ions pass into solution", marks: 2 },
      { displayNumber: "6", partLabel: "(c)", answer: "$P = (1.5)^2 \\times 4 = 9\\ \\mathrm{W}$", marks: 2 },
    ],
  };
}

export function buildSampleMapping(setLabels: string[]): MappingSheetModel {
  return {
    instituteName: INSTITUTE,
    title: "Unit Test 1 — Reactions, Light & Current",
    setLabels,
    copies: { A: 14, B: 13, C: 13 },
    rows: [
      { canonicalNumber: 1, positionInSet: { A: 1, B: 3, C: 2 }, answer: "(A)", marks: 1 },
      { canonicalNumber: 2, positionInSet: { A: 2, B: 1, C: 3 }, answer: "(B)", marks: 1 },
      { canonicalNumber: 3, positionInSet: { A: 3, B: 2, C: 1 }, answer: "(A)", marks: 1 },
      { canonicalNumber: 4, positionInSet: { A: 4, B: 5, C: 4 }, answer: "see key", marks: 3 },
      { canonicalNumber: 5, positionInSet: { A: 5, B: 4, C: 5 }, answer: "see key", marks: 3 },
      { canonicalNumber: 6, positionInSet: { A: 6, B: 6, C: 6 }, answer: "see key", marks: 6 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Sample: Class 10 HINDI — Hindi as its own SUBJECT, not a translation of a
// Science paper. This is the paper that proves Devanagari matra positioning on
// a real printer (§2.2). It is a separate document, printed separately.
// ---------------------------------------------------------------------------
export function buildHindiSampleModel(setLabel = "A"): PaperPrintModel {
  return {
    instituteName: INSTITUTE,
    instituteLogoUrl: null,
    className: "10",
    subjectName: "हिन्दी",
    title: "इकाई परीक्षा 1 — क्षितिज एवं व्याकरण",
    totalMarks: 20,
    durationMin: 60,
    setLabel,
    setCount: 1,
    sections: [
      {
        label: "क",
        instructions: "निम्नलिखित गद्यांश को पढ़कर प्रश्नों के उत्तर दीजिए।",
        blocks: [
          {
            stimulus: {
              kind: "passage",
              script: "devanagari",
              body:
                "बड़े भाई साहब मुझसे पाँच साल बड़े थे, लेकिन तीन दर्जे आगे। उन्होंने पढ़ना " +
                "उसी उम्र में शुरू किया था, पर तालीम जैसे महत्त्व के मामले में वे जल्दबाजी " +
                "करना पसंद न करते थे। इस भवन की बुनियाद खूब मजबूत डालना चाहते थे।",
            },
            questions: [
              { displayNumber: "1", partLabel: "(क)", body: "बड़े भाई साहब की उम्र लेखक से कितनी अधिक थी?", marks: 1, script: "devanagari" },
              { displayNumber: "1", partLabel: "(ख)", body: "वे जल्दबाजी क्यों पसंद नहीं करते थे?", marks: 2, script: "devanagari" },
              { displayNumber: "1", partLabel: "(ग)", body: "'बुनियाद मजबूत डालना' से लेखक का क्या आशय है?", marks: 2, script: "devanagari" },
            ],
          },
        ],
      },
      {
        label: "ख",
        instructions: "व्याकरण — 1 अंक प्रत्येक।",
        blocks: [
          {
            questions: [
              {
                displayNumber: "2",
                body: "'निरादर' शब्द में उपसर्ग है:",
                marks: 1,
                script: "devanagari",
                options: [
                  { letter: "क", text: "नि" },
                  { letter: "ख", text: "निर्" },
                  { letter: "ग", text: "निरा" },
                  { letter: "घ", text: "अ" },
                ],
              },
            ],
          },
          {
            questions: [
              { displayNumber: "3", body: "निम्नलिखित वाक्य को मिश्र वाक्य में बदलिए — 'परिश्रमी छात्र सफल होते हैं।'", marks: 2, script: "devanagari" },
            ],
          },
        ],
      },
      {
        label: "ग",
        instructions: "लेखन — निम्नलिखित में से किसी एक विषय पर अनुच्छेद लिखिए।",
        blocks: [
          {
            questions: [
              { displayNumber: "4", body: "(क) पर्यावरण संरक्षण   अथवा   (ख) मेरा प्रिय त्योहार", marks: 12, script: "devanagari" },
            ],
          },
        ],
      },
    ],
  };
}
