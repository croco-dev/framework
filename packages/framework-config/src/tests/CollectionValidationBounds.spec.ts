import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ConfigValidationProblem } from "../libs/problems/ConfigProblems";
import { validateConfig } from "../validateConfig";

describe("collection validation bounds", () => {
  it.each(["max", "length"] as const)(
    "rejects oversized config arrays before visiting elements with %s",
    (bound) => {
      const visit = vi.fn(() => true);
      const element = z.string().refine(visit);
      const schema = z.object({
        VALUES: z
          .string()
          .transform((value) => value.split(","))
          .pipe(z.array(element)[bound](2)),
      });

      expect(() => validateConfig(schema, { VALUES: "one,two,three" })).toThrow(
        ConfigValidationProblem,
      );
      expect(visit).not.toHaveBeenCalled();
      expect(validateConfig(schema, { VALUES: "one,two" })).toEqual({ VALUES: ["one", "two"] });
      expect(visit).toHaveBeenCalledTimes(2);
    },
  );

  it("rejects oversized arrays before scheduling asynchronous element refinements", async () => {
    const visit = vi.fn(async () => true);
    const schema = z.array(z.string().refine(visit)).max(2);
    const result = await schema.safeParseAsync(["one", "two", "three"]);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({ code: "too_big", maximum: 2, path: [] }),
      ]);
    }
    expect(visit).not.toHaveBeenCalled();
    const invalidElements = await schema.safeParseAsync([1, 2, 3]);
    expect(invalidElements.success).toBe(false);
    if (!invalidElements.success) {
      expect(invalidElements.error.issues).toEqual([
        expect.objectContaining({ code: "too_big", maximum: 2, path: [] }),
      ]);
    }
  });

  it("rejects oversized sets and maps before visiting their entries", () => {
    const visit = vi.fn(() => true);
    const element = z.string().refine(visit);
    const set = z.set(element).max(2);
    const map = z.map(element, element).max(2);

    expect(set.safeParse(new Set(["one", "two", "three"])).success).toBe(false);
    expect(
      map.safeParse(
        new Map([
          ["one", "1"],
          ["two", "2"],
          ["three", "3"],
        ]),
      ).success,
    ).toBe(false);
    expect(visit).not.toHaveBeenCalled();
    expect(set.safeParse(new Set(["one", "two"])).success).toBe(true);
    expect(
      map.safeParse(
        new Map([
          ["one", "1"],
          ["two", "2"],
        ]),
      ).success,
    ).toBe(true);
    expect(visit).toHaveBeenCalledTimes(6);
  });
});
