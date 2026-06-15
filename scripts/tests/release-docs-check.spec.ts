import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../release-docs-check.mts");
const tempRoots: string[] = [];

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
      ].join("\n"),
    );

    const result = runScript(root);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("npm provenance publish configuration");
    expect(result.stdout).toContain("npm provenance CLI verification command");
    expect(result.stdout).toContain("npmjs.com provenance UI verification");
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
});

function createFixture(config: unknown, docs: string): string {
  const root = mkdtempSync(join(tmpdir(), "croco-release-docs-"));
  tempRoots.push(root);
  mkdirSync(join(root, ".changeset"));
  writeFileSync(join(root, ".changeset/config.json"), `${JSON.stringify(config, null, 2)}\n`);
  writeFileSync(join(root, "RELEASING.md"), `${docs}\n`);

  return root;
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
