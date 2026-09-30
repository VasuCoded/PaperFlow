import { describe, expect, it } from "vitest";
import { brandFor, isActive, navFor, type NavGroup } from "@/lib/nav";

const links = (groups: NavGroup[]) => groups.flatMap((g) => g.items.map((i) => i.href));
const labels = (groups: NavGroup[]) => groups.flatMap((g) => g.items.map((i) => i.label));

describe("console menu", () => {
  it("gives an institute admin the institute pages AND the teaching pages, in both consoles", () => {
    for (const area of ["institute", "teacher"] as const) {
      const groups = navFor(area, "institute_admin");
      expect(groups.map((g) => g.title)).toEqual([undefined, "People", "Teaching", "Institute"]);
      expect(links(groups)).toEqual([
        "/institute", "/institute/members", "/institute/teachers",
        "/teacher/generate", "/teacher/papers", "/teacher/batches", "/teacher/flagged",
        "/institute/subjects", "/institute/export",
      ]);
    }
  });

  it("gives a teacher the teaching pages only, with no institute pages", () => {
    const groups = navFor("teacher", "teacher");
    expect(groups).toHaveLength(1);
    expect(groups[0]!.title).toBeUndefined();
    expect(labels(groups)).toEqual(["Set a paper", "My papers", "Batches", "Flagged questions"]);
    expect(links(groups).some((h) => h.startsWith("/institute"))).toBe(false);
  });

  it("labels the papers page for what it shows: an admin sees every paper, a teacher their own", () => {
    expect(labels(navFor("teacher", "institute_admin"))).toContain("Papers");
    expect(labels(navFor("teacher", "institute_admin"))).not.toContain("My papers");
    expect(labels(navFor("teacher", "teacher"))).toContain("My papers");
  });

  it("gives the platform menu the same nine pages, whoever looks", () => {
    for (const role of ["owner", "institute_admin", null]) {
      const groups = navFor("platform", role);
      expect(links(groups)).toHaveLength(9);
      expect(new Set(links(groups)).size).toBe(9);
      expect(links(groups).every((h) => h.startsWith("/platform"))).toBe(true);
    }
  });

  it("never offers a non-admin the institute console", () => {
    for (const role of ["teacher", "student", null]) {
      expect(links(navFor("teacher", role)).some((h) => h.startsWith("/institute"))).toBe(false);
    }
  });

  it("names the console by who is using it", () => {
    expect(brandFor("teacher", "teacher")).toBe("Teacher console");
    expect(brandFor("teacher", "institute_admin")).toBe("Institute console");
    expect(brandFor("institute", "institute_admin")).toBe("Institute console");
    expect(brandFor("platform", "owner")).toBe("Platform console");
  });

  it("marks the current page: front pages exactly, others by their sub-pages too", () => {
    const overview = { href: "/institute", label: "Home", exact: true };
    expect(isActive("/institute", overview)).toBe(true);
    expect(isActive("/institute/members", overview)).toBe(false);

    const papers = { href: "/teacher/papers", label: "Papers" };
    expect(isActive("/teacher/papers", papers)).toBe(true);
    expect(isActive("/teacher/papers/abc-123", papers)).toBe(true);
    expect(isActive("/teacher/papers-old", papers)).toBe(false);
    expect(isActive("/teacher/generate", papers)).toBe(false);
  });

  it("only one item is active at a time, on every page an admin or the owner can reach", () => {
    for (const groups of [navFor("teacher", "institute_admin"), navFor("platform", "owner")]) {
      const all = groups.flatMap((g) => g.items);
      for (const page of [...all.map((i) => i.href), "/teacher/papers/some-id", "/platform/institutes/some-id"]) {
        if (!all.some((i) => page.startsWith(i.href))) continue;
        expect(all.filter((i) => isActive(page, i)).length, page).toBe(1);
      }
    }
  });

  it("gives every item an icon, and names each badge it counts", () => {
    for (const groups of [navFor("platform", "owner"), navFor("institute", "institute_admin"), navFor("teacher", "teacher")]) {
      for (const item of groups.flatMap((g) => g.items)) expect(item.icon, item.href).toBeTruthy();
    }
    const badges = navFor("platform", "owner").flatMap((g) => g.items).flatMap((i) => (i.badge ? [i.badge] : []));
    expect(badges.sort()).toEqual(["access", "review", "subjects"]);
  });
});
