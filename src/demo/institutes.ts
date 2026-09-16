import type { DemoAccount, DemoInstitute } from "./types";

export const PLATFORM_ID = "11111111-1111-1111-1111-111111111111";
export const SUNRISE_ID = "inst-sunrise";
export const VIDYA_ID = "inst-vidya";

export const INSTITUTES: DemoInstitute[] = [
  {
    id: PLATFORM_ID,
    name: "PaperFlow Platform",
    slug: "platform",
    kind: "platform",
    status: "active",
    contactEmail: null,
    createdAt: "2026-06-01",
  },
  {
    id: SUNRISE_ID,
    name: "Sunrise Coaching Classes",
    slug: "sunrise",
    kind: "institute",
    status: "active",
    contactEmail: "office@sunrisecoaching.test",
    createdAt: "2026-07-14",
  },
  {
    id: VIDYA_ID,
    name: "Vidya Bhavan Academy",
    slug: "vidya-bhavan",
    kind: "institute",
    status: "active",
    contactEmail: "admin@vidyabhavan.test",
    createdAt: "2026-08-28",
  },
];

export function institute(id: string): DemoInstitute | undefined {
  return INSTITUTES.find((i) => i.id === id);
}
export function instituteName(id: string): string {
  return institute(id)?.name ?? id;
}

/**
 * Demo personas. This exists ONLY so the design can be reviewed without a
 * database. It is not a signup flow and it must never become one: CLAUDE.md
 * forbids a role selector in the real application, because a form that lets a
 * user influence their own role is the whole class of bug the invite system
 * exists to prevent. See src/app/demo/README.md.
 */
export const ACCOUNTS: DemoAccount[] = [
  {
    id: "acc-priya",
    name: "Priya Nair",
    email: "priya@paperflow.test",
    initials: "PN",
    memberships: [{ instituteId: PLATFORM_ID, role: "owner" }],
    blurb: "Runs the platform. Reviews the bank, creates institutes, approves activation.",
    landing: "/demo/platform",
  },
  {
    id: "acc-iyer",
    name: "S. Iyer",
    email: "iyer@sunrisecoaching.test",
    initials: "SI",
    memberships: [{ instituteId: SUNRISE_ID, role: "institute_admin" }],
    blurb: "Admin at Sunrise. Invites staff, assigns subjects, requests activation.",
    landing: "/demo/institute",
  },
  {
    id: "acc-desh",
    name: "R. Deshmukh",
    email: "deshmukh@sunrisecoaching.test",
    initials: "RD",
    memberships: [{ instituteId: SUNRISE_ID, role: "teacher" }],
    blurb: "Teaches Class 12 Biology and Class 10 Science. Sets and prints papers.",
    landing: "/demo/teacher/generate",
  },
  {
    id: "acc-rao",
    name: "V. Rao",
    email: "v.rao@gmail.test",
    initials: "VR",
    memberships: [
      { instituteId: SUNRISE_ID, role: "teacher" },
      { instituteId: VIDYA_ID, role: "teacher" },
    ],
    blurb: "Teaches at two institutes — shows the institute switcher and data isolation.",
    landing: "/demo/teacher/generate",
  },
  {
    id: "acc-aarav",
    name: "Aarav Menon",
    email: "aarav@gmail.test",
    initials: "AM",
    memberships: [{ instituteId: SUNRISE_ID, role: "student" }],
    blurb: "Class 12 student at Sunrise. Logs mistakes, does practice, sees weak spots.",
    landing: "/demo/app",
  },
  {
    id: "acc-kavya",
    name: "Kavya S.",
    email: "kavya@gmail.test",
    initials: "KS",
    memberships: [],
    blurb: "Just signed in with Google and belongs to nothing yet — the correct default.",
    landing: "/demo/welcome",
  },
];

export function account(id: string): DemoAccount | undefined {
  return ACCOUNTS.find((a) => a.id === id);
}

export function roleAt(acc: DemoAccount, instituteId: string) {
  return acc.memberships.find((m) => m.instituteId === instituteId)?.role;
}

export const ROLE_LABEL: Record<string, string> = {
  owner: "Platform owner",
  institute_admin: "Institute admin",
  teacher: "Teacher",
  student: "Student",
  none: "No institute",
};
