import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getGeneratedSmokeMatrixCaseNames } from "../../../../scripts/create-croco-app-generated-smoke-matrix.mts";

import type {
  GeneratedRuntimeProfile,
  GeneratedRuntimeProfileCatalog,
  OutputContract,
} from "../output-contract";
import { OutputContractValidator } from "../output-contract-validator";

function createValidContract(overrides?: Partial<OutputContract>): OutputContract {
  return {
    presetName: "node",
    buildTime: "2025-01-01T00:00:00Z",
    format: "dual",
    artifacts: [
      { path: "index.js", format: "esm", type: "code" },
      { path: "index.cjs", format: "cjs", type: "code" },
      { path: "index.d.ts", format: "esm", type: "types" },
      { path: "entry.js", format: "esm", type: "code" },
      { path: "entry.cjs", format: "cjs", type: "code" },
      { path: "entry.d.ts", format: "esm", type: "types" },
    ],
    entries: [
      { exportName: ".", main: "index.js", cjs: "index.cjs", types: "index.d.ts" },
      { exportName: "./entry", main: "entry.js", cjs: "entry.cjs", types: "entry.d.ts" },
    ],
    ...overrides,
  };
}

describe("OutputContractValidator", () => {
  const validator = new OutputContractValidator();

  it("passes a valid contract", () => {
    const report = validator.validate(createValidContract());

    expect(report.passed).toBe(true);
    expect(report.results.filter((result) => result.severity === "error")).toHaveLength(0);
  });

  it("reports error when presetName is missing", () => {
    const contract = createValidContract({ presetName: "" });
    const report = validator.validate(contract);

    expect(report.passed).toBe(false);
    expect(report.results.some((result) => result.message.includes("presetName"))).toBe(true);
  });

  it("reports warning when artifacts is empty", () => {
    const contract = createValidContract({ artifacts: [] });
    const report = validator.validate(contract);

    expect(report.results.some((result) => result.message.includes("No artifacts"))).toBe(true);
  });

  it("reports error when entries is empty", () => {
    const contract = createValidContract({ entries: [] });
    const report = validator.validate(contract);

    expect(report.passed).toBe(false);
  });

  it("reports error when entry references missing artifact", () => {
    const contract = createValidContract({
      artifacts: [{ path: "index.js", format: "esm", type: "code" }],
      entries: [{ exportName: ".", main: "index.js", types: "index.d.ts" }],
    });
    const report = validator.validate(contract);

    expect(report.passed).toBe(false);
    expect(
      report.results.some(
        (result) => result.message.includes("index.d.ts") && result.severity === "error",
      ),
    ).toBe(true);
  });

  it("reports error when types file is missing from entry", () => {
    const contract = createValidContract({
      entries: [{ exportName: ".", main: "index.js", types: "" }],
    });
    const report = validator.validate(contract);

    expect(report.passed).toBe(false);
    expect(
      report.results.some(
        (result) => result.message.includes("types") && result.severity === "error",
      ),
    ).toBe(true);
  });

  it("does not require optional cjs entry artifacts when cjs is omitted", () => {
    const contract = createValidContract({
      artifacts: [
        { path: "index.js", format: "esm", type: "code" },
        { path: "index.d.ts", format: "esm", type: "types" },
      ],
      entries: [{ exportName: ".", main: "index.js", types: "index.d.ts" }],
    });
    const report = validator.validate(contract);

    expect(report.passed).toBe(true);
  });

  it("handles empty contract gracefully", () => {
    const report = validator.validate({
      presetName: "",
      buildTime: "",
      format: "esm",
      artifacts: [],
      entries: [],
    });

    expect(report.passed).toBe(false);
    expect(report.results.length).toBeGreaterThan(0);
  });

  it("reports error when contract format is unsupported", () => {
    const contract = createValidContract({ format: "iife" as unknown as OutputContract["format"] });
    const report = validator.validate(contract);

    expect(report.passed).toBe(false);
    expect(report.results.some((result) => result.message.includes("not supported"))).toBe(true);
  });
});

describe("Generated runtime profile catalog", () => {
  const validator = new OutputContractValidator();
  const profileCatalog = readRuntimeProfileCatalog();

  it.each(profileCatalog.profiles)("validates the $name generated runtime profile", (profile) => {
    const report = validator.validateGeneratedRuntimeProfile(profile);

    expect(report.passed).toBe(true);
    expect(report.results.filter((result) => result.severity === "error")).toHaveLength(0);
  });

  it("validates every runtime profile and catalog claim together", () => {
    const report = validator.validateGeneratedRuntimeProfileCatalog(profileCatalog, {
      claimedRuntimes: readPresentationPresetRuntimeClaims(),
    });

    expect(report.passed).toBe(true);
    expect(report.results.filter((result) => result.severity === "error")).toHaveLength(0);
  });

  it("names generated app smoke cases that exist in the smoke matrix", () => {
    const smokeCaseNames = new Set(getGeneratedSmokeMatrixCaseNames());

    for (const profile of profileCatalog.profiles) {
      expect(smokeCaseNames).toContain(profile.generatedAppSmokeCase);
    }
  });

  it("fails when a catalog runtime claim has no generated profile evidence", () => {
    const report = validator.validateGeneratedRuntimeProfileCatalog(
      {
        ...profileCatalog,
        profiles: profileCatalog.profiles.filter((profile) => profile.runtime !== "browser"),
      },
      { claimedRuntimes: ["browser"] },
    );

    expect(report.passed).toBe(false);
    expect(
      report.results.some(
        (result) =>
          result.severity === "error" &&
          result.message ===
            "Catalog runtime claim 'browser' has no generated runtime profile evidence",
      ),
    ).toBe(true);
  });

  it("fails when a catalog runtime claim is unsupported", () => {
    const report = validator.validateGeneratedRuntimeProfileCatalog(profileCatalog, {
      claimedRuntimes: ["deno"],
    });

    expect(report.passed).toBe(false);
    expect(
      report.results.some(
        (result) =>
          result.severity === "error" &&
          result.message === "Catalog runtime claim 'deno' is not a supported presentation runtime",
      ),
    ).toBe(true);
  });

  it("fails without throwing when catalog profiles contain non-object values", () => {
    const report = validator.validateGeneratedRuntimeProfileCatalog({
      ...profileCatalog,
      profiles: [null, ...profileCatalog.profiles] as unknown as readonly GeneratedRuntimeProfile[],
    });

    expect(report.passed).toBe(false);
    expect(
      report.results.some(
        (result) =>
          result.severity === "error" &&
          result.message === "Generated runtime profile must be an object",
      ),
    ).toBe(true);
  });

  it("fails when runtime target metadata does not match the profile runtime", () => {
    const [profile] = profileCatalog.profiles;
    const report = validator.validateGeneratedRuntimeProfile({
      ...profile,
      target: {
        ...profile.target,
        target: "lambda",
      },
    });

    expect(report.passed).toBe(false);
    expect(
      report.results.some(
        (result) =>
          result.severity === "error" && result.message.includes("does not match runtime"),
      ),
    ).toBe(true);
  });

  it("accepts optional Astryx UI profile evidence without requiring StyleX compilation", () => {
    const [profile] = profileCatalog.profiles;

    const report = validator.validateGeneratedRuntimeProfile({
      ...profile,
      ui: {
        name: "astryx",
        styleEngine: "stylex",
        requiresStylexCompile: false,
        maturity: "beta",
        generatedAppSmokeCase: profile.generatedAppSmokeCase,
      },
    });

    expect(report.passed).toBe(true);
  });

  it("preserves generated runtime profiles that omit UI metadata", () => {
    const [profile] = profileCatalog.profiles;
    const report = validator.validateGeneratedRuntimeProfile(profile);

    expect(profile.ui).toBeUndefined();
    expect(report.passed).toBe(true);
  });

  it("fails when UI metadata does not match its profile and smoke evidence", () => {
    const [profile] = profileCatalog.profiles;

    const report = validator.validateGeneratedRuntimeProfile({
      ...profile,
      ui: {
        name: "astryx",
        styleEngine: "none",
        requiresStylexCompile: true,
        maturity: "stable",
        generatedAppSmokeCase: "different-smoke-case",
      },
    } as unknown as GeneratedRuntimeProfile);

    expect(report.passed).toBe(false);
    expect(report.results.map((result) => result.message)).toEqual(
      expect.arrayContaining([
        `Generated runtime profile '${profile.name}' UI profile 'astryx' must declare the StyleX engine`,
        `Generated runtime profile '${profile.name}' cannot require StyleX compilation without a style engine`,
        `Generated runtime profile '${profile.name}' has unsupported UI maturity 'stable'`,
        `Generated runtime profile '${profile.name}' UI smoke case must match '${profile.generatedAppSmokeCase}'`,
      ]),
    );
  });

  it("fails without throwing when UI metadata is not an object", () => {
    const [profile] = profileCatalog.profiles;
    const report = validator.validateGeneratedRuntimeProfile({
      ...profile,
      ui: "astryx",
    } as unknown as GeneratedRuntimeProfile);

    expect(report.passed).toBe(false);
    expect(report.results).toContainEqual({
      path: `profile:${profile.name}:ui`,
      severity: "error",
      message: `Generated runtime profile '${profile.name}' UI metadata must be an object`,
    });
  });

  it("fails when runtime target env metadata is not a string array", () => {
    const [profile] = profileCatalog.profiles;
    const report = validator.validateGeneratedRuntimeProfile({
      ...profile,
      target: {
        ...profile.target,
        requiredEnvVars: "TOKEN" as unknown as readonly string[],
      },
    });

    expect(report.passed).toBe(false);
    expect(
      report.results.some(
        (result) =>
          result.severity === "error" &&
          result.message === "Deploy target requiredEnvVars must contain non-empty strings",
      ),
    ).toBe(true);
  });

  it("fails when runtime target constraints use invalid value types", () => {
    const [profile] = profileCatalog.profiles;
    const report = validator.validateGeneratedRuntimeProfile({
      ...profile,
      target: {
        ...profile.target,
        runtime: {
          nodeVersion: 20,
          memory: "512",
          timeout: 0,
        } as unknown as typeof profile.target.runtime,
      },
    });

    expect(report.passed).toBe(false);
    expect(
      report.results.some(
        (result) =>
          result.severity === "error" &&
          result.message === "Deploy target runtime.nodeVersion must be non-empty when provided",
      ),
    ).toBe(true);
    expect(
      report.results.some(
        (result) =>
          result.severity === "error" &&
          result.message === "Deploy target runtime.memory must be greater than 0 when provided",
      ),
    ).toBe(true);
    expect(
      report.results.some(
        (result) =>
          result.severity === "error" &&
          result.message === "Deploy target runtime.timeout must be greater than 0 when provided",
      ),
    ).toBe(true);
  });

  it("fails without throwing when generated profile artifacts or entries contain non-object values", () => {
    const [profile] = profileCatalog.profiles;
    const report = validator.validateGeneratedRuntimeProfile({
      ...profile,
      target: {
        ...profile.target,
        output: {
          ...profile.target.output,
          artifacts: [null, ...profile.target.output.artifacts],
          entries: [null, ...profile.target.output.entries],
        },
      },
    } as unknown as GeneratedRuntimeProfile);

    expect(report.passed).toBe(false);
    expect(
      report.results.some(
        (result) => result.severity === "error" && result.message === "Artifact must be an object",
      ),
    ).toBe(true);
    expect(
      report.results.some(
        (result) => result.severity === "error" && result.message === "Entry must be an object",
      ),
    ).toBe(true);
  });

  it("fails when a generated profile artifact format is unsupported", () => {
    const [profile] = profileCatalog.profiles;
    const [artifact, ...artifacts] = profile.target.output.artifacts;
    const report = validator.validateGeneratedRuntimeProfile({
      ...profile,
      target: {
        ...profile.target,
        output: {
          ...profile.target.output,
          artifacts: [
            {
              ...artifact,
              format: "iife" as typeof artifact.format,
            },
            ...artifacts,
          ],
        },
      },
    });

    expect(report.passed).toBe(false);
    expect(
      report.results.some(
        (result) =>
          result.severity === "error" && result.message.includes("has unsupported format"),
      ),
    ).toBe(true);
  });

  it("fails when a generated profile entry references a missing artifact", () => {
    const [profile] = profileCatalog.profiles;
    const [entry, ...entries] = profile.target.output.entries;
    const report = validator.validateGeneratedRuntimeProfile({
      ...profile,
      target: {
        ...profile.target,
        output: {
          ...profile.target.output,
          entries: [
            {
              ...entry,
              main: "missing-entry.js",
            },
            ...entries,
          ],
        },
      },
    });

    expect(report.passed).toBe(false);
    expect(
      report.results.some(
        (result) =>
          result.severity === "error" && result.message.includes("but no matching artifact exists"),
      ),
    ).toBe(true);
  });
});

function readRuntimeProfileCatalog(): GeneratedRuntimeProfileCatalog {
  return JSON.parse(
    readFileSync(new URL("../../runtime-profiles.json", import.meta.url), "utf-8"),
  ) as GeneratedRuntimeProfileCatalog;
}

function readPresentationPresetRuntimeClaims(): readonly string[] {
  const catalog = JSON.parse(
    readFileSync(new URL("../../../../docs/package-catalog.json", import.meta.url), "utf-8"),
  ) as {
    readonly extensionMatrix?: {
      readonly packages?: {
        readonly "presentation-preset"?: {
          readonly runtimes?: readonly string[];
        };
      };
    };
  };

  return catalog.extensionMatrix?.packages?.["presentation-preset"]?.runtimes ?? [];
}
