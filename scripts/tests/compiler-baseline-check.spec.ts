import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import {
  collectCompilerBaselineDiagnostics,
  collectWorkspaceCompilerDiagnostics,
  collectWorkspaceTypecheckDiagnostics,
  GENERATED_TYPESCRIPT_RANGE,
  TYPECHECK_BASELINE,
  TYPESCRIPT_BASELINE,
} from "../compiler-baseline-check.mts";

const repositoryRoot = resolve(__dirname, "../..");

describe("compiler baseline check", () => {
  it("uses pinned tsrs checks while retaining the TypeScript 6 Compiler API and consumers", () => {
    expect(TYPECHECK_BASELINE).toBe("0.18.0-ts7.1.0-dev.20260929");
    expect(TYPESCRIPT_BASELINE).toBe("6.0.3");
    expect(GENERATED_TYPESCRIPT_RANGE).toBe("^6.0.3");
    expect(collectCompilerBaselineDiagnostics(repositoryRoot)).toEqual([]);
  });

  it.each(["tsrs --noEmit", "tsx scripts/build.ts && tsrs --noEmit"])(
    "accepts a native typecheck after any build preparation: %s",
    (command) => {
      expect(
        collectWorkspaceTypecheckDiagnostics(
          { scripts: { typecheck: command } },
          "example/package.json",
        ),
      ).toEqual([]);
    },
  );

  it.each(["tsc --noEmit", "tsrs", "tsrs --noEmit false", "tsrs --noEmit || tsc --noEmit"])(
    "rejects compiler fallback or emission in workspace typechecks: %s",
    (command) => {
      expect(
        collectWorkspaceTypecheckDiagnostics(
          { scripts: { typecheck: command } },
          "example/package.json",
        ),
      ).toEqual([
        expect.stringContaining(
          "example/package.json scripts.typecheck: must end with tsrs --noEmit",
        ),
      ]);
    },
  );

  it.each([undefined, "^0.18.0", "0.17.0-ts7.1.0-dev.20260929"])(
    "rejects an absent, floating, or mismatched tsrs pin: %s",
    (version) => {
      const rootPackage = JSON.parse(readFileSync(resolve(repositoryRoot, "package.json"), "utf8"));
      const workspace = parseYaml(
        readFileSync(resolve(repositoryRoot, "pnpm-workspace.yaml"), "utf8"),
      );
      rootPackage.devDependencies.tsrs = version;
      expect(collectWorkspaceCompilerDiagnostics(rootPackage, workspace)).toEqual([
        expect.stringContaining("package.json devDependencies.tsrs: expected"),
      ]);
    },
  );

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
