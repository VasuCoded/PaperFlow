import { describe, it, expect } from "vitest";
import { renderRich, escapeHtml, hasMath } from "./math";

describe("renderRich", () => {
  it("renders inline math", () => {
    const html = renderRich("The value $x^2 + 1$ is positive.");
    expect(html).toContain("katex");
    expect(html).toContain("The value ");
    expect(html).toContain(" is positive.");
  });

  it("renders display math as a block", () => {
    const html = renderRich("Use $$\\frac{1}{f} = \\frac{1}{v} - \\frac{1}{u}$$ here.");
    expect(html).toContain("katex-display");
  });

  it("renders chemistry via mhchem", () => {
    const html = renderRich("$\\ce{Fe + CuSO4 -> FeSO4 + Cu}$");
    expect(html).toContain("katex");
    // KaTeX renders an UNKNOWN command as red error markup rather than throwing,
    // so the real assertion is "no error styling" — checking merely that the
    // literal "\ce{" is absent passes even when nothing rendered, because the
    // brace is consumed separately. That false positive shipped a broken paper.
    expect(html).not.toContain("katex-error");
    expect(html).not.toContain("#cc0000");
    // a real \ce expansion is substantial markup, not a stub
    expect(html.length).toBeGreaterThan(1000);
  });

  it("renders an mhchem equation with state symbols and arrows", () => {
    const html = renderRich("$\\ce{3Fe + 4H2O -> Fe3O4 + 4H2}$");
    expect(html).not.toContain("katex-error");
    expect(html).not.toContain("#cc0000");
    expect(html.length).toBeGreaterThan(1000);
  });

  it("flags a genuinely unknown command as error markup", () => {
    // guards the guard: proves the assertions above can actually fail
    const html = renderRich("$\\notarealmacro{x}$");
    expect(html).toContain("#cc0000");
  });

  it("escapes plain text so question bodies cannot inject markup", () => {
    const html = renderRich('5 < 6 & "quoted" <script>alert(1)</script>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("never throws on malformed TeX", () => {
    expect(() => renderRich("$\\frac{1}{$")).not.toThrow();
    expect(() => renderRich("$\\nonsensemacro{}$")).not.toThrow();
  });

  it("passes through text with no math", () => {
    expect(renderRich("Name the type of reaction.")).toBe("Name the type of reaction.");
  });
});

describe("escapeHtml / hasMath", () => {
  it("escapes the five dangerous characters", () => {
    expect(escapeHtml('<>&"\'')).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("detects math delimiters", () => {
    expect(hasMath("$x$")).toBe(true);
    expect(hasMath("$$x$$")).toBe(true);
    expect(hasMath("no math here")).toBe(false);
  });
});
