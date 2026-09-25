import { describe, expect, it } from "vitest";
import { createFactHistory, dropFactHistory } from "../index";

describe("Fact history migration", () => {
  it.each([createFactHistory, dropFactHistory])(
    "preserves migration failure causes",
    async (migrate) => {
      const failure = new Error("Database unavailable");
      await expect(migrate({ execute: () => Promise.reject(failure) })).rejects.toMatchObject({
        code: "analytics/fact-history/persistence-failed",
        cause: failure,
      });
    },
  );
});
