import { describe, expect, it } from "vitest";
import { createFeaturesSchema, dropFeaturesSchema, FeaturePolicyMigrationProblem } from "../index";

describe("FeaturesSchema", () => {
  it.each([createFeaturesSchema, dropFeaturesSchema])(
    "preserves the database error as the migration cause",
    async (migrate) => {
      const cause = new Error("database unavailable");
      const client = {
        execute: async () => {
          throw cause;
        },
      };

      await expect(migrate(client)).rejects.toMatchObject({
        code: "features/policy/unavailable",
        cause,
      });
      await expect(migrate(client)).rejects.toBeInstanceOf(FeaturePolicyMigrationProblem);
    },
  );
});
