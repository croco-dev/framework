import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../release-metadata-check.mts");
const tempRoots: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("release-metadata-check.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("passes publishable packages with non-placeholder versions and changelogs", () => {
    const root = createTempRoot();
    writePackage(root, "valid", {
      name: "@croco/valid",
      version: "0.1.0",
    });
    writePackage(
      root,
      "private-tooling",
      {
        name: "@croco/private-tooling",
        private: true,
        version: "0.0.0",
      },
      { changelog: false },
    );

    const result = runScript(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Checked publishable: 1");
    expect(result.stdout).toContain("Skipped private/non-published tooling: 1");
    expect(result.stdout).toContain("Release metadata is publish-ready");
  });

  it("reports placeholder versions and missing changelogs with changesets recovery guidance", () => {
    const root = createTempRoot();
    writePackage(
      root,
      "placeholder",
      {
        name: "@croco/placeholder",
        version: "0.0.0",
      },
      { changelog: false },
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("packages/placeholder/package.json");
    expect(result.stdout).toContain(
      '@croco/placeholder): version is "0.0.0"; CHANGELOG.md is missing',
    );
    expect(result.stdout).toContain("Add or update a .changeset/*.md entry");
    expect(result.stdout).toContain("let `pnpm version-packages` / the Changesets release PR");
    expect(result.stdout).toContain("Do not manually edit package versions");
  });

  it("reports missing changelogs separately from valid versions", () => {
    const root = createTempRoot();
    writePackage(
      root,
      "missing-changelog",
      {
        name: "@croco/missing-changelog",
        version: "0.2.0",
      },
      { changelog: false },
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("packages/missing-changelog/package.json");
    expect(result.stdout).toContain("CHANGELOG.md is missing");
    expect(result.stdout).not.toContain('version is "0.0.0"');
  });

  it("rejects invalid publishable package metadata", () => {
    const root = createTempRoot();
    writePackage(root, "invalid-name", {
      version: "0.1.0",
    });
    writePackage(root, "invalid-version", {
      name: "@croco/invalid-version",
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("packages/invalid-name/package.json");
    expect(result.stdout).toContain("name must be a non-empty string");
    expect(result.stdout).toContain("packages/invalid-version/package.json");
    expect(result.stdout).toContain("version must be a non-empty string");
  });

  it("allows placeholder metadata only when pending changesets are explicitly accepted", () => {
    const root = createTempRoot();
    writePackage(
      root,
      "scheduled",
      {
        name: "@croco/scheduled",
        version: "0.0.0",
      },
      { changelog: false },
    );
    writeChangeset(root, "scheduled.md", '"@croco/scheduled": minor');

    const strictResult = runScript(root);
    const allowedResult = runScript(root, "--allow-pending-changesets");

    expect(strictResult.status).toBe(1);
    expect(allowedResult.status).toBe(0);
    expect(allowedResult.stdout).toContain("Pending changeset metadata recoveries:");
    expect(allowedResult.stdout).toContain(
      "Final publish candidates must pass without --allow-pending-changesets",
    );
  });

  it("does not allow pending changesets to hide invalid manifest fields", () => {
    const root = createTempRoot();
    writePackage(
      root,
      "invalid-scheduled",
      {
        name: "@croco/invalid-scheduled",
      },
      { changelog: false },
    );
    writeChangeset(root, "invalid-scheduled.md", '"@croco/invalid-scheduled": patch');

    const result = runScript(root, "--allow-pending-changesets");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("version must be a non-empty string");
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "croco-release-metadata-"));
  tempRoots.push(root);
  mkdirSync(join(root, "packages"), { recursive: true });
  return root;
}

function writePackage(
  root: string,
  directoryName: string,
  manifest: Record<string, unknown>,
  options: { readonly changelog?: boolean } = {},
): void {
  const packageDir = join(root, "packages", directoryName);
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(join(packageDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  if (options.changelog !== false) {
    writeFileSync(join(packageDir, "CHANGELOG.md"), `# ${manifest.name ?? directoryName}\n`);
  }
}

function writeChangeset(root: string, filename: string, frontmatterLine: string): void {
  const changesetsDir = join(root, ".changeset");
  mkdirSync(changesetsDir, { recursive: true });
  writeFileSync(join(changesetsDir, filename), `---\n${frontmatterLine}\n---\n\nRelease note.\n`);
}

function runScript(root: string, ...args: string[]): ScriptResult {
  const result = spawnSync(
    "node",
    ["--experimental-strip-types", scriptPath, "--root", root, ...args],
    {
      encoding: "utf-8",
      timeout: 10_000,
    },
  );

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
