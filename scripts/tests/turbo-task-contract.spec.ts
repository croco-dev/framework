import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type TurboTask = {
  readonly dependsOn?: readonly string[];
  readonly inputs?: readonly string[];
  readonly outputs?: readonly string[];
};

type TurboConfiguration = {
  readonly globalPassThroughEnv?: readonly string[];
  readonly tasks: Readonly<Record<string, TurboTask>>;
};

const repositoryRoot = resolve(__dirname, "../..");
const turbo = JSON.parse(
  readFileSync(resolve(repositoryRoot, "turbo.json"), "utf-8"),
) as TurboConfiguration;

describe("Turbo task contract", () => {
  it("forwards the explicit executable-evidence destination to test reporters", () => {
    expect(turbo.globalPassThroughEnv).toContain("CROCO_TEST_EVIDENCE_DIR");
  });

  it("runs lint without package-topology dependencies and hashes shared lint sources", () => {
    expect(turbo.tasks.lint?.dependsOn).toBeUndefined();
    expect(turbo.tasks.lint?.inputs).toEqual([
      "$TURBO_DEFAULT$",
      "$TURBO_ROOT$/.oxlintrc.json",
      "$TURBO_ROOT$/packages/oxlint-rules/src/**",
    ]);
  });

  it("keeps build and typecheck ordered by package topology", () => {
    expect(turbo.tasks.build?.dependsOn).toEqual(["^build"]);
    expect(turbo.tasks.typecheck?.dependsOn).toEqual(["build", "^build", "^typecheck"]);
  });

  it("keeps package task overrides independent from the removed lint edge", () => {
    expect(turbo.tasks["@croco/docs#test"]?.dependsOn).toEqual(["^build"]);
    expect(turbo.tasks["@croco/docs#test"]?.outputs).toEqual([".turbo/croco-test-evidence.json"]);
    expect(turbo.tasks["@croco/docs#typecheck"]?.dependsOn).toEqual(["^build", "^typecheck"]);
    expect(turbo.tasks["@croco/oxlint-rules#test"]?.dependsOn).toBeUndefined();
    expect(turbo.tasks["@croco/oxlint-rules#test"]?.outputs).toEqual([
      ".turbo/croco-test-evidence.json",
    ]);
  });
});
