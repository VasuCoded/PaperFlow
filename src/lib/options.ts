import type { Json } from "@/lib/database.types";

export interface OptionItem {
  key: string;
  text: string;
}

const LETTERS = "ABCDEFGHIJ";

/**
 * questions.options is jsonb, and ingestion sessions will not all write it the
 * same way. Accept the three shapes that are reasonable and normalise to
 * ordered {key, text} pairs:
 *
 *   [{ "key": "A", "text": "..." }, ...]   explicit
 *   { "A": "...", "B": "..." }              keyed object (order = key order)
 *   ["...", "...", "..."]                    bare list (keys A, B, C by position)
 *
 * Anything else yields no options, so a malformed row prints as a question
 * without options rather than crashing a paper.
 */
export function parseOptions(value: Json | null | undefined): OptionItem[] {
  if (value == null) return [];

  if (Array.isArray(value)) {
    const out: OptionItem[] = [];
    value.forEach((item, i) => {
      if (typeof item === "string") {
        out.push({ key: LETTERS[i] ?? String(i + 1), text: item });
      } else if (item && typeof item === "object" && !Array.isArray(item)) {
        const key = item["key"];
        const text = item["text"];
        if (typeof text === "string") {
          out.push({
            key: typeof key === "string" && key.length > 0 ? key : (LETTERS[i] ?? String(i + 1)),
            text,
          });
        }
      }
    });
    return out;
  }

  if (typeof value === "object") {
    return Object.keys(value)
      .sort()
      .flatMap((k) => {
        const text = (value as Record<string, Json | undefined>)[k];
        return typeof text === "string" ? [{ key: k, text }] : [];
      });
  }

  return [];
}
