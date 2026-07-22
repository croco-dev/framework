import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../release-docs-check.mts");
const tempRoots: string[] = [];
const DEFAULT_SPINE_PACKAGES = ["framework-context", "cli", "create-croco-app"] as const;
const RELEASE_APP_RUNBOOK_MARKERS = [
  "GitHub App owner",
  "current repository only",
  "`Contents`: Read and write",
  "`Pull requests`: Read and write",
  "Do not grant `Actions` or `Workflows`",
  "`RELEASE_APP_CLIENT_ID`",
  "`RELEASE_APP_PRIVATE_KEY`",
  "rotate the private key",
  "revoke the previous private key",
  "reinstall the GitHub App",
  "Release App credentials missing",
  "headRefOid",
  "head_sha",
  "action_required",
  "recursive Release workflow run",
] as const;

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
        ...validReleaseAppRunbookLines(),
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

  it.each(RELEASE_APP_RUNBOOK_MARKERS)("fails when the GitHub App runbook omits %s", (marker) => {
    const root = createFixture(
      { fixed: [], linked: [] },
      validReleaseGuide().replace(marker, "omitted-runbook-marker"),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("RELEASING.md must");
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

  it("fails when the silent-success audit omits a package or coverage class", () => {
    const audit = validSilentSuccessAudit(["framework-context", "cli"]);
    audit.packages = audit.packages.filter((entry) => entry.package !== "cli");
    delete audit.packages[0].coverage.decoder;
    const root = createFixture({ fixed: [], linked: [] }, validReleaseGuide(), {
      audit,
      spinePackages: ["framework-context", "cli"],
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("audit must include cli");
    expect(result.stdout).toContain("coverage.decoder.status must be reviewed or none-found");
  });

  it("fails when audit evidence does not resolve to a repository symbol or test", () => {
    const audit = validSilentSuccessAudit(["framework-context"]);
    audit.packages[0].surfaces[0].source.identifier = "missingSourceSymbol";
    audit.packages[0].surfaces[0].test.path =
      "packages/framework-context/src/tests/missing.spec.ts";
    const root = createFixture({ fixed: [], linked: [] }, validReleaseGuide(), {
      audit,
      spinePackages: ["framework-context"],
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("source.identifier must occur");
    expect(result.stdout).toContain("test.path must reference an existing file");
  });

  it("fails when audit evidence leaves the repository or a surface is not covered", () => {
    const audit = validSilentSuccessAudit(["framework-context"]);
    audit.packages[0].surfaces[0].source.path = "../outside.ts";
    audit.packages[0].coverage.configuration.surfaceIds = [];
    const root = createFixture({ fixed: [], linked: [] }, validReleaseGuide(), {
      audit,
      spinePackages: ["framework-context"],
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("source.path must stay inside the repository");
    expect(result.stdout).toContain("surface public-options must be listed by its coverage class");
  });

  it("fails when audit evidence escapes through a repository symlink", () => {
    const audit = validSilentSuccessAudit(["framework-context"]);
    audit.packages[0].surfaces[0].source.path =
      "packages/framework-context/src/external-evidence.ts";
    const root = createFixture({ fixed: [], linked: [] }, validReleaseGuide(), {
      audit,
      spinePackages: ["framework-context"],
    });
    const externalRoot = mkdtempSync(join(tmpdir(), "release-docs-external-"));
    tempRoots.push(externalRoot);
    const externalFile = join(externalRoot, "external-evidence.ts");
    writeFileSync(externalFile, "export type PublicOptions = { enabled: boolean };\n");
    symlinkSync(externalFile, join(root, audit.packages[0].surfaces[0].source.path));

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("source.path must stay inside the repository");
  });

  it("fails when required audit arrays are empty", () => {
    const audit = validSilentSuccessAudit(["framework-context"]);
    audit.packages[0].surfaces[0].members = [];
    audit.packages[0].coverage.configuration.reviewPaths = [];
    audit.packages[0].coverage.configuration.searchTerms = [];
    (audit.packages[0].surfaces[0] as { sources?: unknown }).sources = [];
    const root = createFixture({ fixed: [], linked: [] }, validReleaseGuide(), {
      audit,
      spinePackages: ["framework-context"],
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("members must be a non-empty string array");
    expect(result.stdout).toContain("must include non-empty reviewPaths and searchTerms");
    expect(result.stdout).toContain("sources must be a non-empty evidence array when provided");
  });

  it("fails when unresolved or duplicate audit surfaces lack focused evidence", () => {
    const audit = validSilentSuccessAudit(["framework-context"]);
    const surface = audit.packages[0].surfaces[0];
    surface.status = "unresolved";
    surface.issue = "https://example.com/issue/1";
    surface.regressionTest = "";
    audit.packages[0].surfaces.push({ ...surface });
    const root = createFixture({ fixed: [], linked: [] }, validReleaseGuide(), {
      audit,
      spinePackages: ["framework-context"],
    });

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("must not repeat surface id");
    expect(result.stdout).toContain("must link a focused croco-dev/framework issue");
    expect(result.stdout).toContain("must name the owning-package acceptance boundary");
  });
});

function createFixture(
  config: unknown,
  docs: string,
  options: {
    readonly audit?: ReturnType<typeof validSilentSuccessAudit>;
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
  writeAuditFixtureFiles(root, spinePackages);
  writeFileSync(
    join(root, "docs/release/silent-success-audit.json"),
    `${JSON.stringify(options.audit ?? validSilentSuccessAudit(spinePackages), null, 2)}\n`,
  );
  writeFileSync(join(root, "RELEASING.md"), `${docs}\n`);
  writeFileSync(
    join(root, "docs/release/croco-1.0-spine.md"),
    `${options.spineDocs ?? validSpineDocs(spinePackages)}\n`,
  );

  return root;
}

function validSilentSuccessAudit(spinePackages: readonly string[]) {
  return {
    schemaVersion: 1,
    sourceIssue: "https://github.com/croco-dev/framework/issues/1332",
    packages: spinePackages.map((packageName) => ({
      package: packageName,
      coverage: Object.fromEntries(
        ["configuration", "decoder", "lifecycle", "fallback", "verification"].map((category) => [
          category,
          {
            status: category === "configuration" ? "reviewed" : "none-found",
            surfaceIds: category === "configuration" ? ["public-options"] : [],
            reviewPaths: [`packages/${packageName}/src`],
            searchTerms: [category],
          },
        ]),
      ),
      surfaces: [
        {
          id: "public-options",
          category: "configuration",
          disposition: "implemented-tested",
          status: "complete",
          members: ["PublicOptions.enabled"],
          source: {
            path: `packages/${packageName}/src/index.ts`,
            identifier: "PublicOptions",
          },
          test: {
            path: `packages/${packageName}/src/tests/AuditEvidence.spec.ts`,
            identifier: "exercises public options",
          },
        },
      ],
    })),
  };
}

function writeAuditFixtureFiles(root: string, spinePackages: readonly string[]): void {
  for (const packageName of spinePackages) {
    mkdirSync(join(root, `packages/${packageName}/src/tests`), {
      recursive: true,
    });
    writeFileSync(
      join(root, `packages/${packageName}/src/index.ts`),
      "export type PublicOptions = { enabled: boolean };\n",
    );
    writeFileSync(
      join(root, `packages/${packageName}/src/tests/AuditEvidence.spec.ts`),
      "it('exercises public options', () => {});\n",
    );
  }
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
    ...validReleaseAppRunbookLines(),
  ].join("\n");
}

function validReleaseAppRunbookLines(): string[] {
  return [
    "The GitHub App owner installs the App on the current repository only.",
    "Grant `Contents`: Read and write and `Pull requests`: Read and write.",
    "Do not grant `Actions` or `Workflows` permissions.",
    "Configure `RELEASE_APP_CLIENT_ID` and `RELEASE_APP_PRIVATE_KEY`.",
    "On rotation, rotate the private key and revoke the previous private key.",
    "If installation is missing, reinstall the GitHub App.",
    "The Release App credentials missing diagnostic names absent configuration.",
    "Compare the PR headRefOid with workflow head_sha and reject action_required.",
    "There must be no recursive Release workflow run.",
  ];
}

function validSpineDocs(spinePackages: readonly string[]): string {
  return [
    "# Croco 1.0 Spine",
    "",
    "The checked inventory is [silent-success-audit.json](silent-success-audit.json).",
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
