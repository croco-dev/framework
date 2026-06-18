import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildPublicApiReportMarkdown,
  createPublicApiSnapshot,
  diffPublicApiSnapshots,
  summarizePublicApiDiff,
} from "../public-api-surface.mts";

const scriptPath = resolve(__dirname, "../public-api-surface.mts");
const tempRepos: string[] = [];

type ScriptResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
};

describe("public-api-surface.mts", () => {
  afterEach(() => {
    for (const repo of tempRepos.splice(0)) {
      rmSync(repo, { force: true, recursive: true });
    }
  });

  it("extracts runtime exports separately from type-only exports", () => {
    const repo = createTempRepo();
    writePackage(
      repo,
      "alpha",
      "@croco/alpha",
      [
        'export { RuntimeThing, type InlineType as RenamedInlineType } from "./runtime";',
        'export type { TypeThing } from "./types";',
        'export * from "./runtime-star";',
        'export type * from "./type-star";',
        'export * as RuntimeNamespace from "./namespace";',
        "export interface LocalType {}",
        "export const localValue = 1;",
        "export class LocalClass {}",
      ].join("\n"),
    );

    const snapshot = createPublicApiSnapshot(repo);
    const pkg = snapshot.packages[0];

    expect(pkg.packageName).toBe("@croco/alpha");
    expect(pkg.runtimeExports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ exportKind: "named", name: "RuntimeThing", source: "./runtime" }),
        expect.objectContaining({ exportKind: "star", name: "*", source: "./runtime-star" }),
        expect.objectContaining({
          exportKind: "namespace",
          name: "RuntimeNamespace",
          source: "./namespace",
        }),
        expect.objectContaining({ declarationKind: "const", name: "localValue", source: null }),
        expect.objectContaining({ declarationKind: "class", name: "LocalClass", source: null }),
      ]),
    );
    expect(pkg.typeExports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exportKind: "named",
          localName: "InlineType",
          name: "RenamedInlineType",
          source: "./runtime",
        }),
        expect.objectContaining({ exportKind: "named", name: "TypeThing", source: "./types" }),
        expect.objectContaining({ exportKind: "star", name: "*", source: "./type-star" }),
        expect.objectContaining({ declarationKind: "interface", name: "LocalType", source: null }),
      ]),
    );
  });

  it("expands local star re-exports into runtime and type symbols", () => {
    const repo = createTempRepo();
    writePackage(
      repo,
      "alpha",
      "@croco/alpha",
      'export * from "./internal";\nexport type * from "./type-only";\n',
    );
    writeFile(
      repo,
      "packages/alpha/src/internal.ts",
      "export const runtimeValue = 1;\nexport interface RuntimeFileType {}\n",
    );
    writeFile(
      repo,
      "packages/alpha/src/type-only.ts",
      "export const hiddenRuntime = 1;\nexport interface StarType {}\n",
    );

    const snapshot = createPublicApiSnapshot(repo);
    const pkg = snapshot.packages[0];

    expect(pkg.runtimeExports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          declarationKind: "const",
          name: "runtimeValue",
          source: "./internal",
        }),
      ]),
    );
    expect(pkg.runtimeExports).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "hiddenRuntime" })]),
    );
    expect(pkg.typeExports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          declarationKind: "interface",
          name: "RuntimeFileType",
          source: "./internal",
        }),
        expect.objectContaining({
          declarationKind: "interface",
          name: "StarType",
          source: "./type-only",
        }),
      ]),
    );
  });

  it("renders package-level public API diffs for reviewers", () => {
    const repo = createTempRepo();
    writePackage(
      repo,
      "alpha",
      "@croco/alpha",
      'export { OldRuntime } from "./old";\nexport type { OldType } from "./old-types";\n',
    );
    const previous = createPublicApiSnapshot(repo);
    writePackage(
      repo,
      "alpha",
      "@croco/alpha",
      'export { NewRuntime } from "./new";\nexport type { NewType } from "./new-types";\n',
    );
    const current = createPublicApiSnapshot(repo);
    const diff = diffPublicApiSnapshots(previous, current);
    const summary = summarizePublicApiDiff(
      current,
      diff,
      "public-api-surface.snapshot.json",
      "ci-reports/package-quality/public-api-diff.md",
    );
    const markdown = buildPublicApiReportMarkdown(summary, diff);

    expect(summary).toEqual(
      expect.objectContaining({
        changedPackages: 1,
        runtimeAdded: 1,
        runtimeRemoved: 1,
        typeAdded: 1,
        typeRemoved: 1,
      }),
    );
    expect(markdown).toContain("### @croco/alpha");
    expect(markdown).toContain("`+ NewRuntime from ./new`");
    expect(markdown).toContain("`- OldRuntime from ./old`");
    expect(markdown).toContain("`+ NewType from ./new-types`");
    expect(markdown).toContain("`- OldType from ./old-types`");
    expect(markdown).toContain("`pnpm public-api:write`");
  });

  it("fails check mode on drift without updating the committed snapshot", () => {
    const repo = createTempRepo();
    writePackage(repo, "alpha", "@croco/alpha", "export const initialValue = 1;\n");

    const writeResult = runScript(repo, "--write");
    const snapshotPath = join(repo, "public-api-surface.snapshot.json");
    const committedSnapshot = readFileSync(snapshotPath, "utf-8");

    writePackage(repo, "alpha", "@croco/alpha", "export const nextValue = 2;\n");
    const checkResult = runScript(repo, "--check");
    const report = readFileSync(
      join(repo, "ci-reports", "package-quality", "public-api-diff.md"),
      "utf-8",
    );

    expect(writeResult.status).toBe(0);
    expect(checkResult.status).toBe(1);
    expect(checkResult.stdout).toContain("snapshot drift detected");
    expect(readFileSync(snapshotPath, "utf-8")).toBe(committedSnapshot);
    expect(report).toContain("`+ nextValue (const)`");
    expect(report).toContain("`- initialValue (const)`");
  }, 20000);
});

function createTempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), "croco-public-api-"));
  tempRepos.push(repo);
  mkdirSync(join(repo, "packages"), { recursive: true });
  return repo;
}

function writePackage(repo: string, dirName: string, packageName: string, source: string): void {
  writeFile(
    repo,
    `packages/${dirName}/package.json`,
    `${JSON.stringify(
      {
        name: packageName,
        version: "0.0.0",
      },
      null,
      2,
    )}\n`,
  );
  writeFile(repo, `packages/${dirName}/src/index.ts`, source);
}

function writeFile(repo: string, relativePath: string, content: string): void {
  const filePath = join(repo, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
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
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status,
  };
}
