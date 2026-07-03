import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const scriptPath = resolve(__dirname, "../architecture-policy-check.mts");
const scriptTestTimeout = 30_000;
const tempRoots: string[] = [];

vi.setConfig({ testTimeout: scriptTestTimeout });

type ScriptResult = {
  readonly output: string;
  readonly status: number | null;
};

type ArchitecturePackageGroup = {
  readonly packages?: readonly string[];
  readonly paths?: readonly string[];
};

type PackageCatalogGroupOverride = {
  readonly package: string;
  readonly catalogGroup: string;
  readonly policyGroup: string;
  readonly reason: string;
};

describe("architecture-policy-check.mts", () => {
  afterAll(() => {
    vi.resetConfig();
  });

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("passes when public package catalog groups match architecture policy groups", () => {
    const root = createTempRoot();
    writePackage(root, "alpha");
    writePackage(root, "provider");
    writePackageCatalog(root, {
      Core: ["alpha"],
      Provider: ["provider"],
    });
    writeArchitectureManifest(root, {
      framework: { packages: ["@croco/alpha"] },
      integrations: { packages: ["@croco/provider"] },
    });

    const result = runScript(root);

    expect(result.status).toBe(0);
    expect(result.output).toContain(
      "architecture-policy: package catalog group consistency passed",
    );
  });

  it("fails when a public package is missing architecture policy classification", () => {
    const root = createTempRoot();
    writePackage(root, "alpha");
    writePackageCatalog(root, {
      Core: ["alpha"],
    });
    writeArchitectureManifest(root, {
      framework: { packages: [] },
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      "public package @croco/alpha is not classified by croco.arch.json packageGroups",
    );
  });

  it("fails when a public package is missing package catalog group metadata", () => {
    const root = createTempRoot();
    writePackage(root, "alpha");
    writePackageCatalog(root, {
      Core: [],
    });
    writeArchitectureManifest(root, {
      framework: { packages: ["@croco/alpha"] },
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      "public package alpha is missing package catalog group metadata",
    );
  });

  it("fails when one public package appears in multiple catalog groups", () => {
    const root = createTempRoot();
    writePackage(root, "alpha");
    writePackageCatalog(root, {
      Core: ["alpha"],
      Domain: ["alpha"],
    });
    writeArchitectureManifest(root, {
      framework: { packages: ["@croco/alpha"] },
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain("package alpha appears in multiple package catalog groups");
  });

  it("fails when one public package matches multiple architecture policy groups", () => {
    const root = createTempRoot();
    writePackage(root, "alpha");
    writePackageCatalog(root, {
      Core: ["alpha"],
    });
    writeArchitectureManifest(root, {
      app: { packages: ["@croco/alpha"] },
      framework: { packages: ["@croco/alpha"] },
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      "public package @croco/alpha matches multiple croco.arch.json packageGroups",
    );
  });

  it("fails when catalog and architecture groups differ without an override", () => {
    const root = createTempRoot();
    writePackage(root, "alpha");
    writePackageCatalog(root, {
      Tooling: ["alpha"],
    });
    writeArchitectureManifest(root, {
      framework: { packages: ["@croco/alpha"] },
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      "package @croco/alpha catalog group Tooling maps to policy group app but croco.arch.json assigns framework",
    );
  });

  it("allows explicit package-level overrides for intentional catalog and policy group differences", () => {
    const root = createTempRoot();
    writePackage(root, "events-tx");
    writePackageCatalog(root, {
      Core: ["events-tx"],
    });
    writeArchitectureManifest(
      root,
      {
        integrations: { packages: ["@croco/events-tx"] },
      },
      [
        {
          package: "@croco/events-tx",
          catalogGroup: "Core",
          policyGroup: "integrations",
          reason: "The transaction-backed event package is an adapter boundary.",
        },
      ],
    );

    const result = runScript(root);

    expect(result.status).toBe(0);
  });

  it("fails stale overrides that no longer match the actual catalog and policy groups", () => {
    const root = createTempRoot();
    writePackage(root, "events-tx");
    writePackageCatalog(root, {
      Core: ["events-tx"],
    });
    writeArchitectureManifest(
      root,
      {
        framework: { packages: ["@croco/events-tx"] },
      },
      [
        {
          package: "@croco/events-tx",
          catalogGroup: "Core",
          policyGroup: "integrations",
          reason: "The transaction-backed event package is an adapter boundary.",
        },
      ],
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      "packageCatalogGroupOverrides entry for @croco/events-tx expects catalog=Core policy=integrations but actual catalog=Core policy=framework",
    );
  });
});

function runScript(root: string): ScriptResult {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      scriptPath,
      "--manifest",
      join(root, "croco.arch.json"),
      "--root",
      root,
    ],
    {
      encoding: "utf-8",
    },
  );

  return {
    output: `${result.stdout}${result.stderr}`,
    status: result.status,
  };
}

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-architecture-policy-check-"));
  tempRoots.push(root);
  mkdirSync(join(root, "docs"), { recursive: true });
  mkdirSync(join(root, "packages"), { recursive: true });
  return root;
}

function writePackage(root: string, shortName: string): void {
  const packageDir = join(root, "packages", shortName);
  mkdirSync(packageDir, { recursive: true });
  writeJson(join(packageDir, "package.json"), {
    name: `@croco/${shortName}`,
    version: "0.0.0",
    type: "module",
  });
}

function writePackageCatalog(
  root: string,
  groups: Readonly<Record<string, readonly string[]>>,
): void {
  writeJson(join(root, "docs", "package-catalog.json"), {
    schemaVersion: 1,
    groups: Object.fromEntries(
      Object.entries(groups).map(([groupName, packages]) => [
        groupName,
        {
          description: `${groupName} packages`,
          packages,
        },
      ]),
    ),
  });
}

function writeArchitectureManifest(
  root: string,
  packageGroups: Readonly<Record<string, ArchitecturePackageGroup>>,
  overrides: readonly PackageCatalogGroupOverride[] = [],
): void {
  writeJson(join(root, "croco.arch.json"), {
    schemaVersion: "croco.architecture-policy/v1",
    packageRoots: ["packages"],
    include: ["packages/*/src/**/*.ts"],
    ignore: [],
    packageGroups,
    ...(overrides.length > 0 ? { packageCatalogGroupOverrides: overrides } : {}),
    rules: {},
  });
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
