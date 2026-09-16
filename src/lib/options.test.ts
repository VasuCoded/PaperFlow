import { describe, it, expect } from "vitest";
import { parseOptions } from "./options";

describe("parseOptions", () => {
  it("reads explicit key/text pairs in order", () => {
    expect(
      parseOptions([
        { key: "A", text: "one" },
        { key: "B", text: "two" },
      ]),
    ).toEqual([
      { key: "A", text: "one" },
      { key: "B", text: "two" },
    ]);
  });

  it("reads a keyed object, ordered by key", () => {
    expect(parseOptions({ B: "two", A: "one", C: "three" })).toEqual([
      { key: "A", text: "one" },
      { key: "B", text: "two" },
      { key: "C", text: "three" },
    ]);
  });

  it("assigns letters to a bare list by position", () => {
    expect(parseOptions(["x", "y", "z"])).toEqual([
      { key: "A", text: "x" },
      { key: "B", text: "y" },
      { key: "C", text: "z" },
    ]);
  });

  it("returns nothing for null or malformed values instead of throwing", () => {
    expect(parseOptions(null)).toEqual([]);
    expect(parseOptions(42)).toEqual([]);
    expect(parseOptions("A) one B) two")).toEqual([]);
    expect(parseOptions([{ nope: 1 }])).toEqual([]);
  });

  it("keeps TeX intact", () => {
    expect(parseOptions(["$\\ce{H2O}$"])[0]!.text).toBe("$\\ce{H2O}$");
  });
});
