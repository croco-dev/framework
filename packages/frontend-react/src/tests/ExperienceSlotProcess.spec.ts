import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { runExperienceSlotProcess } from "./experienceSlotProcess.cjs";

const fixture = fileURLToPath(
  new URL("./fixtures/experienceSlotProcessFixture.cjs", import.meta.url),
);

async function isRunning(pid: number) {
  try {
    process.kill(pid, 0);
    if (process.platform === "linux") {
      const stat = await readFile(`/proc/${pid}/stat`, "utf8");
      return stat.split(") ")[1]?.[0] !== "Z";
    }
    return true;
  } catch (error) {
    if (["ESRCH", "ENOENT"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw error;
  }
}

describe("ExperienceSlot process supervisor", () => {
  it("returns output only after a successful exit", async () => {
    expect(await runExperienceSlotProcess(fixture, { args: ["success"] })).toBe("[]");
  });

  it("removes its temporary directory before resolving success", async () => {
    const directory = await runExperienceSlotProcess(fixture, { args: ["tmp-success"] });
    await expect(access(directory)).rejects.toThrow();
  });

  it("does not extend execution for malformed diagnostics", async () => {
    await expect(
      runExperienceSlotProcess(fixture, {
        args: ["malformed-diagnostic"],
        timeoutMs: 200,
        graceMs: 30,
      }),
    ).rejects.toThrow("timeout after 200ms");
  });

  it("preserves assertion, environment and final phase diagnostics", async () => {
    const failure = await runExperienceSlotProcess(fixture, { args: ["failure"] }).catch(String);
    expect(failure).toContain("focus assertion failed");
    expect(failure).toContain('"exitCode":1');
    expect(failure).toContain(
      '"lastCompletedPhase":{"runner":"experienceSlotBrowser","stage":"bundle"',
    );
    expect(failure).toContain(
      '"finalDiagnostic":{"runner":"experienceSlotBrowser","stage":"assertion"',
    );
    expect(failure).toContain(process.version);
  });

  it("reports termination by signal", async () => {
    await expect(runExperienceSlotProcess(fixture, { args: ["signal"] })).rejects.toThrow(
      '"signal":"SIGTERM"',
    );
  });

  it("leaves malformed JSON rejected by the existing parent assertion", async () => {
    const output = await runExperienceSlotProcess(fixture, { args: ["malformed"] });
    expect(() => JSON.parse(output)).toThrow(SyntaxError);
  });

  it("allows native cleanup beyond the execution deadline where the old aggregate timeout fails", async () => {
    expect(() =>
      execFileSync(process.execPath, [fixture, "cleanup-success"], {
        timeout: 200,
        stdio: "pipe",
      }),
    ).toThrow(expect.objectContaining({ code: "ETIMEDOUT" }));
    expect(
      await runExperienceSlotProcess(fixture, {
        args: ["cleanup-success"],
        timeoutMs: 200,
        cleanupTimeoutMs: 700,
      }),
    ).toBe("[]");
  });

  it("does not renew the cleanup deadline on repeated transition messages", async () => {
    await expect(
      runExperienceSlotProcess(fixture, {
        args: ["cleanup-repeat"],
        timeoutMs: 200,
        cleanupTimeoutMs: 200,
        graceMs: 30,
      }),
    ).rejects.toThrow("cleanup timeout after 200ms");
  });

  it("does not enter cleanup after execution has already timed out", async () => {
    await expect(
      runExperienceSlotProcess(fixture, {
        args: ["cleanup-late"],
        timeoutMs: 200,
        cleanupTimeoutMs: 10_000,
        graceMs: 30,
      }),
    ).rejects.toThrow("timeout after 200ms");
  });

  it("rejects an already aborted signal without starting the fixture", async () => {
    await expect(
      runExperienceSlotProcess(fixture, { signal: AbortSignal.abort() }),
    ).rejects.toThrow("interrupted before start");
  });

  it.runIf(process.platform !== "win32").each(["browser-stall", "browser-startup-stall"])(
    "kills a stopped real Chromium group and removes its profile on interruption: %s",
    async (mode) => {
      const directory = await mkdtemp(join(tmpdir(), "experience-slot-chromium-"));
      const controller = new AbortController();
      let pids: number[] = [];
      let result: Promise<unknown> | undefined;
      try {
        result = runExperienceSlotProcess(fixture, {
          args: [mode, directory],
          timeoutMs: 15_000,
          graceMs: 100,
          signal: controller.signal,
        }).catch((error: unknown) => error);
        await vi.waitFor(
          async () => {
            await access(join(directory, "ready"));
          },
          { timeout: 12_000, interval: 20 },
        );
        pids = (await readFile(join(directory, "pids"), "utf8")).trim().split("\n").map(Number);
        controller.abort();
        const error = await result;
        expect(error).toBeInstanceOf(Error);
        const failure = JSON.parse(String(error).split("ExperienceSlot runner failed: ")[1] ?? "");
        expect(failure.reason).toBe("interrupted");
        expect(failure.lingeringGroups).toEqual([]);
        expect(await Promise.all(pids.map(isRunning))).toEqual([false, false]);
        await expect(access(failure.environment.temporaryDirectory)).rejects.toThrow();
      } finally {
        controller.abort();
        await result;
        for (const pid of pids) if (await isRunning(pid)) process.kill(pid, "SIGKILL");
        await rm(directory, { recursive: true, force: true });
      }
    },
    20_000,
  );

  it.each([
    "timeout",
    "json-hang",
    "interrupt",
    "parent-exit1",
    "parent-signaled",
    "parent-exit0",
    "timeout-detached",
    "interrupt-detached",
    "parent-exit1-detached",
    "parent-signaled-detached",
    "parent-exit0-detached",
    "timeout-detached-unregistered",
    "interrupt-detached-unregistered",
    "parent-exit0-detached-unregistered",
    "parent-exit1-detached-unregistered",
    "parent-signaled-detached-unregistered",
  ])(
    "cleans temporary resources and resistant descendants on %s",
    async (mode) => {
      const directory = await mkdtemp(join(tmpdir(), "experience-slot-supervisor-"));
      const controller = new AbortController();
      const removeListener = vi.spyOn(controller.signal, "removeEventListener");
      let pids: number[] = [];
      let result: Promise<unknown> | undefined;
      try {
        result = runExperienceSlotProcess(fixture, {
          args: [mode, directory],
          timeoutMs: 1_500,
          graceMs: 100,
          signal: controller.signal,
        }).catch((error: unknown) => error);
        await vi.waitFor(
          async () => {
            await access(join(directory, "ready"));
          },
          { timeout: 1_200, interval: 10 },
        );
        pids = (await readFile(join(directory, "pids"), "utf8")).trim().split("\n").map(Number);
        expect(pids).toHaveLength(3);
        if (mode.startsWith("interrupt")) controller.abort();
        const error = await result;
        expect(error).toBeInstanceOf(Error);
        const failure = JSON.parse(String(error).split("ExperienceSlot runner failed: ")[1] ?? "");
        await expect(access(failure.environment.temporaryDirectory)).rejects.toThrow();
        expect(String(error)).toContain(
          mode.startsWith("interrupt")
            ? "interrupted"
            : mode.startsWith("parent-exit0")
              ? "runner exited with live descendants"
              : mode.startsWith("parent-")
                ? "nonzero exit"
                : "timeout after 1500ms",
        );
        if (mode === "json-hang") expect(String(error)).toContain('"stdout":"[]"');
        await vi.waitFor(async () => {
          expect(await Promise.all(pids.map(isRunning))).toEqual([false, false, false]);
        });
        if (process.platform !== "win32" && !mode.startsWith("parent-"))
          await expect(access(join(directory, "owned-temp"))).rejects.toThrow();
        expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
      } finally {
        controller.abort();
        await result;
        for (const pid of pids) if (await isRunning(pid)) process.kill(pid, "SIGKILL");
        await rm(directory, { recursive: true, force: true });
        vi.restoreAllMocks();
      }
    },
    5_000,
  );
});
