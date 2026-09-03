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
    // mhchem expands to real markup, not the literal source
    expect(html).not.toContain("\\ce{");
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
