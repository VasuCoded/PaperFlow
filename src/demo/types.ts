/**
 * Demo-only types. Mirrors the shape of the real schema closely enough that the
 * screens are honest about what data exists, but nothing here touches Supabase.
 */
import type { Difficulty } from "@/server/generator/types";

export type DemoRole = "owner" | "institute_admin" | "teacher" | "student" | "none";

export interface DemoInstitute {
  id: string;
  name: string;
  slug: string;
  kind: "platform" | "institute";
  status: "active" | "suspended";
  contactEmail: string | null;
  createdAt: string;
}

export interface DemoAccount {
  id: string;
  name: string;
  email: string;
  initials: string;
  /** memberships: institute id -> role */
  memberships: { instituteId: string; role: DemoRole }[];
  /** what this persona is for, shown on the login screen */
  blurb: string;
  landing: string;
}

export interface DemoClassSubject {
  id: string;
  className: string;
  subjectName: string;
  short: string;
  script: "latin" | "devanagari";
  bankStatus: "planned" | "seeding" | "ready";
  approved: number;
}

export interface DemoChapter {
  id: string;
  classSubjectId: string;
  name: string;
  /** approved questions available to this institute (shared + private, minus flagged) */
  approved: number;
}

/** A bank question, carrying the display text the generator does not need. */
export interface BankItem {
  id: string;
  ownerInstituteId: string;
  classSubjectId: string;
  chapterId: string;
  topicName: string;
  body: string;
  marks: number;
  difficulty: Difficulty;
  source: string;
  /** stimulus group key — items sharing it form one block */
  stimulusId?: string;
  stimulusBody?: string;
  stimulusKind?: string;
  optionsShufflable?: boolean;
  positionLocked?: boolean;
}

export interface DemoBatch {
  id: string;
  instituteId: string;
  name: string;
  classSubjectId: string;
  teacherId: string;
  joinCode: string;
  active: boolean;
  students: number;
}

export interface DemoPaper {
  id: string;
  instituteId: string;
  classSubjectId: string;
  batchId: string;
  title: string;
  date: string;
  totalMarks: number;
  setCount: number;
  chapters: string[];
  loggedCount: number;
  status: "draft" | "generated" | "printed";
}

export interface DemoMember {
  accountId: string;
  name: string;
  email: string;
  role: DemoRole;
  joined: string;
  subjects: string[];
}

export interface DemoActivationRequest {
  id: string;
  instituteId: string;
  classSubjectId: string;
  requestedBy: string;
  createdAt: string;
  status: "pending" | "approved" | "declined";
  gateMet: boolean;
  gateNote: string;
}

export interface DemoAuditRow {
  id: string;
  kind: "role" | "access";
  actor: string;
  instituteId: string;
  action: string;
  target: string;
  at: string;
}

export interface StagingQuestion {
  id: string;
  ownerInstituteId: string;
  classSubjectId: string;
  chapter: string;
  body: string;
  answer: string;
  marks: number;
  difficulty: Difficulty;
  note: string | null;
}

export interface WeakTopic {
  topic: string;
  correct: number;
  total: number;
  note?: string;
}
