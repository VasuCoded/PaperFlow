/**
 * The paper code on every printed page.
 *
 * One print job holds several documents (each set's paper, each answer key,
 * the mapping sheet), and each should carry its own line — "SSA-10SCI-260922-03
 * · Set B" — in the top corner of every one of its pages. CSS named pages do
 * exactly that: each document is laid out on its own named page, and each named
 * page has its own top-right margin box. (Chrome and Edge print margin boxes;
 * every document also prints the code in its header, for any browser that
 * does not.)
 */
export interface CodedDocument {
  /** a CSS identifier, used as the document's `page` */
  pageName: string;
  /** what the top corner of each of its pages says */
  text: string;
}

/** A CSS string literal that cannot end the string or the <style> element. */
function cssString(s: string): string {
  return `"${s.replace(/[<>]/g, "").replace(/[\\"]/g, (m) => `\\${m}`).replace(/[\r\n]+/g, " ")}"`;
}

export function pageCodeCss(docs: readonly CodedDocument[]): string {
  return docs
    .filter((d) => /^[a-z][a-z0-9-]*$/.test(d.pageName))
    .map(
      (d) =>
        `@page ${d.pageName} { @top-right { content: ${cssString(d.text)}; font-family: "Courier New", Courier, monospace; font-size: 8pt; color: #333; vertical-align: bottom; padding-bottom: 3mm; } }`,
    )
    .join("\n");
}
