import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionPaper } from "./QuestionPaper";
import { AnswerKey } from "./AnswerKey";
import { MappingSheet } from "./MappingSheet";
import { SAMPLE_SCIENCE_PAPER as CANON } from "@/lib/print/sample-paper";
import { buildHindiSampleModel } from "@/lib/print/model";
import {
  toShufflePaper,
  composeSetPaper,
  composeSetKey,
  composeMapping,
} from "@/lib/print/compose";
import { buildSets } from "@/server/sets";

const built = buildSets(toShufflePaper(CANON), 3, 40, 20260903);

/**
 * Every print artefact must render its math. A component that forgets to call
 * renderRich prints raw TeX ("$1\,\Omega$") onto a real exam paper — which is
 * exactly what shipped on the mapping sheet, because only two of the three
 * components rendered their text.
 */
function expectNoRawTeX(markup: string, where: string) {
  // strip the KaTeX annotation node, which legitimately carries TeX source
  const visible = markup.replace(/<annotation[^>]*>[\s\S]*?<\/annotation>/g, "");
  expect(visible, `${where}: unrendered $...$ delimiter`).not.toMatch(/\$/);
  expect(visible, `${where}: unrendered \\ce macro`).not.toContain("\\ce");
  expect(visible, `${where}: unrendered \\frac macro`).not.toContain("\\frac");
  expect(visible, `${where}: unrendered \\mathrm macro`).not.toContain("\\mathrm");
}

describe("print components render all math", () => {
  for (const set of built.sets) {
    it(`question paper, set ${set.setLabel}`, () => {
      const markup = renderToStaticMarkup(
        createElement(QuestionPaper, { model: composeSetPaper(CANON, set, 3) }),
      );
      expectNoRawTeX(markup, `paper ${set.setLabel}`);
      expect(markup).toContain("katex");
    });

    it(`answer key, set ${set.setLabel}`, () => {
      const markup = renderToStaticMarkup(
        createElement(AnswerKey, { model: composeSetKey(CANON, set) }),
      );
      expectNoRawTeX(markup, `key ${set.setLabel}`);
      expect(markup).toContain("katex");
    });
  }

  it("mapping sheet", () => {
    const markup = renderToStaticMarkup(
      createElement(MappingSheet, { model: composeMapping(CANON, built.sets) }),
    );
    expectNoRawTeX(markup, "mapping sheet");
    expect(markup).toContain("katex");
  });

  it("mapping sheet keeps real answers instead of deferring everything to the key", () => {
    const model = composeMapping(CANON, built.sets);
    const deferred = model.rows.filter((r) => r.answer === "see key");
    // only the multi-part case-study block should defer
    expect(deferred).toHaveLength(1);
    expect(deferred[0]!.marks).toBe(5);
  });

  it("hindi paper renders with no stray markup", () => {
    const markup = renderToStaticMarkup(
      createElement(QuestionPaper, { model: buildHindiSampleModel("A") }),
    );
    expectNoRawTeX(markup, "hindi paper");
    expect(markup).toContain("pf-deva");
  });
});
