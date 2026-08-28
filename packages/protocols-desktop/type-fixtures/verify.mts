#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { verifyLargeFixtureGenerated } from "./generate-large-fixture.mts";

const rootDir = resolve(import.meta.dirname, "../../..");
const fixtureDir = import.meta.dirname;
const tscPath = join(rootDir, "node_modules", "typescript", "bin", "tsc");
const expectedNegativeMarkers = [
  "missing-handler",
  "extra-handler",
  "invalid-handler-output",
  "undeclared-effect",
  "undeclared-event",
  "wrong-grant-access",
  "remote-privileged-exposure",
] as const;

type CommandResult = {
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
};

export function runDesktopTypeFixtures(): void {
  verifyLargeFixtureGenerated(false);
  verifyNoErrorSuppressions();
  verifyNegativeFixture();
  assertSucceeded("large desktop application fixture", runTypeScript("tsconfig.large.json"));
  console.log(
    `protocols-desktop-type-fixtures: ${expectedNegativeMarkers.length} negative contracts and 200-command/20-window fixture passed`,
  );
}

function verifyNoErrorSuppressions(): void {
  for (const fileName of ["negative.ts", "shared.ts", "large-app.ts"]) {
    if (readFileSync(join(fixtureDir, fileName), "utf8").includes("@ts-expect-error")) {
      throw new Error(`${fileName} must expose real diagnostics instead of suppressing them`);
    }
  }
}

function verifyNegativeFixture(): void {
  const result = runTypeScript("tsconfig.negative.json");
  if (result.status === 0) throw new Error("negative fixture unexpectedly compiled");

  const output = normalizeDiagnostics(`${result.stdout}${result.stderr}`);
  const sourcePath = join(fixtureDir, "negative.ts");
  const sourceLines = readFileSync(sourcePath, "utf8").split("\n");
  const markersByLine = new Map<number, string>();
  const declarationCounts = new Map<string, number>();

  sourceLines.forEach((line, index) => {
    const marker = line.match(/EXPECT_ERROR:([a-z-]+)/)?.[1];
    if (!marker) return;
    declarationCounts.set(marker, (declarationCounts.get(marker) ?? 0) + 1);
    const diagnosticLine = sourceLines.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex > index && candidate.trim() !== "" && !candidate.trim().startsWith("//"),
    );
    if (diagnosticLine < 0) throw new Error(`marker ${marker} has no following code`);
    markersByLine.set(diagnosticLine + 1, marker);
  });

  assertMarkerDeclarations(declarationCounts);

  const diagnostics = [...output.matchAll(/^(.+?)\((\d+),(\d+)\): error TS(\d+):/gm)];
  const headerCount = [...output.matchAll(/error TS\d+:/g)].length;
  if (diagnostics.length !== headerCount || diagnostics.length === 0) {
    throw new Error(`negative fixture contained an unparsed or missing diagnostic\n${output}`);
  }

  const observedCounts = new Map<string, number>();
  for (const diagnostic of diagnostics) {
    const file = diagnostic[1];
    const line = Number(diagnostic[2]);
    const marker = markersByLine.get(line);
    if (file !== relative(rootDir, sourcePath).replaceAll("\\", "/") || !marker) {
      throw new Error(
        `negative fixture had unrelated TS${diagnostic[4]} at ${file}:${line}:${diagnostic[3]}\n${output}`,
      );
    }
    observedCounts.set(marker, (observedCounts.get(marker) ?? 0) + 1);
  }

  const missing = expectedNegativeMarkers.filter((marker) => !observedCounts.has(marker));
  const duplicates = [...observedCounts.entries()]
    .filter(([, count]) => count !== 1)
    .map(([marker, count]) => `${marker} (${count})`);
  if (missing.length > 0 || duplicates.length > 0) {
    throw new Error(
      `negative fixture diagnostics were not one-to-one; missing=${missing.join(",") || "none"}; duplicates=${duplicates.join(",") || "none"}\n${output}`,
    );
  }
}

function assertMarkerDeclarations(declarationCounts: ReadonlyMap<string, number>): void {
  const required = new Set<string>(expectedNegativeMarkers);
  const unexpected = [...declarationCounts.keys()].filter((marker) => !required.has(marker));
  const missing = expectedNegativeMarkers.filter((marker) => !declarationCounts.has(marker));
  const duplicates = [...declarationCounts.entries()]
    .filter(([, count]) => count !== 1)
    .map(([marker, count]) => `${marker} (${count})`);
  if (unexpected.length > 0 || missing.length > 0 || duplicates.length > 0) {
    throw new Error(
      `negative fixture markers drifted; missing=${missing.join(",") || "none"}; unexpected=${unexpected.join(",") || "none"}; duplicates=${duplicates.join(",") || "none"}`,
    );
  }
}

function runTypeScript(configName: string): CommandResult {
  const result = spawnSync(
    process.execPath,
    [tscPath, "--pretty", "false", "-p", join(fixtureDir, configName)],
    {
      cwd: rootDir,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 180_000,
    },
  );
  if (result.error) throw result.error;
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

function assertSucceeded(label: string, result: CommandResult): void {
  if (result.status !== 0) throw new Error(`${label} failed\n${result.stdout}${result.stderr}`);
}

function normalizeDiagnostics(output: string): string {
  return output
    .replaceAll("\\", "/")
    .replaceAll(`${rootDir.replaceAll("\\", "/")}/`, "")
    .trim();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    runDesktopTypeFixtures();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`protocols-desktop-type-fixtures: failed: ${message}`);
    process.exitCode = 1;
  }
}
