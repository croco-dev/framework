import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../release-version-sync.mts");
const repositoryRoot = resolve(__dirname, "../..");
const oxfmtPath = join(repositoryRoot, "node_modules", ".bin", "oxfmt");
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

  it("leaves the repository package catalog untouched when no release version drifted", () => {
    const root = copyRepositoryReleaseMetadata();
    const catalogPath = join(root, "docs", "package-catalog.json");
    const catalogBefore = readFileSync(catalogPath, "utf-8");

    expect(runScript(root, "--check").status).toBe(0);
    expect(runOxfmtCheck(root)).toBe(0);

    expect(runScript(root, "--write").status).toBe(0);

    expect({
      unchangedWithoutDrift: readFileSync(catalogPath, "utf-8") === catalogBefore,
      formatStatus: runOxfmtCheck(root),
    }).toEqual({ unchangedWithoutDrift: true, formatStatus: 0 });
  }, 30_000);

  it("keeps the repository package catalog formatter-clean when a certified package version changes", () => {
    const root = copyRepositoryReleaseMetadata();
    const catalogPath = join(root, "docs", "package-catalog.json");
    const manifestPath = join(root, "packages", "auth-clerk", "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as { version: string };
    const catalogBefore = JSON.parse(readFileSync(catalogPath, "utf-8")) as {
      certification: { records: { package: string; packageVersion: string }[] };
    };
    const updatedVersion = "99.99.99";
    const certifiedRecords = catalogBefore.certification.records.filter(
      (record) => record.package === "@croco/auth-clerk",
    );

    expect(manifest.version).not.toBe(updatedVersion);
    expect(certifiedRecords).toHaveLength(1);
    expect(certifiedRecords[0]?.packageVersion).toBe(manifest.version);
    const expectedCatalog = {
      ...catalogBefore,
      certification: {
        ...catalogBefore.certification,
        records: catalogBefore.certification.records.map((record) =>
          record.package === "@croco/auth-clerk"
            ? { ...record, packageVersion: updatedVersion }
            : record,
        ),
      },
    };
    writeFile(
      manifestPath,
      `${JSON.stringify({ ...manifest, version: updatedVersion }, null, 2)}\n`,
    );

    expect(runScript(root, "--write").status).toBe(0);

    expect(JSON.parse(readFileSync(catalogPath, "utf-8"))).toEqual(expectedCatalog);
    expect(runOxfmtCheck(root)).toBe(0);
  }, 30_000);

  it("does not write release metadata when catalog formatting fails", () => {
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
    writeFile(join(root, ".oxfmtrc.json"), "{");

    const result = runScript(root, "--write");

    expect(result.status).toBe(1);
    expect(readFileSync(rangesPath, "utf-8")).toBe(rangesBefore);
    expect(readFileSync(catalogPath, "utf-8")).toBe(catalogBefore);
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

  it("rejects an option token used as the --root value", () => {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", scriptPath, "--root", "--write"],
      {
        encoding: "utf-8",
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "[MISSING_RELEASE_VERSION_SYNC_ROOT/input] --root requires a path",
    );
  });

  it("leaves Croco range-shaped entries outside the managed declaration unchanged", () => {
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
      `${readFileSync(rangesPath, "utf-8")}\nconst UNMANAGED_RANGES = {\n  "@croco/alpha": "^9.9.9",\n};\n`,
      "utf-8",
    );

    const result = runScript(root, "--write");
    const ranges = readFileSync(rangesPath, "utf-8");

    expect(result.status).toBe(0);
    expect(ranges).toContain('"@croco/alpha": "^0.0.2"');
    expect(ranges).toContain('"@croco/alpha": "^9.9.9"');
  });

  it("does not count Croco range-shaped entries outside an empty managed declaration", () => {
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
      [
        "const EXTERNAL_CROCO_PACKAGE_RANGES = {",
        "} as const;",
        "",
        "const UNMANAGED_RANGES = {",
        '  "@croco/alpha": "^9.9.9",',
        "};",
        "",
      ].join("\n"),
      "utf-8",
    );

    const result = runScript(root, "--check");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("[CROCO_RANGE_DECLARATIONS_MISSING/contract]");
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

function copyRepositoryReleaseMetadata(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-release-version-sync-repo-"));
  tempRoots.push(root);

  for (const name of readdirSync(join(repositoryRoot, "packages"))) {
    const manifestPath = join(repositoryRoot, "packages", name, "package.json");
    if (existsSync(manifestPath)) {
      writeFile(join(root, "packages", name, "package.json"), readFileSync(manifestPath, "utf-8"));
    }
  }

  for (const path of [
    "packages/create-croco-app/src/helpers/croco-ranges.ts",
    "docs/package-catalog.json",
    ".oxfmtrc.json",
  ]) {
    writeFile(join(root, path), readFileSync(join(repositoryRoot, path), "utf-8"));
  }

  return root;
}

function runOxfmtCheck(root: string): number | null {
  return spawnSync(oxfmtPath, ["--check", "docs/package-catalog.json"], {
    cwd: root,
    encoding: "utf-8",
  }).status;
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
