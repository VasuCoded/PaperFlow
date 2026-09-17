import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * BUILD-PLAN C2b tests that are about the application rather than the
 * database:
 *   - every /platform route returns 404 for student, teacher and
 *     institute_admin
 *   - create_institute is the only code path inserting into institutes
 * (The database half of the second — no role can insert directly — is in
 * tests/db/platform.test.ts.)
 */

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/db/server", () => ({ createServerSupabaseClient: async () => ({}) }));

const { canAccess, homePath, PLATFORM_INSTITUTE_ID } = await import("@/server/session");
type Session = Parameters<typeof canAccess>[1] & object;

const ROOT = join(__dirname, "..", "..");
const INST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function session(role: "owner" | "institute_admin" | "teacher" | "student"): Session {
  const onPlatform = role === "owner";
  const membership = {
    instituteId: onPlatform ? PLATFORM_INSTITUTE_ID : INST,
    instituteName: onPlatform ? "PaperFlow" : "Sunrise",
    instituteSlug: onPlatform ? "platform" : "sunrise",
    role,
    kind: onPlatform ? ("platform" as const) : ("institute" as const),
  };
  return {
    userId: "u",
    email: `${role}@x.test`,
    fullName: null,
    memberships: [membership],
    instituteId: membership.instituteId,
    role,
    isPlatformOwner: onPlatform,
  };
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const rel = (p: string) => relative(ROOT, p).replace(/\\/g, "/");

describe("area access (the rule AppShell applies before rendering)", () => {
  it("lets only the platform owner into /platform", () => {
    expect(canAccess("platform", session("owner"))).toBe(true);
    for (const role of ["institute_admin", "teacher", "student"] as const) {
      expect(canAccess("platform", session(role)), role).toBe(false);
    }
    expect(canAccess("platform", null)).toBe(false);
  });

  it("does not treat a platform-institute membership without the owner role as the owner", () => {
    const s = session("teacher");
    const odd: Session = {
      ...s,
      memberships: [{ ...s.memberships[0]!, instituteId: PLATFORM_INSTITUTE_ID, kind: "platform" }],
      instituteId: PLATFORM_INSTITUTE_ID,
    };
    expect(canAccess("platform", odd)).toBe(false);
  });

  it("lets only institute admins into /institute, and teachers and admins into /teacher", () => {
    expect(canAccess("institute", session("institute_admin"))).toBe(true);
    for (const role of ["teacher", "student"] as const) expect(canAccess("institute", session(role)), role).toBe(false);
    expect(canAccess("teacher", session("teacher"))).toBe(true);
    expect(canAccess("teacher", session("institute_admin"))).toBe(true);
    expect(canAccess("teacher", session("student"))).toBe(false);
  });

  it("sends each role to its own home", () => {
    expect(homePath(session("owner"))).toBe("/platform");
    expect(homePath(session("institute_admin"))).toBe("/institute");
    expect(homePath(session("teacher"))).toBe("/teacher/generate");
    expect(homePath(session("student"))).toBe("/app");
    expect(homePath({ ...session("student"), memberships: [], instituteId: null, role: null })).toBe("/welcome");
  });
});

describe("every guarded route actually applies the guard", () => {
  const shell = readFileSync(join(ROOT, "src/app/(main)/_components/AppShell.tsx"), "utf8");

  it("AppShell 404s (not 403s) anyone the area does not admit", () => {
    expect(shell).toMatch(/if \(!canAccess\(area, session\)\) notFound\(\);/);
  });

  for (const [area, dir] of [
    ["platform", "src/app/(main)/platform"],
    ["institute", "src/app/(main)/institute"],
    ["teacher", "src/app/(main)/teacher"],
  ] as const) {
    const files = walk(join(ROOT, dir));
    const pages = files.filter((f) => f.endsWith("page.tsx"));
    const routes = files.filter((f) => f.endsWith("route.ts"));

    it(`every ${area} page renders inside <AppShell area="${area}">`, () => {
      expect(pages.length).toBeGreaterThan(0);
      for (const p of pages) {
        expect(readFileSync(p, "utf8"), rel(p)).toContain(`area="${area}"`);
      }
    });

    if (routes.length > 0) {
      it(`every ${area} route handler returns 404 to anyone else`, () => {
        for (const r of routes) {
          const src = readFileSync(r, "utf8");
          expect(src, rel(r)).toMatch(area === "platform" ? /isPlatformOwner/ : /institute_admin/);
          expect(src, rel(r)).toMatch(/status: 404/);
        }
      });
    }
  }

  it("no platform page calls a platform function (which may write the access log) before checking the owner", () => {
    const pages = walk(join(ROOT, "src/app/(main)/platform")).filter((f) => f.endsWith(".tsx") && !f.includes(`${"_"}components`));
    for (const p of pages) {
      const src = readFileSync(p, "utf8");
      if (/\.rpc\("platform_/.test(src) && !src.includes('"use client"')) {
        expect(src, rel(p)).toContain("isPlatformOwner");
      }
    }
  });
});

describe("create_institute is the only code path inserting into institutes", () => {
  it("no application or script code writes to the institutes table", () => {
    const code = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "scripts"))].filter((f) => /\.(ts|tsx)$/.test(f));
    const offenders = code.filter((f) =>
      /from\(\s*["'`]institutes["'`]\s*\)\s*\.\s*(insert|upsert)/.test(readFileSync(f, "utf8").replace(/\s+/g, " ")),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it("in SQL, only create_institute and the platform pseudo-institute seed insert into institutes", () => {
    const dir = join(ROOT, "supabase/migrations");
    const found: string[] = [];
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
      const sql = readFileSync(join(dir, name), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "") // DOWN blocks and other block comments
        .replace(/--[^\n]*/g, "");
      const fn = /create or replace function public\.(\w+)\s*\([\s\S]*?\$\$([\s\S]*?)\$\$/gi;
      const ranges: { name: string; start: number; end: number }[] = [];
      for (let m; (m = fn.exec(sql)); ) ranges.push({ name: m[1]!, start: m.index, end: m.index + m[0].length });

      const insert = /insert\s+into\s+(public\.)?institutes\b/gi;
      for (let m; (m = insert.exec(sql)); ) {
        const owner = ranges.find((r) => m!.index >= r.start && m!.index < r.end);
        if (owner) {
          found.push(`${name}: function ${owner.name}`);
        } else {
          const stmt = sql.slice(m.index, sql.indexOf(";", m.index));
          const seedsPlatform = stmt.includes(PLATFORM_INSTITUTE_ID) || /platform_institute_id\(\)/.test(stmt);
          found.push(seedsPlatform ? `${name}: platform seed` : `${name}: top-level insert`);
        }
      }
    }
    expect(found.sort()).toEqual(["20260903000001_create_tenancy.sql: function create_institute", "20260903000001_create_tenancy.sql: platform seed"]);
  });
});
