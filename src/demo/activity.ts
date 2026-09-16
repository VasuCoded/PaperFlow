/**
 * Demo activity: batches, papers, members, audit, the activation queue and the
 * platform health numbers. All invented; shapes follow the real schema.
 */
import type { Pattern } from "@/server/generator/types";
import type {
  DemoActivationRequest,
  DemoAuditRow,
  DemoBatch,
  DemoMember,
  DemoPaper,
  StagingQuestion,
  WeakTopic,
} from "./types";
import { PLATFORM_ID, SUNRISE_ID, VIDYA_ID } from "./institutes";
import { CS_BIO, CS_CHEM, CS_MATH, CS_SCI, CS_SST } from "./bank";

// ---------------------------------------------------------------------------
// Paper patterns (platform-owned, read by everyone)
// ---------------------------------------------------------------------------
export interface DemoPattern extends Pattern {
  label: string;
  origin: "board" | "institute";
}

export const PATTERNS: DemoPattern[] = [
  {
    id: "pat-unit-30",
    name: "Unit test · 30 marks",
    label: "30 marks · 45 min",
    origin: "institute",
    totalMarks: 30,
    sections: [
      { label: "A", questionCount: 6, marksEach: 1, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
      { label: "B", questionCount: 6, marksEach: 2, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
      { label: "C", questionCount: 4, marksEach: 3, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
    ],
  },
  {
    id: "pat-unit-25",
    name: "Unit test · 25 marks",
    label: "25 marks · 40 min",
    origin: "institute",
    totalMarks: 25,
    sections: [
      { label: "A", questionCount: 8, marksEach: 1, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
      { label: "B", questionCount: 4, marksEach: 2, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
      { label: "C", questionCount: 3, marksEach: 3, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
    ],
  },
  {
    id: "pat-board-70",
    name: "CBSE board pattern · 70 marks",
    label: "70 marks · board pattern",
    origin: "board",
    totalMarks: 70,
    sections: [
      { label: "A", questionCount: 15, marksEach: 1, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
      { label: "B", questionCount: 5, marksEach: 2, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
      { label: "C", questionCount: 5, marksEach: 3, questionTypes: [], allowChoice: false, practiceEligible: true, requiresStimulus: false },
      { label: "D", questionCount: 6, marksEach: 5, questionTypes: [], allowChoice: true, practiceEligible: true, requiresStimulus: false },
    ],
  },
];

// ---------------------------------------------------------------------------
// Teacher assignments
// ---------------------------------------------------------------------------
export const TEACHER_SUBJECTS: Record<string, { instituteId: string; classSubjectId: string }[]> = {
  "acc-desh": [
    { instituteId: SUNRISE_ID, classSubjectId: CS_BIO },
    { instituteId: SUNRISE_ID, classSubjectId: CS_SCI },
  ],
  "acc-rao": [
    { instituteId: SUNRISE_ID, classSubjectId: CS_BIO },
    { instituteId: VIDYA_ID, classSubjectId: CS_SCI },
  ],
};

/** Which class-subjects each institute has ACTIVE (institute_class_subjects). */
export const ACTIVE_CLASS_SUBJECTS: Record<string, string[]> = {
  [SUNRISE_ID]: [CS_BIO, CS_CHEM, CS_SCI],
  [VIDYA_ID]: [CS_SCI],
};

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------
export const BATCHES: DemoBatch[] = [
  { id: "b-12b-eve", instituteId: SUNRISE_ID, name: "12B-EVE", classSubjectId: CS_BIO, teacherId: "acc-desh", joinCode: "K7M2QX", active: true, students: 38 },
  { id: "b-12a-mrn", instituteId: SUNRISE_ID, name: "12A-MRN", classSubjectId: CS_BIO, teacherId: "acc-desh", joinCode: "R4TJ9P", active: true, students: 41 },
  { id: "b-12chem", instituteId: SUNRISE_ID, name: "12B-CHEM", classSubjectId: CS_CHEM, teacherId: "acc-rao", joinCode: "W8HN3V", active: true, students: 36 },
  { id: "b-10sci", instituteId: SUNRISE_ID, name: "10-SCI-A", classSubjectId: CS_SCI, teacherId: "acc-desh", joinCode: "L5PD7Y", active: true, students: 44 },
  { id: "b-10sci-old", instituteId: SUNRISE_ID, name: "10-SCI-B (2025)", classSubjectId: CS_SCI, teacherId: "acc-desh", joinCode: "T3QF8N", active: false, students: 40 },
  { id: "b-vidya-10", instituteId: VIDYA_ID, name: "X-SCI-1", classSubjectId: CS_SCI, teacherId: "acc-rao", joinCode: "M9ZB4K", active: true, students: 52 },
];

export function batchesFor(instituteId: string): DemoBatch[] {
  return BATCHES.filter((b) => b.instituteId === instituteId);
}

// ---------------------------------------------------------------------------
// Papers
// ---------------------------------------------------------------------------
export const PAPERS: DemoPaper[] = [
  { id: "p-ut5", instituteId: SUNRISE_ID, classSubjectId: CS_BIO, batchId: "b-12b-eve", title: "Unit Test 5", date: "12 Sep", totalMarks: 30, setCount: 3, chapters: ["Principles of Inheritance", "Molecular Basis", "Evolution"], loggedCount: 31, status: "printed" },
  { id: "p-ut4", instituteId: SUNRISE_ID, classSubjectId: CS_BIO, batchId: "b-12b-eve", title: "Unit Test 4", date: "24 Aug", totalMarks: 25, setCount: 1, chapters: ["Principles of Inheritance"], loggedCount: 34, status: "printed" },
  { id: "p-ut3", instituteId: SUNRISE_ID, classSubjectId: CS_BIO, batchId: "b-12b-eve", title: "Unit Test 3 · Reproduction", date: "9 Aug", totalMarks: 25, setCount: 1, chapters: ["Human Reproduction"], loggedCount: 36, status: "printed" },
  { id: "p-rev1", instituteId: SUNRISE_ID, classSubjectId: CS_BIO, batchId: "b-12a-mrn", title: "Revision 1 · Board pattern", date: "2 Sep", totalMarks: 70, setCount: 3, chapters: ["All five chapters"], loggedCount: 28, status: "printed" },
  { id: "p-chem2", instituteId: SUNRISE_ID, classSubjectId: CS_CHEM, batchId: "b-12chem", title: "Unit Test 2 · Electrochemistry", date: "10 Sep", totalMarks: 30, setCount: 2, chapters: ["Electrochemistry"], loggedCount: 0, status: "printed" },
  { id: "p-sci7", instituteId: SUNRISE_ID, classSubjectId: CS_SCI, batchId: "b-10sci", title: "Unit Test 7 · Light", date: "8 Sep", totalMarks: 25, setCount: 3, chapters: ["Light — Reflection and Refraction"], loggedCount: 39, status: "printed" },
  { id: "p-vidya1", instituteId: VIDYA_ID, classSubjectId: CS_SCI, batchId: "b-vidya-10", title: "Monthly Test 1", date: "11 Sep", totalMarks: 30, setCount: 2, chapters: ["Chemical Reactions", "Acids and Bases"], loggedCount: 44, status: "printed" },
];

export function papersFor(instituteId: string, classSubjectId?: string): DemoPaper[] {
  return PAPERS.filter(
    (p) => p.instituteId === instituteId && (!classSubjectId || p.classSubjectId === classSubjectId),
  );
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------
export const MEMBERS: Record<string, DemoMember[]> = {
  [SUNRISE_ID]: [
    { accountId: "acc-iyer", name: "S. Iyer", email: "iyer@sunrisecoaching.test", role: "institute_admin", joined: "14 Jul", subjects: [] },
    { accountId: "acc-desh", name: "R. Deshmukh", email: "deshmukh@sunrisecoaching.test", role: "teacher", joined: "14 Jul", subjects: ["Class 12 · Biology", "Class 10 · Science"] },
    { accountId: "acc-rao", name: "V. Rao", email: "v.rao@gmail.test", role: "teacher", joined: "2 Aug", subjects: ["Class 12 · Biology"] },
    { accountId: "acc-aarav", name: "Aarav Menon", email: "aarav@gmail.test", role: "student", joined: "20 Jul", subjects: ["Class 12 · Biology", "Class 12 · Chemistry"] },
    { accountId: "acc-s2", name: "Ishita Bhatt", email: "ishita@gmail.test", role: "student", joined: "20 Jul", subjects: ["Class 12 · Biology"] },
    { accountId: "acc-s3", name: "Rohan Gupta", email: "rohan@gmail.test", role: "student", joined: "21 Jul", subjects: ["Class 12 · Biology"] },
    { accountId: "acc-s4", name: "Meera Krishnan", email: "meera@gmail.test", role: "student", joined: "23 Jul", subjects: ["Class 10 · Science"] },
  ],
  [VIDYA_ID]: [
    { accountId: "acc-vb-admin", name: "A. Pillai", email: "admin@vidyabhavan.test", role: "institute_admin", joined: "28 Aug", subjects: [] },
    { accountId: "acc-rao", name: "V. Rao", email: "v.rao@gmail.test", role: "teacher", joined: "29 Aug", subjects: ["Class 10 · Science"] },
  ],
};

export const PENDING_INVITES: Record<string, { email: string; role: string; sent: string }[]> = {
  [SUNRISE_ID]: [{ email: "n.sharma@sunrisecoaching.test", role: "teacher", sent: "11 Sep" }],
  [VIDYA_ID]: [{ email: "s.menon@vidyabhavan.test", role: "teacher", sent: "1 Sep" }],
};

/** Invites waiting for the "no institute yet" persona. */
export const INVITES_FOR_KAVYA = [
  { id: "inv-1", instituteId: SUNRISE_ID, role: "teacher", sentBy: "S. Iyer", sent: "11 Sep" },
];

// ---------------------------------------------------------------------------
// Platform: activation queue, staging bank, audit, health
// ---------------------------------------------------------------------------
export const ACTIVATION_REQUESTS: DemoActivationRequest[] = [
  {
    id: "ar-1", instituteId: SUNRISE_ID, classSubjectId: CS_MATH, requestedBy: "S. Iyer",
    createdAt: "9 Sep", status: "pending", gateMet: false,
    gateNote: "Thinnest chapter 'Circles' has 31 approved (gate needs 60). Thinnest topic 4 (needs 8).",
  },
  {
    id: "ar-2", instituteId: VIDYA_ID, classSubjectId: CS_BIO, requestedBy: "A. Pillai",
    createdAt: "12 Sep", status: "pending", gateMet: true,
    gateNote: "Gate met. Bank is ready; 3 sample papers still to be read by their teacher.",
  },
  {
    id: "ar-3", instituteId: SUNRISE_ID, classSubjectId: CS_SST, requestedBy: "S. Iyer",
    createdAt: "1 Sep", status: "declined", gateMet: false,
    gateNote: "Declined — Geography strand has 22 approved. Revisit after the next ingestion run.",
  },
];

export const STAGING_QUEUE: StagingQuestion[] = [
  { id: "sq-1", ownerInstituteId: PLATFORM_ID, classSubjectId: CS_BIO, chapter: "Molecular Basis of Inheritance", body: "Name the enzyme that unwinds the DNA double helix during replication.", answer: "Helicase", marks: 1, difficulty: "easy", note: null },
  { id: "sq-2", ownerInstituteId: PLATFORM_ID, classSubjectId: CS_BIO, chapter: "Evolution", body: "Explain convergent evolution with two examples from different continents.", answer: "Unrelated lineages evolving similar traits under similar selection pressure…", marks: 3, difficulty: "medium", note: null },
  { id: "sq-3", ownerInstituteId: PLATFORM_ID, classSubjectId: CS_BIO, chapter: "Human Health and Disease", body: "The diagram shows a stage in the life cycle of Plasmodium. Identify stage X.", answer: "Gametocyte", marks: 1, difficulty: "medium", note: "Diagram was faint on the scan — please check the crop before approving." },
  { id: "sq-4", ownerInstituteId: SUNRISE_ID, classSubjectId: CS_BIO, chapter: "Principles of Inheritance and Variation", body: "Sunrise mock 6: a cross gives 3:1 in F₂ but 1:1 in the test cross. Interpret.", answer: "Monohybrid, heterozygous parent", marks: 2, difficulty: "medium", note: "Institute-private. Do NOT promote to the shared bank." },
  { id: "sq-5", ownerInstituteId: PLATFORM_ID, classSubjectId: CS_SCI, chapter: "Electricity", body: "Two lamps rated 60 W and 100 W at 220 V are connected in series. Which glows brighter?", answer: "The 60 W lamp", marks: 3, difficulty: "hard", note: "Answer key in the source paper looked wrong — verify." },
  { id: "sq-6", ownerInstituteId: PLATFORM_ID, classSubjectId: CS_SCI, chapter: "Acids, Bases and Salts", body: "Why does dry HCl gas not turn blue litmus red?", answer: "No H⁺ ions without water", marks: 2, difficulty: "medium", note: null },
];

export const AUDIT_ROWS: DemoAuditRow[] = [
  { id: "a-1", kind: "access", actor: "Priya Nair", instituteId: VIDYA_ID, action: "inspect_institute", target: "Vidya Bhavan Academy", at: "16 Sep 09:14" },
  { id: "a-2", kind: "role", actor: "S. Iyer", instituteId: SUNRISE_ID, action: "set_member_role", target: "Meera Krishnan · student → teacher", at: "15 Sep 17:40" },
  { id: "a-3", kind: "access", actor: "Priya Nair", instituteId: SUNRISE_ID, action: "inspect_paper", target: "Unit Test 5", at: "15 Sep 11:02" },
  { id: "a-4", kind: "access", actor: "Priya Nair", instituteId: SUNRISE_ID, action: "activation_declined", target: "Class 10 · Social Science", at: "1 Sep 10:20" },
  { id: "a-5", kind: "role", actor: "Priya Nair", instituteId: VIDYA_ID, action: "set_member_role", target: "A. Pillai · → institute_admin", at: "28 Aug 15:55" },
  { id: "a-6", kind: "access", actor: "Priya Nair", instituteId: SUNRISE_ID, action: "correct_paper_set", target: "Unit Test 5 · Rohan Gupta · B → C", at: "14 Sep 19:12" },
];

export const HEALTH = {
  dbMb: 148,
  dbLimitMb: 500,
  storageMb: 214,
  storageLimitMb: 1024,
  egressGb: 1.6,
  egressLimitGb: 5,
  invocations: 184_000,
  invocationLimit: 1_000_000,
  lastBackup: "16 Sep 2026, 02:00 IST",
  perInstitute: [
    { instituteId: SUNRISE_ID, rows: 41_820, storageMb: 156, share: 0.73 },
    { instituteId: VIDYA_ID, rows: 9_140, storageMb: 41, share: 0.19 },
    { instituteId: PLATFORM_ID, rows: 3_980, storageMb: 17, share: 0.08 },
  ],
};

// ---------------------------------------------------------------------------
// Student-side activity
// ---------------------------------------------------------------------------
export const STUDENT_SUBJECTS = [CS_BIO, CS_CHEM];

export const WEAK_TOPICS: Record<string, WeakTopic[]> = {
  [CS_BIO]: [
    { topic: "Sex-linked inheritance", correct: 3, total: 11, note: "Wrong in 3 of the last 3 tests." },
    { topic: "Linkage & recombination", correct: 5, total: 12 },
    { topic: "Regulation of gene expression", correct: 6, total: 13 },
    { topic: "Incomplete dominance", correct: 9, total: 14 },
    { topic: "Mendel's experiments", correct: 17, total: 19 },
  ],
  [CS_CHEM]: [
    { topic: "Nernst equation", correct: 2, total: 9, note: "Wrong in 2 of the last 2 tests." },
    { topic: "Electrolysis", correct: 7, total: 12 },
    { topic: "Conductance", correct: 11, total: 14 },
  ],
};

/** Questions on the latest Biology paper, as the student sees them. */
export const STUDENT_PAPER_QUESTIONS = [
  { n: 1, body: "Phenotypic ratio 9:3:3:1 is obtained when…", topic: "Dihybrid ratios", difficulty: "Easy", marks: 1 },
  { n: 2, body: "Assertion–Reason: linked genes do not follow independent assortment.", topic: "Linkage & recombination", difficulty: "Medium", marks: 1 },
  { n: 3, body: "Define pleiotropy and give one example from humans.", topic: "Pleiotropy", difficulty: "Easy", marks: 2 },
  { n: 4, body: "A colour-blind man marries a woman with no family history. Work out the ratio in F₂.", topic: "Sex-linked inheritance", difficulty: "Hard", marks: 3 },
  { n: 5, body: "Why did Mendel select garden pea? State four reasons.", topic: "Mendel's experiments", difficulty: "Easy", marks: 3 },
  { n: 6, body: "Explain incomplete dominance using the Mirabilis jalapa cross up to F₂.", topic: "Incomplete dominance", difficulty: "Medium", marks: 5 },
  { n: 7, body: "Explain the lac operon in the presence and absence of lactose.", topic: "Regulation of gene expression", difficulty: "Hard", marks: 5 },
];

export const PRACTICE_ITEMS = [
  { body: "In a dihybrid cross of AaBb × aabb, what fraction of progeny is aabb?", topic: "Dihybrid ratios", difficulty: "Medium", done: true },
  { body: "State the law of independent assortment and name one exception.", topic: "Dihybrid ratios", difficulty: "Easy", done: true },
  { body: "A woman carrier of haemophilia marries a normal man. Give the F₁ ratio.", topic: "Sex-linked inheritance", difficulty: "Medium", done: false },
  { body: "Why is colour blindness commoner in males than females?", topic: "Sex-linked inheritance", difficulty: "Easy", done: false },
  { body: "Explain why linked genes show fewer recombinants than expected.", topic: "Linkage & recombination", difficulty: "Hard", done: false },
  { body: "Define recombination frequency. What does 1% correspond to?", topic: "Linkage & recombination", difficulty: "Medium", done: false },
];
