import { describe, expect, it } from "vitest";
import {
  readGeneratedTemplateSecretAllowlistsFromMetadata,
  validateSaasProviderSecretPlaceholderPolicy,
  type SecretPlaceholderArtifacts,
  type SecretPlaceholderProfileManifest,
} from "../secret-placeholder-policy";

describe("secret placeholder policy", () => {
  it("requires boolean env documentation to pair each env name with its rendered value", () => {
    const manifest: SecretPlaceholderProfileManifest = {
      profile: { name: "saas-test" },
      env: {
        required: [
          {
            name: "FEATURE_ALPHA_ENABLED",
            requiredForRealProvider: true,
            secret: false,
            example: "true",
          },
          {
            name: "FEATURE_BETA_ENABLED",
            requiredForRealProvider: true,
            secret: false,
            example: "true",
          },
        ],
        optional: [],
      },
    };
    const artifacts: SecretPlaceholderArtifacts = {
      envExample: ["FEATURE_ALPHA_ENABLED=true", "FEATURE_BETA_ENABLED=true"].join("\n"),
      providerProfileDocs: [
        "| Env | Safe value | Kind |",
        "| --- | --- | --- |",
        "| `FEATURE_ALPHA_ENABLED` | `true` | config |",
        "`FEATURE_BETA_ENABLED` is listed without its safe value.",
      ].join("\n"),
      secretsChecklist: [
        "- [ ] `FEATURE_ALPHA_ENABLED` = `true`",
        "- [ ] `FEATURE_BETA_ENABLED` is listed without its safe value.",
      ].join("\n"),
    };

    const violations = validateSaasProviderSecretPlaceholderPolicy(manifest, artifacts);

    expect(violations).toEqual([
      expect.objectContaining({
        artifact: "providerProfileDocs",
        code: "CROCO_SECRET_PLACEHOLDER_PROVIDER_DOCS_MISSING",
        message: "docs/provider-profile.md must document FEATURE_BETA_ENABLED with true",
      }),
      expect.objectContaining({
        artifact: "secretsChecklist",
        code: "CROCO_SECRET_PLACEHOLDER_CHECKLIST_MISSING",
        message: "docs/secrets-checklist.md must document FEATURE_BETA_ENABLED with true",
      }),
    ]);
  });

  it("rejects wildcard-heavy and backtracking-heavy generated-template allowlist regexes", () => {
    const result = readGeneratedTemplateSecretAllowlistsFromMetadata(
      {
        secretScan: {
          generatedTemplates: {
            allowlists: [
              {
                pathPattern: ".*templates/.*fixture.*",
                matchPattern: "^POLAR_ACCESS_TOKEN=",
                owner: "security",
                reason: "Fixture for broad generated-template path allowlist rejection.",
                reviewBy: "2027-01-31",
              },
              {
                pathPattern: "^templates/fixture\\.env$",
                matchPattern: "^(a+)+$",
                owner: "security",
                reason: "Fixture for nested quantifier rejection.",
                reviewBy: "2027-01-31",
              },
            ],
          },
        },
      },
      "2026-07-03",
    );

    expect(result.violations).toEqual([
      expect.objectContaining({
        message:
          "secretScan.generatedTemplates.allowlists[0].pathPattern must not be a catch-all regular expression",
      }),
      expect.objectContaining({
        message:
          "secretScan.generatedTemplates.allowlists[1].matchPattern must be a valid and bounded regular expression",
      }),
    ]);
  });
});
