import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCrocoCommand, runCroco } from "../index.js";

const temporaryDirectories: string[] = [];
const originalExitCode = process.exitCode;

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Croco root runner", () => {
  it("exports a side-effect-free root command factory from the package barrel", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const command = createCrocoCommand({
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(await resolveMeta(command.meta)).toMatchObject({ name: "croco" });
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([]);
  });

  it("returns success and writes help through injected stdout without exiting", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exit = vi.spyOn(process, "exit");

    const result = await runCroco(["--help"], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(result).toEqual({ exitCode: 0 });
    expect(stdout.join("\n")).toContain("Croco framework CLI");
    expect(stdout.join("\n")).toContain("COMMANDS");
    expect(stderr).toEqual([]);
    expect(exit).not.toHaveBeenCalled();
  });

  it("returns a structured failure for an unknown command", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const result = await runCroco(["unknown-command"], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(result).toEqual({ exitCode: 1 });
    expect(stdout.join("\n")).toContain("Croco framework CLI");
    expect(stderr).toEqual(["Unknown command `unknown-command`"]);
  });

  it("uses injected cwd and output for leaf commands", async () => {
    const cwd = createTemporaryDirectory();
    const stdout: string[] = [];
    const stderr: string[] = [];

    const result = await runCroco(["make", "controller", "Example", "--dryRun"], {
      cwd,
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(result).toEqual({ exitCode: 0 });
    expect(stdout).toEqual(["No Croco workspace detected. Run from a Croco project."]);
    expect(stderr).toEqual([]);
  });

  it("uses injected env without mutating the embedding process exit code", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const fetchJobs = vi.fn(async () =>
      Response.json({
        summary: "healthy",
        generatedAt: "2026-08-27T00:00:00.000Z",
        total: 0,
        attentionCount: 0,
        jobs: [],
      }),
    );
    vi.stubGlobal("fetch", fetchJobs);
    process.exitCode = 23;

    const result = await runCroco(["jobs", "list", "--json"], {
      env: { CROCO_JOBS_URL: "https://jobs.example.test/base" },
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(result).toEqual({ exitCode: 0 });
    expect(process.exitCode).toBe(23);
    expect(fetchJobs).toHaveBeenCalledWith(
      "https://jobs.example.test/base/jobs",
      expect.objectContaining({ method: "GET" }),
    );
    expect(JSON.parse(stdout.join("\n"))).toMatchObject({ summary: "healthy", total: 0 });
    expect(stderr).toEqual([]);
  });

  it("isolates injected dependencies between concurrent runs", async () => {
    const firstStdout: string[] = [];
    const secondStdout: string[] = [];
    const fetchJobs = vi.fn(async (input: string) =>
      Response.json({
        summary: "healthy",
        generatedAt: input,
        total: 0,
        attentionCount: 0,
        jobs: [],
      }),
    );
    vi.stubGlobal("fetch", fetchJobs);

    const [firstResult, secondResult] = await Promise.all([
      runCroco(["jobs", "list", "--json"], {
        env: { CROCO_JOBS_URL: "https://first.example.test" },
        stdout: (message) => firstStdout.push(message),
      }),
      runCroco(["jobs", "list", "--json"], {
        env: { CROCO_JOBS_URL: "https://second.example.test" },
        stdout: (message) => secondStdout.push(message),
      }),
    ]);

    expect(firstResult).toEqual({ exitCode: 0 });
    expect(secondResult).toEqual({ exitCode: 0 });
    expect(JSON.parse(firstStdout.join("\n"))).toMatchObject({
      generatedAt: "https://first.example.test/jobs",
    });
    expect(JSON.parse(secondStdout.join("\n"))).toMatchObject({
      generatedAt: "https://second.example.test/jobs",
    });
  });

  it("returns leaf command exit codes without mutating the embedding process", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    process.exitCode = 23;

    const result = await runCroco(["architecture-policy", "check"], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(result).toEqual({ exitCode: 1 });
    expect(process.exitCode).toBe(23);
    expect(stderr).toEqual(["Missing architecture policy manifest. Pass --manifest <path>."]);
    expect(stdout.join("\n")).toContain("croco architecture-policy check");
  });

  it("bridges migration failures into the root result without mutating the embedding process", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    process.exitCode = 23;

    const result = await runCroco(["migrate", "up", "--overwrite"], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(result).toEqual({ exitCode: 1 });
    expect(process.exitCode).toBe(23);
    expect(stdout).toEqual([]);
    expect(stderr).toEqual(["Unknown option: --overwrite"]);
  });

  it("reports an unexpected command failure once through injected stderr", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("network failed"))),
    );

    const result = await runCroco(["jobs", "list"], {
      env: { CROCO_JOBS_URL: "https://jobs.example.test" },
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(result).toEqual({ exitCode: 1 });
    expect(stdout).toEqual([]);
    expect(stderr).toHaveLength(1);
    expect(stderr[0]).toContain("network failed");
  });
});

function createTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "croco-runner-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function resolveMeta<T>(value: T | Promise<T> | (() => T | Promise<T>)): Promise<T> {
  return typeof value === "function" ? (value as () => T | Promise<T>)() : value;
}
