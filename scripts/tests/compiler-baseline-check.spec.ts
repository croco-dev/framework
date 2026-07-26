import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import {
  collectCompilerBaselineDiagnostics,
  collectWorkspaceCompilerDiagnostics,
  GENERATED_TYPESCRIPT_RANGE,
  TYPESCRIPT_BASELINE,
} from "../compiler-baseline-check.mts";

const repositoryRoot = resolve(__dirname, "../..");

describe("compiler baseline check", () => {
  it("keeps the repository and generated consumers on the TypeScript 6 baseline", () => {
    expect(TYPESCRIPT_BASELINE).toBe("6.0.3");
    expect(GENERATED_TYPESCRIPT_RANGE).toBe("^6.0.3");
    expect(collectCompilerBaselineDiagnostics(repositoryRoot)).toEqual([]);
  });

  it("rejects removal of the root tsup compatibility patch registration", () => {
    const rootPackage = JSON.parse(
      readFileSync(resolve(repositoryRoot, "package.json"), "utf8"),
    ) as Readonly<Record<string, unknown>>;
    const workspace = parseYaml(
      readFileSync(resolve(repositoryRoot, "pnpm-workspace.yaml"), "utf8"),
    ) as Readonly<Record<string, unknown>>;

    expect(
      collectWorkspaceCompilerDiagnostics(rootPackage, {
        ...workspace,
        patchedDependencies: {},
      }),
    ).toContain(
      'pnpm-workspace.yaml patchedDependencies.tsup@8.5.1: expected "patches/tsup@8.5.1.patch", received undefined',
    );
  });
});
