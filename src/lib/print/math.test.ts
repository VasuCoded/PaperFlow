import { describe, it, expect } from "vitest";
import { renderRich, escapeHtml, hasMath, firstWordsTex } from "./math";

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

describe("firstWordsTex", () => {
  it("keeps whole math segments and counts each as one word", () => {
    expect(firstWordsTex("If $x = 2$, what is $x^2 + 3$ when y is large", 4)).toBe("If $x = 2$, what is…");
    expect(firstWordsTex("Balance $\ce{H2 + O2 -> H2O}$ now", 2)).toBe("Balance $\ce{H2 + O2 -> H2O}$…");
  });

  it("returns short bodies unchanged", () => {
    expect(firstWordsTex("Define refraction.", 12)).toBe("Define refraction.");
  });

  it("renders without a broken delimiter after truncation", () => {
    const html = renderRich(firstWordsTex("Find $\frac{a}{b}$ where $a = 10$ and $b = 5$ exactly", 3));
    expect(html).toContain("katex");
    expect(html).not.toContain("$");
  });
});

describe("figures in question bodies", () => {
  const id = "0f8e2c1a-5b6d-4e7f-8a9b-0c1d2e3f4a5b";
  it("renders a figure marker as an image served by /asset", () => {
    const html = renderRich(`Look at the graph. [[fig:${id}]] How many zeroes?`);
    expect(html).toContain(`<img src="/asset/${id}"`);
    expect(html).toContain('class="qfig"');
    expect(html).not.toContain("[[fig:");
  });
  it("leaves anything that is not a real id as plain, escaped text", () => {
    expect(renderRich("[[fig:../../etc]]")).toBe("[[fig:../../etc]]");
    expect(renderRich('[[fig:x"><script>]]')).not.toContain("<script>");
  });
  it("keeps figures out of the short preview a student confirms", () => {
    expect(firstWordsTex(`[[fig:${id}]] The graph of $y = p(x)$ is shown.`, 4)).not.toContain("fig");
  });
});
