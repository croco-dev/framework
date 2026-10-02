import { describe, expect, it } from "vitest";
import { DrizzleExperimentStore } from "../index";
import type { FeaturePolicyPgDatabase } from "../index";

describe("DrizzleExperimentStore failures", () => {
  it("preserves database failure evidence without returning a missing record", async () => {
    const cause = new Error("connection closed");
    const database: FeaturePolicyPgDatabase = {
      execute: async () => {
        throw cause;
      },
      transaction: async () => {
        throw cause;
      },
    };
    const store = new DrizzleExperimentStore(database);
    await expect(store.getAssignment("assignment")).rejects.toMatchObject({
      code: "features/experiment/unavailable",
      cause,
    });
  });
});
