import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../release-version-sync.mts");
const rootPackageJsonPath = resolve(__dirname, "../../package.json");
const versionPackagesScriptPath = resolve(__dirname, "../version-packages.mts");
const tempRoots: string[] = [];

type ScriptResult = {
  readonly status: number | null;
  readonly stdout: string;
};

describe("release-version-sync.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("reports version-derived release metadata drift without mutating files", () => {
    const root = createFixture();
    const rangesPath = join(
      root,
      "packages",
      "create-croco-app",
      "src",
      "helpers",
      "croco-ranges.ts",
    );
    const catalogPath = join(root, "docs", "package-catalog.json");
    const rangesBefore = readFileSync(rangesPath, "utf-8");
    const catalogBefore = readFileSync(catalogPath, "utf-8");

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "@croco/alpha range ^0.0.1 must match workspace version ^0.0.2",
    );
    expect(result.stdout).toContain(
      "certification record for @croco/alpha version 0.0.1 must match 0.0.2",
    );
    expect(readFileSync(rangesPath, "utf-8")).toBe(rangesBefore);
    expect(readFileSync(catalogPath, "utf-8")).toBe(catalogBefore);
  });

  it("synchronizes Croco ranges and certification versions deterministically", () => {
    const root = createFixture();

    const writeResult = runScript(root, "--write");
    const checkResult = runScript(root, "--check");
    const ranges = readFileSync(
      join(root, "packages", "create-croco-app", "src", "helpers", "croco-ranges.ts"),
      "utf-8",
    );
    const catalog = JSON.parse(
      readFileSync(join(root, "docs", "package-catalog.json"), "utf-8"),
    ) as {
      readonly certification: {
        readonly records: readonly {
          readonly contract: string;
          readonly package: string;
          readonly packageVersion: string;
        }[];
      };
    };

    expect(writeResult.status).toBe(0);
    expect(writeResult.stdout).toContain("synchronized 2 version-derived metadata files");
    expect(checkResult.status).toBe(0);
    expect(ranges).toContain('"@croco/alpha": "^0.0.2"');
    expect(ranges).toContain('"@croco/beta": "^1.2.3"');
    expect(catalog.certification.records).toEqual([
      {
        package: "@croco/alpha",
        packageVersion: "0.0.2",
        contract: "alpha-contract",
      },
    ]);
  });

  it("rejects release metadata that references a missing workspace package", () => {
    const root = createFixture();
    const rangesPath = join(
      root,
      "packages",
      "create-croco-app",
      "src",
      "helpers",
      "croco-ranges.ts",
    );
    writeFileSync(
      rangesPath,
      readFileSync(rangesPath, "utf-8").replace("@croco/alpha", "@croco/missing"),
      "utf-8",
    );

    const result = runScript(root, "--write");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("[CROCO_RANGE_PACKAGE_MISSING/contract]");
    expect(result.stdout).toContain(
      "croco-ranges.ts references missing workspace package @croco/missing",
    );
  });

  it("rejects Croco package references that do not match the range declaration format", () => {
    const root = createFixture();
    const rangesPath = join(
      root,
      "packages",
      "create-croco-app",
      "src",
      "helpers",
      "croco-ranges.ts",
    );
    writeFileSync(
      rangesPath,
      readFileSync(rangesPath, "utf-8").replace(
        '  "@croco/alpha": "^0.0.1",',
        '  "@croco/alpha": "^0.0.1", // unmanaged',
      ),
      "utf-8",
    );

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("[UNMATCHED_CROCO_RANGE_ENTRY/contract]");
    expect(result.stdout).toContain("required range declaration format on lines 2");
  });

  it("reports invalid CLI arguments as structured verification problems", () => {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", scriptPath, "--unknown"],
      {
        encoding: "utf-8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "[UNKNOWN_RELEASE_VERSION_SYNC_OPTION/input] Unknown option: --unknown",
    );
  });

  it("keeps the Changesets action entrypoint wired to ordered release synchronization", () => {
    const packageJson = JSON.parse(readFileSync(rootPackageJsonPath, "utf-8")) as {
      readonly scripts?: Readonly<Record<string, string>>;
    };
    const source = readFileSync(versionPackagesScriptPath, "utf-8");
    const changesetIndex = source.indexOf('"changeset", "version"');
    const manifestsIndex = source.indexOf('"package-manifests:write"');
    const metadataIndex = source.indexOf('"release-version-sync:write"');
    const docsIndex = source.indexOf('"docs:catalog:write"');

    expect(packageJson.scripts?.["version-packages"]).toBe(
      "node --experimental-strip-types scripts/version-packages.mts",
    );
    expect(packageJson.scripts?.["release-version-sync:check"]).toBe(
      "node --experimental-strip-types scripts/verification-command.mts --id release-version-sync",
    );
    expect(changesetIndex).toBeGreaterThan(-1);
    expect(manifestsIndex).toBeGreaterThan(changesetIndex);
    expect(metadataIndex).toBeGreaterThan(manifestsIndex);
    expect(docsIndex).toBeGreaterThan(metadataIndex);
  });
});

function createFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-release-version-sync-"));
  tempRoots.push(root);

  writeJson(join(root, "packages", "alpha", "package.json"), {
    name: "@croco/alpha",
    version: "0.0.2",
  });
  writeJson(join(root, "packages", "beta", "package.json"), {
    name: "@croco/beta",
    version: "1.2.3",
  });
  writeFile(
    join(root, "packages", "create-croco-app", "src", "helpers", "croco-ranges.ts"),
    [
      "const EXTERNAL_CROCO_PACKAGE_RANGES = {",
      '  "@croco/alpha": "^0.0.1",',
      '  "@croco/beta": "^1.2.3",',
      "} as const;",
      "",
    ].join("\n"),
  );
  writeJson(join(root, "docs", "package-catalog.json"), {
    schemaVersion: 1,
    certification: {
      records: [
        {
          package: "@croco/alpha",
          packageVersion: "0.0.1",
          contract: "alpha-contract",
        },
      ],
    },
  });

  return root;
}

function runScript(root: string, mode: "--check" | "--write"): ScriptResult {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", scriptPath, mode, "--root", root],
    {
      encoding: "utf-8",
    },
  );

  return {
    status: result.status,
    stdout: result.stdout,
  };
}

function writeJson(path: string, value: unknown): void {
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFile(path: string, content: string): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, content, "utf-8");
}
