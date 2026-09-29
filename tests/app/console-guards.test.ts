import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The console frame lives in each area's layout (so it stays on screen between
 * clicks), but a layout is not a security boundary: a crafted request can ask
 * for a page without re-running its layout. So every console PAGE must do its
 * own access check, through <AppShell area="...">, and that area must be the
 * one it lives in. This fails for any page added without one.
 */
const MAIN = join(__dirname, "..", "..", "src", "app", "(main)");

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return pages(p);
    return name === "page.tsx" ? [p] : [];
  });
}

describe("console pages guard themselves", () => {
  for (const area of ["platform", "institute", "teacher"] as const) {
    const found = pages(join(MAIN, area));

    it(`${area}: has pages to check`, () => {
      expect(found.length).toBeGreaterThan(0);
    });

    for (const file of found) {
      const rel = file.slice(MAIN.length + 1).replace(/\\/g, "/");
      it(`${rel} checks access for "${area}"`, () => {
        const src = readFileSync(file, "utf8");
        const areas = [...src.matchAll(/<AppShell\b[^>]*\barea="([a-z]+)"/g)].map((m) => m[1]);
        expect(areas.length, "no <AppShell area=...> in this page").toBeGreaterThan(0);
        expect(new Set(areas)).toEqual(new Set([area]));
      });
    }

    it(`${area}: the layout draws the frame for the same area`, () => {
      const layout = readFileSync(join(MAIN, area, "layout.tsx"), "utf8");
      expect(layout).toContain(`<ConsoleFrame area="${area}">`);
    });
  }
});
