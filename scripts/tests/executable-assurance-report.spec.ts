import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bootstrapExecutableAssuranceRuntime,
  parseExecutableAssuranceReportOptions,
  writeExecutableAssuranceReport,
} from "../executable-assurance-report.mts";

const temporaryDirectories: string[] = [];
const repositoryRoot = resolve(import.meta.dirname, "../..");

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("executable-assurance-report", () => {
  it("requires explicit graph and evidence inputs and defaults to advisory mode", () => {
    expect(
      parseExecutableAssuranceReportOptions(["--graph", "graph.json", "--evidence", "bundle.json"]),
    ).toEqual({
      graphPath: "graph.json",
      evidencePath: "bundle.json",
      outputDirectory: "ci-reports/executable-assurance",
      mode: "advisory",
    });
    expect(() => parseExecutableAssuranceReportOptions(["--graph", "graph.json"])).toThrow(
      "--graph and --evidence are required",
    );
  });

  it("preserves runtime build diagnostics and selects the Windows pnpm executable", () => {
    expect(() =>
      bootstrapExecutableAssuranceRuntime(() => {
        throw Object.assign(new Error("Command exited with status 2"), {
          stderr: "TypeScript compiler exploded",
          stdout: "building @croco/testing",
        });
      }),
    ).toThrow("TypeScript compiler exploded");

    let command = "";
    bootstrapExecutableAssuranceRuntime((selectedCommand) => {
      command = selectedCommand;
    }, "win32");
    expect(command).toBe("pnpm.cmd");
  });

  it("writes deterministic JSON and Markdown verification reports", async () => {
    const directory = mkdtempSync(join(tmpdir(), "croco-assurance-report-"));
    temporaryDirectories.push(directory);
    const graphPath = join(directory, "graph.json");
    const evidencePath = join(directory, "bundle.json");
    const outputDirectory = join(directory, "out");
    writeFileSync(
      graphPath,
      `${JSON.stringify({
        schemaVersion: "croco.executable-assurance-graph/v1",
        nodes: [],
        obligations: [],
        artifactVersions: {},
      })}\n`,
    );
    writeFileSync(
      evidencePath,
      `${JSON.stringify({
        schemaVersion: "croco.test-evidence/v1",
        missingArtifacts: [],
        records: [],
        status: "passed",
        summary: { failed: 0, flaky: 0, passed: 0, skipped: 0, total: 0 },
      })}\n`,
    );
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const result = await writeExecutableAssuranceReport({
      graphPath,
      evidencePath,
      outputDirectory,
      mode: "advisory",
    });

    expect(result.status).toBe("passed");
    expect(existsSync(join(outputDirectory, "report.json"))).toBe(true);
    expect(readFileSync(join(outputDirectory, "summary.md"), "utf8")).toContain(
      "- Status: **PASSED**",
    );
  }, 60_000);

  it("runs through the repository CLI entrypoint", () => {
    const directory = mkdtempSync(join(tmpdir(), "croco-assurance-cli-"));
    temporaryDirectories.push(directory);
    const graphPath = join(directory, "graph.json");
    const evidencePath = join(directory, "bundle.json");
    const outputDirectory = join(directory, "out");
    writeFileSync(
      graphPath,
      `${JSON.stringify({
        schemaVersion: "croco.executable-assurance-graph/v1",
        nodes: [],
        obligations: [],
        artifactVersions: {},
      })}\n`,
    );
    writeFileSync(
      evidencePath,
      `${JSON.stringify({
        schemaVersion: "croco.test-evidence/v1",
        missingArtifacts: [],
        records: [],
        status: "passed",
        summary: { failed: 0, flaky: 0, passed: 0, skipped: 0, total: 0 },
      })}\n`,
    );

    execFileSync(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      [
        "assurance:report",
        "--graph",
        graphPath,
        "--evidence",
        evidencePath,
        "--out",
        outputDirectory,
      ],
      { cwd: repositoryRoot, stdio: "pipe" },
    );

    expect(existsSync(join(outputDirectory, "report.json"))).toBe(true);
    expect(readFileSync(join(outputDirectory, "summary.md"), "utf8")).toContain(
      "- Status: **PASSED**",
    );
  }, 60_000);
});
