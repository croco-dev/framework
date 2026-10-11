import { describe, expect, it } from "vitest";
import { compareStrings } from "../../tooling/compareStrings.mjs";

describe("compareStrings", () => {
  it("orders strings by their ordinal value", () => {
    expect(["Tasks", "Zones", "checkout", "Checkout", "", "ä", "_"].sort(compareStrings)).toEqual([
      "",
      "Checkout",
      "Tasks",
      "Zones",
      "_",
      "checkout",
      "ä",
    ]);
  });

  it("returns zero for equal strings and opposite signs for unequal strings", () => {
    for (const left of ["", "a", "A", "é", "😀"]) {
      expect(compareStrings(left, left)).toBe(0);
      for (const right of ["", "z", "Z", "ö", "🦎"]) {
        expect(compareStrings(left, right)).toBe(-compareStrings(right, left) || 0);
      }
    }
  });
});
