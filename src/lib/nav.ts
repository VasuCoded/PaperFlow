/**
 * The side menu of the desk consoles.
 *
 * An institute admin can do everything a teacher can (set papers, make
 * batches, flag questions; the database already allows it), so their menu has
 * both: the institute's own pages, and the teaching pages. A teacher's menu is
 * unchanged. Access itself is decided elsewhere (canAccess, and the database);
 * this only decides which links to show.
 */
export type Area = "platform" | "institute" | "teacher";

export interface NavItem {
  href: string;
  label: string;
  /** an area's front page: active only on itself, not on everything under it */
  exact?: boolean;
}
export interface NavGroup {
  title?: string;
  items: NavItem[];
}

const PLATFORM: NavItem[] = [
  { href: "/platform", label: "Overview", exact: true },
  { href: "/platform/institutes", label: "Institutes" },
  { href: "/platform/bank", label: "Review queue" },
  { href: "/platform/activation", label: "Activation" },
  { href: "/platform/accounts", label: "Access requests" },
  { href: "/platform/requests", label: "Subject requests" },
  { href: "/platform/support", label: "Support" },
  { href: "/platform/health", label: "Health" },
  { href: "/platform/audit", label: "Audit log" },
];

const INSTITUTE: NavItem[] = [
  { href: "/institute", label: "Overview", exact: true },
  { href: "/institute/members", label: "Members" },
  { href: "/institute/teachers", label: "Teacher subjects" },
  { href: "/institute/subjects", label: "Subjects" },
  { href: "/institute/export", label: "Export data" },
];

const teaching = (admin: boolean): NavItem[] => [
  { href: "/teacher/generate", label: "Set a paper" },
  // an admin sees every paper of the institute, a teacher only their own
  { href: "/teacher/papers", label: admin ? "Papers" : "My papers" },
  { href: "/teacher/batches", label: "Batches" },
  { href: "/teacher/flagged", label: "Flagged questions" },
];

export function navFor(area: Area, role: string | null): NavGroup[] {
  if (area === "platform") return [{ items: PLATFORM }];
  // only an institute admin can be in the institute area; and an admin in the
  // teacher area still gets their institute's pages
  if (area === "institute" || role === "institute_admin") {
    return [
      { title: "Institute", items: INSTITUTE },
      { title: "Teaching", items: teaching(true) },
    ];
  }
  return [{ items: teaching(false) }];
}

export function brandFor(area: Area, role: string | null): string {
  if (area === "platform") return "Platform console";
  if (area === "institute" || role === "institute_admin") return "Institute console";
  return "Teacher console";
}

export function isActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true;
  return !item.exact && pathname.startsWith(`${item.href}/`);
}
