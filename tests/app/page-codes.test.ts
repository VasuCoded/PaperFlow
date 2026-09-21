import { describe, expect, it } from "vitest";
import { pageCodeCss } from "@/lib/print/page-codes";

describe("pageCodeCss", () => {
  it("gives each document its own named page with its code in the top-right margin", () => {
    const css = pageCodeCss([
      { pageName: "pf-doc-0", text: "SSA-10SCI-260922-03 · Set A" },
      { pageName: "pf-doc-1", text: "SSA-10SCI-260922-03 · Answer key · Set A" },
    ]);
    expect(css).toContain('@page pf-doc-0 { @top-right { content: "SSA-10SCI-260922-03 · Set A";');
    expect(css).toContain('@page pf-doc-1 { @top-right { content: "SSA-10SCI-260922-03 · Answer key · Set A";');
  });

  it("cannot be used to break out of the string or the style element", () => {
    const css = pageCodeCss([{ pageName: "pf-doc-0", text: 'x"; } body { display:none } </style><script>' }]);
    expect(css).not.toContain("</style>");
    expect(css).not.toContain("<script>");
    expect(css).toContain('content: "x\\"; } body { display:none } /stylescript";');
  });

  it("ignores a page name that is not a plain identifier", () => {
    expect(pageCodeCss([{ pageName: "x { } @page y", text: "a" }])).toBe("");
  });
});
