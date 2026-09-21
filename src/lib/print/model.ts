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
  /** the paper's unique code, printed on every page (e.g. SSA-10SCI-260922-03) */
  code?: string;
  /** printed under the header, e.g. "All questions are compulsory." */
  generalInstructions?: string;
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
  code?: string;
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
  code?: string;
  setLabels: string[];
  rows: MappingRow[];
  /** copies per set, e.g. { A: 14, B: 13, C: 13 } */
  copies: Record<string, number>;
}

const INSTITUTE = "Sunrise Coaching Classes";

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
