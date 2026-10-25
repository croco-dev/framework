import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supervisorPath = fileURLToPath(new URL("./experienceSlotProcess.cjs", import.meta.url));
const requireFromSupervisor = createRequire(supervisorPath);
const temporaryDirectories: string[] = [];

type Supervisor = (
  runner: string,
  options: {
    timeoutMs: number;
    cleanupTimeoutMs?: number;
    graceMs?: number;
  },
) => Promise<string>;

function startSupervisor(cleanupTimeoutMs = 200) {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  });
  const loaded = { exports: {} };
  // Execute the actual CJS supervisor with controllable child events and clock.
  // Real subprocess ownership and termination remain covered by the integration suite.
  runInNewContext(
    fs.readFileSync(supervisorPath, "utf8"),
    {
      module: loaded,
      __dirname: dirname(supervisorPath),
      process,
      Date,
      setTimeout,
      clearTimeout,
      require: (specifier: string): unknown => {
        if (specifier === "node:child_process") return { spawn: () => child };
        if (specifier === "node:fs") {
          return {
            ...fs,
            mkdtempSync: (prefix: string) => {
              const directory = fs.mkdtempSync(prefix);
              temporaryDirectories.push(directory);
              return directory;
            },
          };
        }
        return requireFromSupervisor(specifier);
      },
    },
    { filename: supervisorPath },
  );
  const run = (loaded.exports as { runExperienceSlotProcess: Supervisor }).runExperienceSlotProcess;
  const result = run("controlled-runner.cjs", {
    timeoutMs: 200,
    cleanupTimeoutMs,
    graceMs: 30,
  }).then(
    (output) => ({ output }),
    (error: unknown) => ({ error: String(error) }),
  );
  const diagnostic = (entry: object) => child.stderr.write(`${JSON.stringify(entry)}\n`);
  const cleanup = () =>
    diagnostic({ runner: "experienceSlotBrowser", stage: "cleanup", event: "start" });
  const close = () => child.emit("close", 0, null);
  return { child, result, diagnostic, cleanup, close };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  for (const directory of temporaryDirectories.splice(0))
    fs.rmSync(directory, { recursive: true, force: true });
});

describe("ExperienceSlot process deadlines", () => {
  it("allows cleanup to complete after the original execution deadline", async () => {
    const { child, result, cleanup, close } = startSupervisor(700);
    await vi.advanceTimersByTimeAsync(199);
    cleanup();
    await vi.advanceTimersByTimeAsync(400);
    child.stdout.write("[]");
    close();
    await vi.advanceTimersByTimeAsync(30);
    expect(await result).toEqual({ output: "[]" });
  });

  it("accepts an exit just before the cleanup deadline", async () => {
    const { child, result, cleanup, close } = startSupervisor();
    await vi.advanceTimersByTimeAsync(50);
    cleanup();
    await vi.advanceTimersByTimeAsync(199);
    child.stdout.write("[]");
    close();
    await vi.advanceTimersByTimeAsync(30);
    expect(await result).toEqual({ output: "[]" });
  });

  it("does not renew the cleanup deadline on repeated transition messages", async () => {
    const { result, cleanup, close } = startSupervisor();
    await vi.advanceTimersByTimeAsync(50);
    cleanup();
    await vi.advanceTimersByTimeAsync(150);
    cleanup();
    await vi.advanceTimersByTimeAsync(50);
    close();
    await vi.advanceTimersByTimeAsync(30);
    expect(await result).toEqual({ error: expect.stringContaining("cleanup timeout after 200ms") });
  });

  it("does not extend execution for malformed or unrelated diagnostics", async () => {
    const { child, result, diagnostic, close } = startSupervisor();
    await vi.advanceTimersByTimeAsync(199);
    child.stderr.write("{malformed diagnostic}\n");
    diagnostic({ runner: "otherRunner", stage: "cleanup", event: "start" });
    diagnostic({ runner: "experienceSlotBrowser", stage: "bundle", event: "start" });
    diagnostic({ runner: "experienceSlotBrowser", stage: "cleanup", event: "completed" });
    await vi.advanceTimersByTimeAsync(1);
    close();
    await vi.advanceTimersByTimeAsync(30);
    expect(await result).toEqual({ error: expect.stringContaining("timeout after 200ms") });
  });

  it("does not enter cleanup after execution has already timed out", async () => {
    const { result, cleanup, close } = startSupervisor(10_000);
    await vi.advanceTimersByTimeAsync(200);
    cleanup();
    close();
    await vi.advanceTimersByTimeAsync(30);
    expect(await result).toEqual({ error: expect.stringContaining("timeout after 200ms") });
  });
});
