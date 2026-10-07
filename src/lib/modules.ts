/**
 * Modules: parts of PaperFlow the platform owner switches on or off per
 * institute, because not every coaching needs everything (a solo tutor needs
 * no separate teacher accounts; some institutes only want to set and print
 * papers, with no student app).
 *
 * Stored as institutes.modules (jsonb, only the keys that differ from the
 * default). The database has the same defaults in module_enabled(), which is
 * what enforces the security-relevant ones (joining, papers reaching students,
 * inviting, self-practice). Keep the two in step.
 */
export type ModuleKey = "student_app" | "teachers" | "self_practice";

export interface ModuleDef {
  key: ModuleKey;
  name: string;
  /** what it gives the institute, in one line */
  blurb: string;
  /** what happens when it is off */
  whenOff: string;
  defaultOn: boolean;
  /** another module this one needs */
  requires?: ModuleKey;
}

export const MODULES: ModuleDef[] = [
  {
    key: "student_app",
    name: "Student app",
    blurb: "Students join batches with a code, log what they got wrong and practise their weak topics; teachers see results and analytics.",
    whenOff: "No student accounts, join codes or results pages. Teachers set and print papers; batches are just class groups.",
    defaultOn: true,
  },
  {
    key: "teachers",
    name: "Teacher accounts",
    blurb: "Separate teacher logins, each with the subjects they teach.",
    whenOff: "Solo-tutor mode: the admin does everything. No new teachers can be invited or approved; existing ones keep working until removed.",
    defaultOn: true,
  },
  {
    key: "self_practice",
    name: "Self-practice",
    blurb: "Students build their own practice sets: pick chapters, how many questions and how hard.",
    whenOff: "Students practise only from the sets built from their logged mistakes.",
    defaultOn: false,
    requires: "student_app",
  },
];

export type Modules = Record<ModuleKey, boolean>;

/** Every module's state, from the stored overrides. A module whose requirement is off is off. */
export function effectiveModules(stored: unknown): Modules {
  const raw = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const out = {} as Modules;
  for (const m of MODULES) out[m.key] = typeof raw[m.key] === "boolean" ? (raw[m.key] as boolean) : m.defaultOn;
  for (const m of MODULES) if (m.requires && !out[m.requires]) out[m.key] = false;
  return out;
}

export const ALL_ON: Modules = { student_app: true, teachers: true, self_practice: true };

/** Ready-made combinations, offered as one-click starting points. */
export const MODULE_PRESETS: { key: string; name: string; blurb: string; modules: Modules }[] = [
  {
    key: "full",
    name: "Full institute",
    blurb: "Admin, teachers and the student app.",
    modules: { student_app: true, teachers: true, self_practice: false },
  },
  {
    key: "solo",
    name: "Solo tutor",
    blurb: "One person sets papers; students use the app.",
    modules: { student_app: true, teachers: false, self_practice: false },
  },
  {
    key: "papers",
    name: "Papers only",
    blurb: "Set and print papers. No student app.",
    modules: { student_app: false, teachers: true, self_practice: false },
  },
];
