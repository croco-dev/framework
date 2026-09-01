import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type TurboTask = {
  readonly cache?: boolean;
  readonly dependsOn?: readonly string[];
  readonly env?: readonly string[];
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

  it("caches API documentation models at package boundaries", () => {
    expect(turbo.tasks["docs:api:model"]).toEqual({
      cache: true,
      dependsOn: ["^docs:api:model"],
      inputs: [
        "src/**",
        "!src/tests/**",
        "!src/**/*.spec.*",
        "package.json",
        "$TURBO_ROOT$/packages/docs/api-docs.config.mjs",
        "$TURBO_ROOT$/packages/docs/scripts/generate-package-api-model.mts",
        "$TURBO_ROOT$/packages/docs/scripts/typedoc-merge-normalizer.mjs",
      ],
      outputs: [".turbo/docs-api/model.json"],
    });
  });

  it("prepares package API models before the docs development server starts", () => {
    expect(turbo.tasks["@croco/docs#dev"]).toEqual({
      cache: false,
      dependsOn: ["^docs:api:model"],
      persistent: true,
    });
    expect(turbo.tasks["docs:dev"]?.dependsOn).toEqual(["^docs:api:model"]);
  });

  it("caches formatter-ready drift candidates independently from tracked API Markdown", () => {
    expect(turbo.tasks["docs:api:render"]).toEqual({
      cache: true,
      dependsOn: ["^docs:api:model"],
      env: ["NODE_ENV"],
      inputs: [
        "api-docs.config.mjs",
        "astro.config.mjs",
        "package.json",
        "src/content.config.ts",
        "scripts/build-docs.mts",
        "scripts/prepare-api-models.mjs",
        "scripts/sanitize-typedoc-index.mjs",
        "$TURBO_ROOT$/.oxfmtrc.json",
      ],
      outputs: [".turbo/docs-api/rendered/**"],
    });
  });

  it("renders docs from package models without hashing tracked generated API Markdown", () => {
    expect(turbo.tasks["@croco/docs#build"]).toMatchObject({
      dependsOn: ["^docs:api:model"],
      inputs: ["$TURBO_DEFAULT$", "!src/content/docs/api/**"],
      outputs: ["dist/**"],
    });
    expect(turbo.tasks["@croco/docs#docs:build"]).toEqual({
      cache: true,
      dependsOn: ["^docs:api:model"],
      env: ["NODE_ENV"],
      inputs: ["$TURBO_DEFAULT$", "!src/content/docs/api/**"],
      outputs: ["dist/**"],
    });
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
