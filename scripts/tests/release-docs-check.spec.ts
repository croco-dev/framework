import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../release-docs-check.mts");
const tempRoots: string[] = [];
const DEFAULT_SPINE_PACKAGES = ["framework-context", "cli", "create-croco-app"] as const;

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("release-docs-check.mts", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("passes when empty fixed and linked groups are documented as independent versioning", () => {
    const root = createFixture(
      {
        fixed: [],
        linked: [],
      },
      [
        "# Release",
        "`.changeset/config.json` is the source of truth.",
        "- **Mode**: Independent",
        "The fixed and linked arrays are empty.",
        "Select each changed publishable package를 각각 when creating a changeset.",
        "The release workflow exports NPM_CONFIG_PROVENANCE=true.",
        "Maintainers verify provenance with npm audit signatures.",
        "The npm Version field shows the provenance check mark.",
        "Run pnpm alpha-release:smoke before publish.",
        "Upload ci-reports/release/alpha-release-smoke.md as release evidence.",
        "Release notes state alpha stability and compatibility expectations.",
        "Breaking changes to `croco.doctor.v1` doctor JSON output must either version the report schema or include release notes with a migration path.",
        "RC release notes link docs/release/croco-1.0-spine.md#0x-to-10-migration-matrix.",
        "RC notes list renamed/deprecated/removed public APIs and recovery with croco doctor plus croco upgrade --dry-run.",
      ].join("\n"),
    );

    const result = runScript(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("agree on independent versioning");
  });

  it("fails when the guide claims fixed mode but config has no fixed group", () => {
    const root = createFixture(
      {
        fixed: [],
        linked: [],
      },
      [
        "# Release",
        "`.changeset/config.json` is the source of truth.",
        "- **Mode**: Fixed",
        "All packages use Fixed Mode.",
      ].join("\n"),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("must state `**Mode**: Independent`");
    expect(result.stdout).toContain("still describes fixed-mode versioning");
  });

  it("fails when the guide omits npm provenance verification", () => {
    const root = createFixture(
      {
        fixed: [],
        linked: [],
      },
      [
        "# Release",
        "`.changeset/config.json` is the source of truth.",
        "- **Mode**: Independent",
        "The fixed and linked arrays are empty.",
        "Select each changed publishable package를 각각 when creating a changeset.",
        "Run pnpm alpha-release:smoke before publish.",
        "Upload ci-reports/release/alpha-release-smoke.md as release evidence.",
        "Release notes state alpha stability and compatibility expectations.",
      ].join("\n"),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("npm provenance publish configuration");
    expect(result.stdout).toContain("npm provenance CLI verification command");
    expect(result.stdout).toContain("npmjs.com provenance UI verification");
  });

  it("fails when the guide omits alpha release smoke evidence", () => {
    const root = createFixture(
      {
        fixed: [],
        linked: [],
      },
      [
        "# Release",
        "`.changeset/config.json` is the source of truth.",
        "- **Mode**: Independent",
        "The fixed and linked arrays are empty.",
        "Select each changed publishable package를 각각 when creating a changeset.",
        "The release workflow exports NPM_CONFIG_PROVENANCE=true.",
        "Maintainers verify provenance with npm audit signatures.",
        "The npm Version field shows the provenance check mark.",
      ].join("\n"),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("alpha release smoke command");
    expect(result.stdout).toContain("alpha release smoke evidence artifact");
    expect(result.stdout).toContain("alpha stability and compatibility expectations");
  });

  it("fails when the guide omits the doctor JSON compatibility rule", () => {
    const root = createFixture(
      {
        fixed: [],
        linked: [],
      },
      [
        "# Release",
        "`.changeset/config.json` is the source of truth.",
        "- **Mode**: Independent",
        "The fixed and linked arrays are empty.",
        "Select each changed publishable package를 각각 when creating a changeset.",
        "The release workflow exports NPM_CONFIG_PROVENANCE=true.",
        "Maintainers verify provenance with npm audit signatures.",
        "The npm Version field shows the provenance check mark.",
        "Run pnpm alpha-release:smoke before publish.",
        "Upload ci-reports/release/alpha-release-smoke.md as release evidence.",
        "Release notes state alpha stability and compatibility expectations.",
      ].join("\n"),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("breaking doctor JSON changes");
  });

  it("fails when the guide mentions doctor JSON without the breaking-change policy", () => {
    const root = createFixture(
      {
        fixed: [],
        linked: [],
      },
      [
        "# Release",
        "`.changeset/config.json` is the source of truth.",
        "- **Mode**: Independent",
        "The fixed and linked arrays are empty.",
        "Select each changed publishable package를 각각 when creating a changeset.",
        "The release workflow exports NPM_CONFIG_PROVENANCE=true.",
        "Maintainers verify provenance with npm audit signatures.",
        "The npm Version field shows the provenance check mark.",
        "Run pnpm alpha-release:smoke before publish.",
        "Upload ci-reports/release/alpha-release-smoke.md as release evidence.",
        "Release notes state alpha stability and compatibility expectations.",
        "The `croco.doctor.v1` doctor JSON schema is documented in the CLI README.",
      ].join("\n"),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("breaking doctor JSON changes");
  });

  it("fails when configured fixed groups are missing from the guide", () => {
    const root = createFixture(
      {
        fixed: [["@croco/a", "@croco/b"]],
        linked: [],
      },
      [
        "# Release",
        "`.changeset/config.json` is the source of truth.",
        "- **Mode**: Fixed",
        "The fixed and linked behavior is reviewed during release.",
      ].join("\n"),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("fixed-group package @croco/a");
    expect(result.stdout).toContain("fixed-group package @croco/b");
  });

  it("fails when RC release notes are not required to link the migration matrix", () => {
    const root = createFixture(
      {
        fixed: [],
        linked: [],
      },
      [
        "# Release",
        "`.changeset/config.json` is the source of truth.",
        "- **Mode**: Independent",
        "The fixed and linked arrays are empty.",
        "Select each changed publishable package를 각각 when creating a changeset.",
        "The release workflow exports NPM_CONFIG_PROVENANCE=true.",
        "Maintainers verify provenance with npm audit signatures.",
        "The npm Version field shows the provenance check mark.",
        "Run pnpm alpha-release:smoke before publish.",
        "Upload ci-reports/release/alpha-release-smoke.md as release evidence.",
        "Release notes state alpha stability and compatibility expectations.",
        "Breaking changes to `croco.doctor.v1` doctor JSON output must either version the report schema or include release notes with a migration path.",
      ].join("\n"),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("RC release notes to link the 0.x-to-1.0 migration matrix");
  });

  it("fails when the migration matrix omits a package from the catalog spine", () => {
    const root = createFixture(
      {
        fixed: [],
        linked: [],
      },
      validReleaseGuide(),
      {
        spinePackages: ["framework-context", "cli"],
        spineDocs: validSpineDocs(["framework-context"]).replace(
          "## Later Section",
          "`@croco/cli` appears here as migration prose, but not as a Package table row.\n\n## Later Section",
        ),
      },
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "migration matrix Package table must include @croco/cli from docs/package-catalog.json spine.packages",
    );
  });
});

function createFixture(
  config: unknown,
  docs: string,
  options: {
    readonly spineDocs?: string;
    readonly spinePackages?: readonly string[];
  } = {},
): string {
  const root = mkdtempSync(join(tmpdir(), "croco-release-docs-"));
  tempRoots.push(root);
  mkdirSync(join(root, ".changeset"));
  mkdirSync(join(root, "docs/release"), { recursive: true });
  const spinePackages = options.spinePackages ?? DEFAULT_SPINE_PACKAGES;
  writeFileSync(join(root, ".changeset/config.json"), `${JSON.stringify(config, null, 2)}\n`);
  writeFileSync(
    join(root, "docs/package-catalog.json"),
    `${JSON.stringify({ schemaVersion: 1, spine: { packages: spinePackages } }, null, 2)}\n`,
  );
  writeFileSync(join(root, "RELEASING.md"), `${docs}\n`);
  writeFileSync(
    join(root, "docs/release/croco-1.0-spine.md"),
    `${options.spineDocs ?? validSpineDocs(spinePackages)}\n`,
  );

  return root;
}

function validReleaseGuide(): string {
  return [
    "# Release",
    "`.changeset/config.json` is the source of truth.",
    "- **Mode**: Independent",
    "The fixed and linked arrays are empty.",
    "Select each changed publishable package를 각각 when creating a changeset.",
    "The release workflow exports NPM_CONFIG_PROVENANCE=true.",
    "Maintainers verify provenance with npm audit signatures.",
    "The npm Version field shows the provenance check mark.",
    "Run pnpm alpha-release:smoke before publish.",
    "Upload ci-reports/release/alpha-release-smoke.md as release evidence.",
    "Release notes state alpha stability and compatibility expectations.",
    "Breaking changes to `croco.doctor.v1` doctor JSON output must either version the report schema or include release notes with a migration path.",
    "RC release notes link docs/release/croco-1.0-spine.md#0x-to-10-migration-matrix.",
    "RC notes list renamed/deprecated/removed public APIs and recovery with croco doctor plus croco upgrade --dry-run.",
  ].join("\n");
}

function validSpineDocs(spinePackages: readonly string[]): string {
  return [
    "# Croco 1.0 Spine",
    "",
    "## 0.x-to-1.0 Migration Matrix",
    "",
    "The migration matrix covers package entrypoints, generated app templates, manifests, ContractGraph, Problem codes, runtime capability changes, croco doctor, croco upgrade, and renamed/deprecated/removed artifacts.",
    "",
    "| Package | Compatibility surface | 0.x migration | Recovery |",
    "| --- | --- | --- | --- |",
    ...spinePackages.map(
      (packageSlug) =>
        `| \`${toSpinePackageName(packageSlug)}\` | package entrypoints, generated app templates, manifests, ContractGraph, Problem codes, runtime capability | renamed/deprecated/removed artifacts | Run \`croco doctor\` and \`croco upgrade --dry-run\`. |`,
    ),
    "",
    "## Later Section",
    "",
    "Content outside the matrix does not count for package coverage.",
  ].join("\n");
}

function toSpinePackageName(slug: string): string {
  return slug === "create-croco-app" ? slug : `@croco/${slug}`;
}

function runScript(root: string): ScriptResult {
  const result = spawnSync("node", ["--experimental-strip-types", scriptPath, "--root", root], {
    encoding: "utf-8",
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
