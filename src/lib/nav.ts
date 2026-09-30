import type { IconName } from "@/components/ui/Icon";

/**
 * The side menu of the desk consoles.
 *
 * Grouped so the everyday jobs sit at the top and the rarer ones below, each
 * under a plain heading. An institute admin can do everything a teacher can
 * (set papers, make batches, flag questions; the database already allows it),
 * so their menu has both: the institute's own pages, and the teaching pages. A
 * teacher's menu holds only the teaching pages. Access itself is decided
 * elsewhere (canAccess, and the database); this only decides which links to show.
 */
export type Area = "platform" | "institute" | "teacher";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** an area's front page: active only on itself, not on everything under it */
  exact?: boolean;
  /** a count shown next to the label when it is not zero (see ConsoleFrame) */
  badge?: string;
}
export interface NavGroup {
  title?: string;
  items: NavItem[];
}

const PLATFORM: NavGroup[] = [
  {
    items: [
      { href: "/platform", label: "Dashboard", icon: "grid", exact: true },
      { href: "/platform/institutes", label: "Institutes", icon: "building" },
      { href: "/platform/support", label: "Find a person", icon: "search" },
    ],
  },
  {
    title: "Approvals",
    items: [
      { href: "/platform/accounts", label: "Access requests", icon: "userPlus", badge: "access" },
      { href: "/platform/requests", label: "Subject requests", icon: "inbox", badge: "subjects" },
      { href: "/platform/activation", label: "Subject activation", icon: "toggle" },
    ],
  },
  {
    title: "Question bank",
    items: [{ href: "/platform/bank", label: "Review queue", icon: "check", badge: "review" }],
  },
  {
    title: "System",
    items: [
      { href: "/platform/health", label: "Health", icon: "activity" },
      { href: "/platform/audit", label: "Audit log", icon: "list" },
    ],
  },
];

const teaching = (admin: boolean): NavItem[] => [
  { href: "/teacher/generate", label: "Set a paper", icon: "filePlus" },
  // an admin sees every paper of the institute, a teacher only their own
  { href: "/teacher/papers", label: admin ? "Papers" : "My papers", icon: "file" },
  { href: "/teacher/batches", label: "Batches", icon: "layers" },
  { href: "/teacher/flagged", label: "Flagged questions", icon: "flag" },
];

const ADMIN: NavGroup[] = [
  { items: [{ href: "/institute", label: "Home", icon: "home", exact: true }] },
  {
    title: "People",
    items: [
      { href: "/institute/members", label: "Members", icon: "users", badge: "joins" },
      { href: "/institute/teachers", label: "Teacher subjects", icon: "idcard" },
    ],
  },
  { title: "Teaching", items: teaching(true) },
  {
    title: "Institute",
    items: [
      { href: "/institute/subjects", label: "Subjects", icon: "book" },
      { href: "/institute/export", label: "Export data", icon: "download" },
    ],
  },
];

export function navFor(area: Area, role: string | null): NavGroup[] {
  if (area === "platform") return PLATFORM;
  // only an institute admin can be in the institute area; and an admin in the
  // teacher area still gets their institute's pages
  if (area === "institute" || role === "institute_admin") return ADMIN;
  return [{ items: teaching(false) }];
}

export function brandFor(area: Area, role: string | null): string {
  if (area === "platform") return "Platform console";
  if (area === "institute" || role === "institute_admin") return "Institute console";
  return "Teacher console";
}

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  if (pathname === item.href) return true;
  return !item.exact && pathname.startsWith(`${item.href}/`);
}

/** The menu item the page at `pathname` belongs to, for the page title on phones. */
export function currentItem(groups: NavGroup[], pathname: string): NavItem | undefined {
  return groups.flatMap((g) => g.items).find((i) => isActive(pathname, i));
}
