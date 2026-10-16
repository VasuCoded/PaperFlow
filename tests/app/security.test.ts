import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";
import { isSameOrigin } from "@/lib/same-origin";
import { sniffImage } from "@/lib/image-sniff";
import { renderRich } from "@/lib/print/math";

describe("safeNextPath (post-sign-in redirect)", () => {
  it("keeps same-site paths, with their query and hash", () => {
    expect(safeNextPath("/teacher/papers")).toBe("/teacher/papers");
    expect(safeNextPath("/app/log/abc?set=B#q3")).toBe("/app/log/abc?set=B#q3");
  });

  it("falls back for empty, relative and absolute values", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(null, "/welcome")).toBe("/welcome");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("teacher")).toBe("/");
    expect(safeNextPath("https://evil.example/")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("refuses protocol-relative and backslash tricks that leave the site", () => {
    expect(safeNextPath("//evil.example")).toBe("/");
    // browsers read "\" as "/" in http(s) URLs: "/\evil" is "//evil"
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/\\/evil.example")).toBe("/");
  });

  it("refuses control characters a URL parser would strip", () => {
    expect(safeNextPath("/\t/evil.example")).toBe("/");
    expect(safeNextPath("/\n/evil.example")).toBe("/");
  });

  it("the accepted value really stays on this origin", () => {
    for (const v of ["/a", "/a/b?c=d", "/%2F%2Fevil.example", "/@evil.example"]) {
      const out = safeNextPath(v);
      expect(new URL(out, "https://paperflow.app").host).toBe("paperflow.app");
    }
  });
});

describe("isSameOrigin (route-handler CSRF check)", () => {
  it("accepts a matching origin and a missing one", () => {
    expect(isSameOrigin("https://paperflow.app", "paperflow.app")).toBe(true);
    expect(isSameOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
    expect(isSameOrigin(null, "paperflow.app")).toBe(true);
  });

  it("refuses another site, a malformed origin, and a sandboxed frame", () => {
    expect(isSameOrigin("https://evil.example", "paperflow.app")).toBe(false);
    expect(isSameOrigin("https://paperflow.app.evil.example", "paperflow.app")).toBe(false);
    expect(isSameOrigin("not a url", "paperflow.app")).toBe(false);
    expect(isSameOrigin("null", "paperflow.app")).toBe(false);
    expect(isSameOrigin("https://paperflow.app", null)).toBe(false);
  });
});

describe("sniffImage (figure uploads)", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)].slice(0, 16));

  it("recognises PNG, JPEG and WebP signatures", () => {
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe("webp");
  });

  it("rejects anything else, whatever the browser claimed", () => {
    const html = new TextEncoder().encode("<html><script>");
    expect(sniffImage(html)).toBeNull();
    const svg = new TextEncoder().encode("<svg xmlns=");
    expect(sniffImage(svg)).toBeNull();
    // RIFF but not WebP (a WAV file)
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe("renderRich treats question text as data", () => {
  it("escapes HTML outside math", () => {
    const html = renderRich(`<img src=x onerror=alert(1)> and "quotes"`);
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("does not turn TeX links or raw-HTML commands into markup", () => {
    for (const tex of ["$\\href{javascript:alert(1)}{x}$", "$\\url{https://evil.example}$", "$\\htmlClass{x}{y}$"]) {
      const html = renderRich(tex);
      expect(html).not.toMatch(/<a\b/);
      expect(html).not.toContain("javascript:");
    }
  });

  it("survives a macro bomb without hanging", () => {
    const bomb = "$\\def\\a{\\b\\b}\\def\\b{\\c\\c}\\def\\c{\\d\\d}\\def\\d{xxxxxxxxxx}\\a\\a\\a\\a\\a\\a\\a\\a\\a\\a$";
    const started = Date.now();
    renderRich(bomb.repeat(20));
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
