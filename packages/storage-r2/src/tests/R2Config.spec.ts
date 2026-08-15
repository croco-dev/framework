import { describe, expect, it } from "vitest";
import { getMissingR2ConfigKeys, validateR2Options } from "../libs/R2Config";
import { MissingR2ConfigProblem } from "../libs/problems/MissingR2ConfigProblem";
import type { R2Options } from "../libs/types";

const validConfig: R2Options = {
  accountId: "test-account-id",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
  bucket: "test-bucket",
};

describe("R2Config", () => {
  it.each([
    ["accountId", "R2_ACCOUNT_ID", " "],
    ["accessKeyId", "R2_ACCESS_KEY_ID", "\t"],
    ["secretAccessKey", "R2_SECRET_ACCESS_KEY", "\n"],
    ["bucket", "R2_BUCKET", " \t\n "],
  ] as const)("rejects blank %s configuration", (field, configKey, value) => {
    const config = { ...validConfig, [field]: value };

    expect(getMissingR2ConfigKeys(config)).toEqual([configKey]);
    expect(() => validateR2Options(config)).toThrow(MissingR2ConfigProblem);
    expect(() => validateR2Options(config)).toThrow(
      `Missing required R2 configuration: ${configKey}`,
    );
  });

  it("preserves non-blank configuration values without normalization", () => {
    const config = {
      accountId: " account-id ",
      accessKeyId: "\taccess-key",
      secretAccessKey: "secret-key\n",
      bucket: " bucket ",
      publicUrlBase: " https://cdn.example.com ",
    };

    expect(validateR2Options(config)).toEqual(config);
  });
});
