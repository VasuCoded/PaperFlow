/**
 * Server-side math rendering for print (BUILD-PLAN C7: "KaTeX server-rendered,
 * so print does not depend on fonts loading").
 *
 * PCM is the core of this product, so notation has to survive the printer:
 * lens formulae, quadratics, vectors, and chemical equations. mhchem is loaded
 * so `\ce{...}` works for Chemistry.
 *
 * Question bodies carry TeX between delimiters:
 *   $ ... $    inline
 *   $$ ... $$  display (own line, centred)
 * Everything outside the delimiters is plain text and is HTML-escaped.
 */
import katex from "katex";
import "katex/dist/contrib/mhchem";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

/** Split on $$...$$ / $...$ and render the math segments with KaTeX. */
export function renderRich(text: string): string {
  const out: string[] = [];
  // $$...$$ first (display), then single-$ inline that does not span lines.
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    out.push(escapeHtml(text.slice(last, m.index)));
    const display = m[1] != null;
    const tex = (m[1] ?? m[2] ?? "").trim();
    out.push(
      katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false, // a bad expression prints as red source, never crashes a paper
        strict: false,
        output: "html", // no MathML duplicate — it doubles text in some print engines
      }),
    );
    last = m.index + m[0].length;
  }
  out.push(escapeHtml(text.slice(last)));
  return out.join("");
}

/** True when the string contains any math delimiters worth rendering. */
export function hasMath(text: string): boolean {
  return /\$[^$\n]+\$|\$\$[\s\S]+?\$\$/.test(text);
}
