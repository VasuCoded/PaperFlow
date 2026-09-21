/**
 * Paper layouts: what a paper is made of, section by section.
 *
 * A teacher either picks a stored pattern (a CBSE board pattern, or one their
 * institute saved), starts from a quick template, or builds a layout from
 * scratch. Templates and custom layouts are plain data sent with the request;
 * the server validates them here before the generator ever sees them, and
 * stores them as an institute-owned pattern when the paper is saved (so the
 * paper still points at the exact layout it was built from).
 *
 * Nothing here names a class or a subject: a layout asks for question KINDS
 * and marks, and the generator draws whatever the chosen chapters hold.
 */

export interface QuestionKind {
  key: string;
  label: string;
  /** question_type values this kind accepts */
  types: string[];
  /** a passage / case / extract with parts, placed as one question */
  stimulus: boolean;
  /** students get auto-practice for mistakes in this kind */
  practice: boolean;
}

export const QUESTION_KINDS: QuestionKind[] = [
  { key: "objective", label: "MCQ or assertion–reason", types: ["mcq", "assertion_reason"], stimulus: false, practice: true },
  { key: "mcq", label: "MCQ only", types: ["mcq"], stimulus: false, practice: true },
  { key: "assertion_reason", label: "Assertion–reason only", types: ["assertion_reason"], stimulus: false, practice: true },
  { key: "vsa", label: "Very short answer", types: ["vsa"], stimulus: false, practice: true },
  { key: "sa", label: "Short answer", types: ["sa"], stimulus: false, practice: true },
  { key: "la", label: "Long answer", types: ["la"], stimulus: false, practice: true },
  { key: "written", label: "Any written answer", types: ["vsa", "sa", "la"], stimulus: false, practice: true },
  { key: "case_study", label: "Case-based (passage with parts)", types: ["case_study"], stimulus: true, practice: true },
  { key: "source_based", label: "Source-based (extract with parts)", types: ["source_based"], stimulus: true, practice: true },
  { key: "comprehension", label: "Reading comprehension (passage with parts)", types: ["comprehension"], stimulus: true, practice: true },
  { key: "grammar", label: "Grammar", types: ["grammar"], stimulus: false, practice: true },
  { key: "writing", label: "Writing", types: ["writing"], stimulus: false, practice: false },
  { key: "map", label: "Map work", types: ["map"], stimulus: true, practice: false },
];

const KNOWN_TYPES = new Set(QUESTION_KINDS.flatMap((k) => k.types));

export function kindByKey(key: string): QuestionKind | undefined {
  return QUESTION_KINDS.find((k) => k.key === key);
}

/** The kind whose types are exactly these, if any (for showing a stored pattern). */
export function kindForTypes(types: readonly string[], stimulus: boolean): QuestionKind | undefined {
  const want = [...new Set(types)].sort().join(",");
  return QUESTION_KINDS.find((k) => k.stimulus === stimulus && [...k.types].sort().join(",") === want);
}

export function kindLabel(types: readonly string[], stimulus: boolean): string {
  return kindForTypes(types, stimulus)?.label ?? (types.length > 0 ? types.join(" / ") : "Any question");
}

export interface LayoutSection {
  questionTypes: string[];
  requiresStimulus: boolean;
  questionCount: number;
  marksEach: number;
  /** each position prints an either/or alternative of the same marks */
  allowChoice: boolean;
  practiceEligible: boolean;
  instructions: string;
}

export interface CustomLayout {
  name: string;
  durationMin: number | null;
  /** printed under the paper's header, e.g. "All questions are compulsory." */
  generalInstructions: string;
  sections: LayoutSection[];
}

export const LIMITS = {
  sections: 12,
  questionsPerSection: 200,
  questionsTotal: 200,
  marksEach: 20,
  totalMarks: 400,
  durationMin: 5,
  durationMax: 360,
  name: 80,
  instructions: 300,
  generalInstructions: 1000,
} as const;

export function sectionLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

export function layoutTotals(sections: readonly Pick<LayoutSection, "questionCount" | "marksEach">[]) {
  return {
    questions: sections.reduce((n, s) => n + s.questionCount, 0),
    marks: sections.reduce((n, s) => n + s.questionCount * s.marksEach, 0),
  };
}

export function defaultInstructions(s: Pick<LayoutSection, "questionTypes" | "requiresStimulus" | "marksEach" | "allowChoice">): string {
  const kind = kindLabel(s.questionTypes, s.requiresStimulus);
  return `${kind} (${s.marksEach} mark${s.marksEach === 1 ? "" : "s"} each).${s.allowChoice ? " Internal choice." : ""}`;
}

export function sectionFromKind(kindKey: string, questionCount: number, marksEach: number, allowChoice = false): LayoutSection {
  const kind = kindByKey(kindKey);
  if (!kind) throw new Error(`unknown question kind ${kindKey}`);
  const s = { questionTypes: kind.types, requiresStimulus: kind.stimulus, questionCount, marksEach, allowChoice, practiceEligible: kind.practice };
  return { ...s, instructions: defaultInstructions(s) };
}

/**
 * Quick templates. CBSE-equivalent structures with "any written answer" rows,
 * so they work whichever question types a subject's bank uses for its 2-, 3-
 * and 5-mark questions.
 */
export interface QuickTemplate {
  key: string;
  name: string;
  blurb: string;
  layout: CustomLayout;
}

const COMPULSORY = "All questions are compulsory.";

export const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    key: "quiz-15",
    name: "Quick quiz · 15 min",
    blurb: "10 MCQ / assertion–reason, 1 mark each",
    layout: { name: "Quick quiz", durationMin: 15, generalInstructions: COMPULSORY, sections: [sectionFromKind("objective", 10, 1)] },
  },
  ...[25, 50, 100].map((n): QuickTemplate => ({
    key: `mcq-${n}`,
    name: `MCQ test · ${n} questions`,
    blurb: `${n} MCQ / assertion–reason, 1 mark each · ${Math.round(n * 1.2)} min`,
    layout: { name: `MCQ test (${n})`, durationMin: Math.round(n * 1.2), generalInstructions: `${COMPULSORY} Each question has one correct answer.`, sections: [sectionFromKind("objective", n, 1)] },
  })),
  {
    key: "class-test-20",
    name: "Class test · 20 marks · 40 min",
    blurb: "8 objective (1) + 6 short written (2)",
    layout: { name: "Class test", durationMin: 40, generalInstructions: COMPULSORY, sections: [sectionFromKind("objective", 8, 1), sectionFromKind("written", 6, 2)] },
  },
  {
    key: "unit-test-25",
    name: "Unit test · 25 marks · 1 hour",
    blurb: "10 objective (1) + 5 written (2) + 1 long (5)",
    layout: {
      name: "Unit test",
      durationMin: 60,
      generalInstructions: COMPULSORY,
      sections: [sectionFromKind("objective", 10, 1), sectionFromKind("written", 5, 2), sectionFromKind("written", 1, 5)],
    },
  },
  {
    key: "chapter-test-40",
    name: "Chapter test · 40 marks · 90 min (CBSE-style)",
    blurb: "10 objective + 4 × 2 + 3 × 3 + 1 × 5 (choice) + 2 case-based",
    layout: {
      name: "Chapter test",
      durationMin: 90,
      generalInstructions: `${COMPULSORY} Internal choice is given in Section D.`,
      sections: [
        sectionFromKind("objective", 10, 1),
        sectionFromKind("written", 4, 2),
        sectionFromKind("written", 3, 3),
        sectionFromKind("written", 1, 5, true),
        sectionFromKind("case_study", 2, 4),
      ],
    },
  },
  {
    key: "term-80",
    name: "Term exam · 80 marks · 3 hours (CBSE-style)",
    blurb: "20 objective + 6 × 2 + 7 × 3 + 3 × 5 (choice) + 3 case-based",
    layout: {
      name: "Term exam",
      durationMin: 180,
      generalInstructions: `This question paper has five sections, A to E. ${COMPULSORY} Internal choice is given in Section D.`,
      sections: [
        sectionFromKind("objective", 20, 1),
        sectionFromKind("written", 6, 2),
        sectionFromKind("written", 7, 3),
        sectionFromKind("written", 3, 5, true),
        sectionFromKind("case_study", 3, 4),
      ],
    },
  },
];

export function templateByKey(key: string): QuickTemplate | undefined {
  return QUICK_TEMPLATES.find((t) => t.key === key);
}

const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) ? v : null);
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Validate a layout that arrived from the browser. Returns a clean copy (only
 * the fields we know, trimmed) or the first problem in words a teacher
 * understands.
 */
export function validateLayout(raw: unknown): { ok: true; layout: CustomLayout } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") return { ok: false, message: "The paper layout is missing." };
  const r = raw as Record<string, unknown>;
  const name = str(r.name, LIMITS.name) || "Custom paper";
  const duration = r.durationMin == null ? null : int(r.durationMin);
  if (duration !== null && (duration < LIMITS.durationMin || duration > LIMITS.durationMax)) {
    return { ok: false, message: `Time must be between ${LIMITS.durationMin} and ${LIMITS.durationMax} minutes.` };
  }
  if (r.durationMin != null && duration === null) return { ok: false, message: "Time must be a whole number of minutes." };
  const sectionsRaw = Array.isArray(r.sections) ? r.sections : [];
  if (sectionsRaw.length === 0) return { ok: false, message: "Add at least one section." };
  if (sectionsRaw.length > LIMITS.sections) return { ok: false, message: `A paper can have at most ${LIMITS.sections} sections.` };

  const sections: LayoutSection[] = [];
  for (const [i, sr] of sectionsRaw.entries()) {
    const s = (sr ?? {}) as Record<string, unknown>;
    const label = `Section ${sectionLabel(i)}`;
    const types = Array.isArray(s.questionTypes) ? [...new Set(s.questionTypes.filter((t): t is string => typeof t === "string"))] : [];
    if (types.length === 0 || types.some((t) => !KNOWN_TYPES.has(t))) return { ok: false, message: `${label}: choose a question kind.` };
    const count = int(s.questionCount);
    if (count === null || count < 1 || count > LIMITS.questionsPerSection) {
      return { ok: false, message: `${label}: number of questions must be between 1 and ${LIMITS.questionsPerSection}.` };
    }
    const marks = int(s.marksEach);
    if (marks === null || marks < 1 || marks > LIMITS.marksEach) {
      return { ok: false, message: `${label}: marks each must be between 1 and ${LIMITS.marksEach}.` };
    }
    // Stimulus-ness follows the kind, never the client's say-so.
    const stimulusKinds = QUESTION_KINDS.filter((k) => k.stimulus).flatMap((k) => k.types);
    const stimulus = types.every((t) => stimulusKinds.includes(t));
    if (!stimulus && types.some((t) => stimulusKinds.includes(t))) {
      return { ok: false, message: `${label}: a passage-based kind cannot be mixed with other kinds.` };
    }
    const kind = kindForTypes(types, stimulus);
    const allowChoice = s.allowChoice === true;
    const base = { questionTypes: types, requiresStimulus: stimulus, questionCount: count, marksEach: marks, allowChoice };
    sections.push({
      ...base,
      practiceEligible: kind ? kind.practice : true,
      instructions: str(s.instructions, LIMITS.instructions) || defaultInstructions(base),
    });
  }

  const totals = layoutTotals(sections);
  if (totals.questions > LIMITS.questionsTotal) {
    return { ok: false, message: `A paper can have at most ${LIMITS.questionsTotal} questions (this one has ${totals.questions}).` };
  }
  if (totals.marks > LIMITS.totalMarks) return { ok: false, message: `A paper can carry at most ${LIMITS.totalMarks} marks.` };

  return {
    ok: true,
    layout: { name, durationMin: duration, generalInstructions: str(r.generalInstructions, LIMITS.generalInstructions), sections },
  };
}

/** How many whole questions of one kind and marks the chosen chapters hold. */
export interface AvailabilityRow {
  /** the block's question types, sorted and de-duplicated */
  types: string[];
  marks: number;
  stimulus: boolean;
  count: number;
}

export function availableFor(section: Pick<LayoutSection, "questionTypes" | "requiresStimulus" | "marksEach">, rows: readonly AvailabilityRow[]): number {
  return rows
    .filter((r) => r.stimulus === section.requiresStimulus && r.marks === section.marksEach && r.types.every((t) => section.questionTypes.includes(t)))
    .reduce((n, r) => n + r.count, 0);
}

/** The marks values on offer for a kind, with counts — shown as quick picks. */
export function marksOnOffer(section: Pick<LayoutSection, "questionTypes" | "requiresStimulus">, rows: readonly AvailabilityRow[]): { marks: number; count: number }[] {
  const by = new Map<number, number>();
  for (const r of rows) {
    if (r.stimulus !== section.requiresStimulus || !r.types.every((t) => section.questionTypes.includes(t))) continue;
    by.set(r.marks, (by.get(r.marks) ?? 0) + r.count);
  }
  return [...by.entries()].map(([marks, count]) => ({ marks, count })).sort((a, b) => a.marks - b.marks);
}
