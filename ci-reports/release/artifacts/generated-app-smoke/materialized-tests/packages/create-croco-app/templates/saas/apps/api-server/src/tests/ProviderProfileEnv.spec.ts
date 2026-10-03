import { describe, expect, it } from "vitest";
import { assertRealProviderEnv, ProviderProfileEnvMissingError } from "../provider-profile-env";

const manifest = {
  profile: { name: "saas-node-postgres" },
  env: {
    required: [{ name: "DATABASE_URL" }, { name: "AUTH_SECRET" }],
  },
} as const;

describe("ProviderProfileEnv", () => {
  it("reports missing real-provider variables without exposing configured values", () => {
    let thrown: unknown;
    try {
      assertRealProviderEnv(manifest, {
        SAAS_PROVIDER_PROFILE: "saas-node-postgres",
        DATABASE_URL: "postgres://redacted",
        AUTH_SECRET: "<replace-me>",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ProviderProfileEnvMissingError);
    expect(thrown).toMatchObject({
      message: "CROCO_SAAS_PROFILE_ENV_MISSING: AUTH_SECRET",
      diagnostic: {
        code: "CROCO_SAAS_PROFILE_ENV_MISSING",
        fields: { missingEnv: ["AUTH_SECRET"] },
      },
    });
  });

  it("accepts a complete matching provider environment", () => {
    expect(() =>
      assertRealProviderEnv(manifest, {
        SAAS_PROVIDER_PROFILE: "saas-node-postgres",
        DATABASE_URL: "postgres://configured",
        AUTH_SECRET: "configured",
      }),
    ).not.toThrow();
  });
});
