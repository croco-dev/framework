import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = resolve(__dirname, "../version-packages.mts");
const tempDirectories: string[] = [];

describe("version-packages.mts", () => {
  afterEach(() => {
    for (const directory of tempDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("runs only read-only preview and verification commands in dry-run mode", () => {
    const harness = createCommandHarness();
    const result = runScript(harness, "--dry-run");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("dry-run; no release files will be modified");
    expect(readCommands(harness.logPath)).toEqual([
      ["exec", "changeset", "status"],
      ["package-manifests:check"],
      ["release-version-sync:check"],
      ["docs:catalog:check"],
    ]);
    expect(result.stdout).toContain("dry-run verification completed without modifying files");
  });

  it("preserves the ordered mutating release synchronization when no option is provided", () => {
    const harness = createCommandHarness();
    const result = runScript(harness);

    expect(result.status).toBe(0);
    expect(readCommands(harness.logPath)).toEqual([
      ["exec", "changeset", "version"],
      ["package-manifests:write"],
      ["release-version-sync:write"],
      ["docs:catalog:write"],
    ]);
    expect(result.stdout).toContain("release PR metadata is synchronized");
  });

  it("rejects unsupported arguments before starting any command", () => {
    const harness = createCommandHarness();
    const result = runScript(harness, "--dry-run", "--unknown");

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "unsupported arguments: --dry-run --unknown; expected only --dry-run",
    );
    expect(readCommands(harness.logPath)).toEqual([]);
  });
});

type CommandHarness = {
  readonly binDirectory: string;
  readonly logPath: string;
};

function createCommandHarness(): CommandHarness {
  const directory = mkdtempSync(join(tmpdir(), "croco-version-packages-"));
  tempDirectories.push(directory);
  const executableName = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const executablePath = join(directory, executableName);
  const logPath = join(directory, "commands.log");

  writeFileSync(
    executablePath,
    [
      "#!/usr/bin/env node",
      'const { appendFileSync } = require("node:fs");',
      "appendFileSync(process.env.VERSION_PACKAGES_COMMAND_LOG, `${JSON.stringify(process.argv.slice(2))}\\n`);",
      "",
    ].join("\n"),
    "utf-8",
  );
  chmodSync(executablePath, 0o755);

  return { binDirectory: directory, logPath };
}

function runScript(harness: CommandHarness, ...args: string[]) {
  return spawnSync(process.execPath, ["--experimental-strip-types", scriptPath, ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: `${harness.binDirectory}${delimiter}${process.env.PATH ?? ""}`,
      VERSION_PACKAGES_COMMAND_LOG: harness.logPath,
    },
  });
}

function readCommands(logPath: string): readonly (readonly string[])[] {
  if (!existsSync(logPath)) {
    return [];
  }

  return readFileSync(logPath, "utf-8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as readonly string[]);
}

type ReleaseType = "patch" | "minor" | "major";
type ReleaseFixture = {
  dependencyRelease: ReleaseType;
  dependentRelease?: ReleaseType;
  range?: string;
  dependencyKind?: "dependencies" | "peerDependencies";
  onlyUpdatePeerDependentsWhenOutOfRange?: boolean;
  excluded?: "ignored" | "private";
  transitivePeer?: boolean;
};

describe("installed Changesets CLI release planning", () => {
  afterEach(() => {
    for (const directory of tempDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it.each([
    ["minor", undefined],
    ["major", undefined],
    ["minor", "patch"],
    ["minor", "minor"],
    ["major", "patch"],
    ["major", "minor"],
    ["minor", "major"],
  ] as const)(
    "releases a peer dependent as major for a %s dependency release with an existing %s release",
    (dependencyRelease, dependentRelease) => {
      const releases = planReleases({ dependencyRelease, dependentRelease });

      expect(releases.dependent).toEqual({ type: "major", newVersion: "2.0.0" });
    },
  );

  it("does not release an in-range peer dependent for a dependency patch", () => {
    const releases = planReleases({ dependencyRelease: "patch" });

    expect(releases.dependent).toBeUndefined();
  });

  it("patches an out-of-range peer dependent for a dependency patch", () => {
    const releases = planReleases({ dependencyRelease: "patch", range: "1.0.0" });

    expect(releases.dependent).toEqual({ type: "patch", newVersion: "1.0.1" });
  });

  it("patches an ordinary dependent when a major dependency release leaves its range", () => {
    const releases = planReleases({ dependencyRelease: "major", dependencyKind: "dependencies" });

    expect(releases.dependent).toEqual({ type: "patch", newVersion: "1.0.1" });
  });

  it("preserves an in-range peer dependent release when out-of-range-only updates are enabled", () => {
    const releases = planReleases({
      dependencyRelease: "minor",
      dependentRelease: "patch",
      onlyUpdatePeerDependentsWhenOutOfRange: true,
    });

    expect(releases.dependent).toEqual({ type: "patch", newVersion: "1.0.1" });
  });

  it("still majors an out-of-range peer dependent when out-of-range-only updates are enabled", () => {
    const releases = planReleases({
      dependencyRelease: "major",
      onlyUpdatePeerDependentsWhenOutOfRange: true,
    });

    expect(releases.dependent).toEqual({ type: "major", newVersion: "2.0.0" });
  });

  it.each(["ignored", "private"] as const)(
    "excludes %s peer dependents from versioned releases",
    (excluded) => {
      const releases = planReleases({ dependencyRelease: "major", excluded });

      expect(releases.dependent).toBeUndefined();
    },
  );

  it("propagates a promoted peer release to its own peer dependents", () => {
    const releases = planReleases({
      dependencyRelease: "minor",
      dependentRelease: "patch",
      transitivePeer: true,
    });

    expect(releases.transitive).toEqual({ type: "major", newVersion: "2.0.0" });
  });
});

function planReleases(
  fixture: ReleaseFixture,
): Record<string, { type: ReleaseType; newVersion: string }> {
  const directory = mkdtempSync(join(tmpdir(), "croco-release-plan-"));
  tempDirectories.push(directory);
  mkdirSync(join(directory, ".changeset"));
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ name: "release-fixture", private: true, workspaces: ["packages/*"] }),
  );
  writeFileSync(join(directory, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
  writeFileSync(
    join(directory, ".changeset/config.json"),
    JSON.stringify({
      changelog: false,
      commit: false,
      fixed: [],
      linked: [],
      access: "public",
      baseBranch: "trunk",
      updateInternalDependencies: "patch",
      ignore: fixture.excluded === "ignored" ? ["dependent"] : [],
      privatePackages: { version: false, tag: false },
      ___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH: {
        onlyUpdatePeerDependentsWhenOutOfRange:
          fixture.onlyUpdatePeerDependentsWhenOutOfRange ?? false,
      },
    }),
  );
  const manifests = [
    { name: "dependency", version: "1.0.0" },
    {
      name: "dependent",
      version: "1.0.0",
      private: fixture.excluded === "private",
      [fixture.dependencyKind ?? "peerDependencies"]: { dependency: fixture.range ?? "^1.0.0" },
    },
    ...(fixture.transitivePeer
      ? [{ name: "transitive", version: "1.0.0", peerDependencies: { dependent: "^1.0.0" } }]
      : []),
  ];
  for (const manifest of manifests) {
    const packageDirectory = join(directory, "packages", manifest.name);
    mkdirSync(packageDirectory, { recursive: true });
    writeFileSync(join(packageDirectory, "package.json"), JSON.stringify(manifest));
  }
  const changes = [`"dependency": ${fixture.dependencyRelease}`];
  if (fixture.dependentRelease) changes.push(`"dependent": ${fixture.dependentRelease}`);
  writeFileSync(
    join(directory, ".changeset/release.md"),
    `---\n${changes.join("\n")}\n---\nRelease fixture.\n`,
  );

  for (const args of [
    ["init", "--initial-branch=trunk"],
    ["add", "."],
    [
      "-c",
      "user.name=Release Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-m",
      "Release fixture",
    ],
  ]) {
    const git = spawnSync("git", args, { cwd: directory, encoding: "utf-8", timeout: 10000 });
    expect(git.status, `${git.stdout}\n${git.stderr}`).toBe(0);
  }

  const result = spawnSync(
    process.execPath,
    [
      resolve(__dirname, "../../node_modules/@changesets/cli/bin.js"),
      "status",
      "--output=plan.json",
    ],
    {
      cwd: directory,
      encoding: "utf-8",
      timeout: 10000,
    },
  );
  expect(result.status, `${result.stdout}\n${result.stderr}\n${result.error ?? ""}`).toBe(0);
  const plan = JSON.parse(readFileSync(join(directory, "plan.json"), "utf-8")) as {
    releases: { name: string; type: ReleaseType | "none"; newVersion: string }[];
  };
  return Object.fromEntries(
    plan.releases.flatMap(({ name, type, newVersion }) =>
      type === "none" ? [] : [[name, { type, newVersion }] as const],
    ),
  );
}
