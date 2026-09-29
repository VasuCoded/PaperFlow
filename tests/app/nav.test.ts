import { describe, expect, it } from "vitest";
import { brandFor, isActive, navFor, type NavGroup } from "@/lib/nav";

const links = (groups: NavGroup[]) => groups.flatMap((g) => g.items.map((i) => i.href));
const labels = (groups: NavGroup[]) => groups.flatMap((g) => g.items.map((i) => i.label));

describe("console menu", () => {
  it("gives an institute admin the institute pages AND the teaching pages, in both consoles", () => {
    for (const area of ["institute", "teacher"] as const) {
      const groups = navFor(area, "institute_admin");
      expect(groups.map((g) => g.title)).toEqual(["Institute", "Teaching"]);
      expect(links(groups)).toEqual([
        "/institute", "/institute/members", "/institute/teachers", "/institute/subjects", "/institute/export",
        "/teacher/generate", "/teacher/papers", "/teacher/batches", "/teacher/flagged",
      ]);
    }
  });

  it("leaves a teacher's menu exactly as it was, with no institute pages", () => {
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

  it("leaves the platform menu alone, whoever looks", () => {
    for (const role of ["owner", "institute_admin", null]) {
      const groups = navFor("platform", role);
      expect(groups).toHaveLength(1);
      expect(links(groups)).toHaveLength(9);
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
    const overview = { href: "/institute", label: "Overview", exact: true };
    expect(isActive("/institute", overview)).toBe(true);
    expect(isActive("/institute/members", overview)).toBe(false);

    const papers = { href: "/teacher/papers", label: "Papers" };
    expect(isActive("/teacher/papers", papers)).toBe(true);
    expect(isActive("/teacher/papers/abc-123", papers)).toBe(true);
    expect(isActive("/teacher/papers-old", papers)).toBe(false);
    expect(isActive("/teacher/generate", papers)).toBe(false);
  });

  it("only one item is active at a time, on every page an admin can reach", () => {
    const groups = navFor("teacher", "institute_admin");
    const all = groups.flatMap((g) => g.items);
    for (const page of [...all.map((i) => i.href), "/teacher/papers/some-id", "/institute/members"]) {
      expect(all.filter((i) => isActive(page, i)).length, page).toBe(1);
    }
  });
});
