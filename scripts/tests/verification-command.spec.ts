import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { runVerificationCommand } from "../verification-command.mts";
import { createVerificationManifest, getVerificationCommand } from "../verification-manifest.mts";
import { findPackageScriptVerificationDuplications } from "../workflow-verification-contract.mts";

const packageJson = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf8")) as {
  readonly scripts: Readonly<Record<string, string>>;
};

describe("verification command dispatcher", () => {
  it("dispatches the authoritative argv and preserves forwarded arguments", () => {
    let invocation: { executable: string; args: readonly string[] } | undefined;
    const status = runVerificationCommand(
      "public-api",
      ["--", "--root", "/tmp/repo"],
      (executable, args) => {
        invocation = { executable, args };
        return 0;
      },
    );

    const [executable, ...args] = getVerificationCommand("public-api").command;
    expect(status).toBe(0);
    expect(invocation).toEqual({ executable, args: [...args, "--root", "/tmp/repo"] });
  });

  it("scopes coverage environment to the stable core-coverage ID", () => {
    let publicApiEnvironment: NodeJS.ProcessEnv | undefined;
    runVerificationCommand("public-api", ["--coverage"], (_executable, _args, environment) => {
      publicApiEnvironment = environment;
      return 0;
    });
    expect(publicApiEnvironment).toBe(process.env);

    let coverageEnvironment: NodeJS.ProcessEnv | undefined;
    runVerificationCommand("core-coverage", [], (_executable, _args, environment) => {
      coverageEnvironment = environment;
      return 0;
    });
    expect(coverageEnvironment).not.toBe(process.env);
    expect(coverageEnvironment).toMatchObject({
      CORE_COVERAGE: "true",
      SKIP_ENV_VALIDATION: "true",
    });
  });

  it("keeps aggregate root entrypoints stable", () => {
    expect(packageJson.scripts.check).toBe("pnpm verify:repo");
    expect(packageJson.scripts["verify:repo"]).toBe(
      "node --experimental-strip-types scripts/release-spine-evidence.mts --profile repo",
    );
    expect(packageJson.scripts["verify:spine"]).toBe(
      "node --experimental-strip-types scripts/release-spine-evidence.mts --profile spine",
    );
    expect(packageJson.scripts["verify:publish"]).toBe(
      "node --experimental-strip-types scripts/release-spine-evidence.mts --profile publish",
    );
    expect(packageJson.scripts["release:spine-evidence"]).toBe("pnpm verify:spine");
  });

  it("routes manifest-owned developer aliases through stable command IDs", () => {
    const dispatcherAliases = Object.entries(packageJson.scripts).filter(([, command]) =>
      command.includes("scripts/verification-command.mts --id "),
    );
    expect(dispatcherAliases.length).toBeGreaterThan(10);
    for (const [alias, command] of dispatcherAliases) {
      const id = command.match(/--id ([^\s]+)/)?.[1];
      expect(id, `${alias} must name a stable command ID`).toBeTruthy();
      expect(() => getVerificationCommand(id ?? "")).not.toThrow();
    }
  });

  it("allows only behaviorally distinct developer aliases as intentional exceptions", () => {
    const exceptions = [
      "architecture:check:circular",
      "audit:prod",
      "build",
      "create-croco-app:smoke",
      "format",
      "lint",
      "package-quality:report",
      "production-ready:check",
      "test",
      "typecheck",
    ];
    const fingerprints = new Set(
      createVerificationManifest("publish").map(({ command }) => command.join(" ")),
    );
    for (const alias of exceptions) {
      expect(packageJson.scripts[alias], `${alias} must remain documented`).toBeTruthy();
      expect(fingerprints.has(packageJson.scripts[alias] ?? "")).toBe(false);
    }
    expect(findPackageScriptVerificationDuplications(packageJson.scripts)).toEqual([]);
  });

  it("rejects a root alias that copies a canonical executable array", () => {
    const mutant = {
      ...packageJson.scripts,
      "public-api:check": getVerificationCommand("public-api").command.join(" "),
    };
    expect(findPackageScriptVerificationDuplications(mutant)).toMatchObject([
      { reason: "root alias public-api:check duplicates a manifest executable array" },
    ]);
  });
});
