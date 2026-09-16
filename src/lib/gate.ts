/**
 * The C11 activation gate, in one place (BUILD-PLAN "Activation gate"):
 * no chapter under 60 approved questions and no topic under 8. The remaining
 * two conditions — 3x per pattern section, and a teacher confirming generated
 * papers — need a human, so the console shows them as a reminder, not a check.
 */
export const GATE = { minPerChapter: 60, minPerTopic: 8 } as const;

export interface CoverageRow {
  approved: number;
  chapters: number;
  thinnest_chapter: string | null;
  thinnest_chapter_count: number | null;
  thinnest_topic_count: number | null;
}

export interface GateStatus {
  met: boolean;
  /** Plain-language reasons the gate is not met; empty when it is. */
  gaps: string[];
}

export function gateStatus(row: CoverageRow): GateStatus {
  const gaps: string[] = [];
  if (row.chapters === 0) {
    gaps.push("No chapters loaded yet");
    return { met: false, gaps };
  }
  const chapterMin = row.thinnest_chapter_count ?? 0;
  if (chapterMin < GATE.minPerChapter) {
    gaps.push(
      `${row.thinnest_chapter ?? "A chapter"} has ${chapterMin} approved (needs ${GATE.minPerChapter})`,
    );
  }
  if (row.thinnest_topic_count !== null && row.thinnest_topic_count < GATE.minPerTopic) {
    gaps.push(`Thinnest topic has ${row.thinnest_topic_count} (needs ${GATE.minPerTopic})`);
  }
  return { met: gaps.length === 0, gaps };
}
