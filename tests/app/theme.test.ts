import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isDark, parseTheme, THEME_KEY, THEME_SCRIPT } from "@/lib/theme";

const css = (f: string) => readFileSync(join(__dirname, "../../src/styles", f), "utf8");
const paperflow = css("paperflow.css");
const app = css("app.css");

/** The custom properties declared inside the first `{...}` after `selector`. */
function tokensAfter(source: string, selector: string): Map<string, string> {
  const at = source.indexOf(selector);
  expect(at, `selector ${selector}`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("{", at + selector.length);
  const close = source.indexOf("}", open);
  const body = source.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, "");
  const out = new Map<string, string>();
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out.set(m[1]!, m[2]!.trim());
  return out;
}

describe("theme tokens", () => {
  const light = tokensAfter(paperflow, ".pf-ui .stay-light");
  const dark = tokensAfter(paperflow, ':root[data-theme="dark"] .pf-ui');

  it("dark mode redefines every colour token the light theme has", () => {
    expect(light.size).toBeGreaterThan(30);
    const missing = [...light.keys()].filter((k) => !dark.has(k));
    expect(missing).toEqual([]);
  });

  it("light is the default: no stylesheet switches to dark on the device setting alone", () => {
    for (const source of [paperflow, app, readFileSync(join(__dirname, "../../src/app/globals.css"), "utf8")]) {
      expect(source).not.toMatch(/prefers-color-scheme:\s*dark/);
    }
  });

  it("every token the stylesheets use is defined", () => {
    // the base block (fonts, motion) follows the .stay-light text rule
    const base = tokensAfter(paperflow, ".pf-ui .stay-light { color: var(--ink); }");
    const defined = new Set([...light.keys(), ...base.keys()]);
    // fonts and per-component variables are defined elsewhere on purpose
    const allowed = /^--(font-|width$|dur|ease|ui$|mono$|serif$)/;
    const used = new Set([...(paperflow + app).matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]!));
    const localDefs = new Set([...(paperflow + app).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]!));
    const undefinedTokens = [...used].filter((t) => !defined.has(t) && !localDefs.has(t) && !allowed.test(t));
    expect(undefinedTokens).toEqual([]);
  });

  it("no rule paints a literal colour outside the token blocks", () => {
    // Strip the token declarations themselves, then look for any hex or rgb() literal.
    const strip = (s: string) =>
      s
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/--[a-z0-9-]+\s*:[^;]+;/g, "");
    const literals = (s: string) =>
      strip(s)
        .split("\n")
        .filter((l) => /#[0-9a-f]{3,8}\b|rgba?\((?!var\()/i.test(l))
        .map((l) => l.trim());
    // The deliberate exceptions, each commented in the stylesheet.
    const allowed = [
      /^\.lp-role h3 \.icon/, // the landing page's panels are dark in both themes
      /^\.lp-role li /,
      /^\.lp-cta p /,
      /^\.lp-ctaghost /,
      /^\.figthumb img/, // figures are drawn on white
      /^\.switch \.knob/, // the knob's drop shadow is black in both themes
    ];
    const offenders = [...literals(paperflow), ...literals(app)].filter((l) => !allowed.some((a) => a.test(l)));
    expect(offenders).toEqual([]);
  });
});

describe("theme preference", () => {
  it("defaults to light; only dark and system are kept", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
    for (const v of [null, undefined, "", "light", "DARK", "<script>", 1]) expect(parseTheme(v)).toBe("light");
  });

  it("system follows the device; light and dark ignore it", () => {
    expect(isDark("light", true)).toBe(false);
    expect(isDark("dark", false)).toBe(true);
    expect(isDark("system", true)).toBe(true);
    expect(isDark("system", false)).toBe(false);
  });

  it("the pre-paint script applies a stored choice and never throws", () => {
    const attrs = new Map<string, string>();
    const run = (stored: string | null, deviceDark = false, throws = false) => {
      attrs.clear();
      const localStorage = {
        getItem: (k: string) => {
          if (throws) throw new Error("blocked");
          return k === THEME_KEY ? stored : null;
        },
      };
      const matchMedia = () => ({ matches: deviceDark });
      const document = { documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v) } };
      new Function("localStorage", "matchMedia", "document", THEME_SCRIPT)(localStorage, matchMedia, document);
      return attrs.get("data-theme");
    };
    expect(run("dark")).toBe("dark");
    expect(run(null, true)).toBeUndefined(); // a dark device alone does not make the page dark
    expect(run("system", true)).toBe("dark");
    expect(run("system", false)).toBeUndefined();
    expect(run("evil", true)).toBeUndefined();
    expect(run("dark", false, true)).toBeUndefined();
  });
});
