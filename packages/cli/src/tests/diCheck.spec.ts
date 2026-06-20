import { describe, expect, it } from "vitest";
import { parseDiCheckArgs, runDiCheck } from "../commands/diCheck.js";
import type { DiCheckIo } from "../commands/diCheck.js";

describe("diCheck", () => {
  it("fails manifests with graph diagnostics", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const manifest = {
      version: "croco.di-graph.manifest.v1",
      status: "failed",
      diagnostics: [
        {
          code: "framework-context/di-missing-provider",
          severity: "error",
          token: "Token<database.url>",
          message: "Provider 'Token<database.url>' is not registered.",
          path: ["UserService", "Token<database.url>"],
        },
      ],
    };

    const exitCode = await runDiCheck(["--manifest", "di-graph.json"], {
      io: createIo(JSON.stringify(manifest), stdout, stderr),
    });

    expect(exitCode).toBe(1);
    expect(stderr).toEqual([]);
    expect(stdout).toEqual([
      "framework-context/di-missing-provider token=Token<database.url>: Provider 'Token<database.url>' is not registered.",
      "DI graph check failed for croco.di-graph.manifest.v1 with 1 diagnostic(s).",
    ]);
  });

  it("passes ready module graph manifests", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const manifest = {
      version: "croco.module-graph.manifest.v1",
      status: "ready",
      diagnostics: [],
    };

    const exitCode = await runDiCheck(["module-graph.json"], {
      io: createIo(JSON.stringify(manifest), stdout, stderr),
    });

    expect(exitCode).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout).toEqual(["DI graph check passed for croco.module-graph.manifest.v1."]);
  });

  it("writes JSON check reports", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const writes = new Map<string, string>();

    const exitCode = await runDiCheck(["di-graph.json", "--json", "--out", "reports/di.json"], {
      io: {
        ...createIo(
          JSON.stringify({
            version: "croco.di-graph.manifest.v1",
            status: "ready",
            diagnostics: [],
          }),
          stdout,
          stderr,
        ),
        mkdir: () => {},
        writeFile: (path, content) => writes.set(path, content),
      },
    });

    expect(exitCode).toBe(0);
    expect(stdout).toEqual(["Wrote DI graph check report to /workspace/app/reports/di.json."]);
    expect(JSON.parse(writes.get("/workspace/app/reports/di.json") ?? "{}")).toMatchObject({
      version: "croco.di-check.report.v1",
      manifestVersion: "croco.di-graph.manifest.v1",
      status: "passed",
    });
  });

  it("parses help and manifest arguments", () => {
    expect(parseDiCheckArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseDiCheckArgs(["--manifest", "graph.json"])).toMatchObject({
      kind: "run",
      options: { manifest: "graph.json" },
    });
  });
});

function createIo(content: string, stdout: string[], stderr: string[]): Partial<DiCheckIo> {
  return {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
    readFile: () => content,
    cwd: "/workspace/app",
  };
}
