const { spawn } = require("node:child_process");
const { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const RUN_TIMEOUT_MS = 30_000;
const CLEANUP_TIMEOUT_MS = 35_000;
const TERMINATION_GRACE_MS = 1_000;
const TEST_TIMEOUT_MS = RUN_TIMEOUT_MS + CLEANUP_TIMEOUT_MS + TERMINATION_GRACE_MS + 5_000;

function runExperienceSlotProcess(
  runner,
  {
    timeoutMs = RUN_TIMEOUT_MS,
    cleanupTimeoutMs = CLEANUP_TIMEOUT_MS,
    graceMs = TERMINATION_GRACE_MS,
    signal,
    args = [],
  } = {},
) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("ExperienceSlot runner interrupted before start"));
      return;
    }
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "experience-slot-browser-"));
    const ownershipRegistry = join(temporaryDirectory, "process-ownership.jsonl");
    const ownershipPreload = join(__dirname, "experienceSlotOwnership.cjs");
    writeFileSync(ownershipRegistry, "");
    const child = spawn(process.execPath, ["--require", ownershipPreload, runner, ...args], {
      env: {
        ...process.env,
        CROCO_EXPERIENCE_SLOT_PROCESS_REGISTRY: ownershipRegistry,
        NODE_OPTIONS:
          `${process.env.NODE_OPTIONS ?? ""} --require ${JSON.stringify(ownershipPreload)}`.trim(),
        TMPDIR: temporaryDirectory,
        TMP: temporaryDirectory,
        TEMP: temporaryDirectory,
      },
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const processGroups = new Set(child.pid ? [child.pid] : []);
    let lingeringGroups = [];
    let ownershipFailed = false;
    let diagnosticBuffer = "";
    let cleanupStarted = false;
    let stdout = "";
    let stderr = "";
    let reason;
    let spawnError;
    let exitCode;
    let exitSignal;
    let closed = false;
    let terminated = false;
    let terminationSignal = "SIGTERM";
    let killTimer;
    const terminationErrors = [];
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
      diagnosticBuffer += chunk;
      const lines = diagnosticBuffer.split("\n");
      diagnosticBuffer = lines.pop();
      for (const line of lines) {
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }
        if (
          !reason &&
          !closed &&
          !cleanupStarted &&
          entry?.runner === "experienceSlotBrowser" &&
          entry.stage === "cleanup" &&
          entry.event === "start"
        ) {
          cleanupStarted = true;
          clearTimeout(runTimer);
          runTimer = setTimeout(
            () => terminate(`cleanup timeout after ${cleanupTimeoutMs}ms`),
            cleanupTimeoutMs,
          );
        }
      }
    });

    function finish() {
      if (!closed || (reason && !terminated)) return;
      clearTimeout(runTimer);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", onAbort);
      try {
        if (lingeringGroups.length === 0 && !ownershipFailed)
          rmSync(temporaryDirectory, { recursive: true });
      } catch (error) {
        terminationErrors.push(`Temporary directory cleanup failed: ${String(error)}`);
      }
      if (!reason && !spawnError && terminationErrors.length === 0 && exitCode === 0) {
        resolve(stdout);
        return;
      }
      const diagnostics = stderr
        .split("\n")
        .flatMap((line) => {
          try {
            return [JSON.parse(line)];
          } catch {
            return [];
          }
        })
        .filter((entry) => entry && entry.runner === "experienceSlotBrowser");
      const lastCompletedPhase = diagnostics.filter((entry) => entry.event === "completed").at(-1);
      reject(
        new Error(
          `ExperienceSlot runner failed: ${JSON.stringify({
            reason: reason ?? (terminationErrors.length ? "cleanup failed" : "nonzero exit"),
            exitCode,
            signal: exitSignal,
            spawnError: spawnError?.message,
            terminationErrors,
            processGroups: [...processGroups],
            lingeringGroups,
            environment: {
              temporaryDirectory,
              node: process.version,
              platform: process.platform,
              arch: process.arch,
              ci: process.env.CI ?? null,
              playwrightBrowsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH ?? null,
            },
            lastCompletedPhase,
            finalDiagnostic: diagnostics.at(-1),
            stdout,
            stderr,
          })}`,
        ),
      );
    }

    function liveGroups() {
      return [...processGroups].filter((pid) => {
        try {
          process.kill(process.platform === "win32" ? pid : -pid, 0);
          if (process.platform === "linux") {
            return readdirSync("/proc")
              .filter((name) => /^\d+$/.test(name))
              .some((name) => {
                try {
                  const stat = readFileSync(`/proc/${name}/stat`, "utf8");
                  const [state, , group] = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
                  return Number(group) === pid && state !== "Z";
                } catch (error) {
                  if (error.code === "ENOENT" || error.code === "ESRCH") return false;
                  throw error;
                }
              });
          }
          return true;
        } catch (error) {
          if (error.code === "ESRCH") return false;
          terminationErrors.push(String(error));
          return true;
        }
      });
    }

    function killGroups(killSignal) {
      if (process.platform === "win32") {
        for (const pid of liveGroups()) {
          const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
            stdio: "ignore",
            timeout: 1_000,
          });
          killer.on("error", (error) => terminationErrors.push(String(error)));
          killer.on("close", (code) => {
            if (code !== 0) terminationErrors.push(`taskkill exited ${code}`);
          });
        }
      } else {
        for (const pid of processGroups) {
          try {
            process.kill(-pid, killSignal);
          } catch (error) {
            if (error.code !== "ESRCH") terminationErrors.push(String(error));
          }
        }
      }
    }

    function waitForTermination(deadline) {
      const knownGroups = processGroups.size;
      readOwnershipRegistry();
      if (processGroups.size !== knownGroups) killGroups(terminationSignal);
      lingeringGroups = liveGroups();
      if (lingeringGroups.length && Date.now() < deadline) {
        killTimer = setTimeout(() => waitForTermination(deadline), 20);
        return;
      }
      if (lingeringGroups.length)
        terminationErrors.push("Process groups remain after SIGKILL; temporary directory retained");
      terminated = true;
      finish();
    }

    function readOwnershipRegistry() {
      try {
        const entries = readFileSync(ownershipRegistry, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
        for (const entry of entries) {
          if (
            !Number.isSafeInteger(entry.pid) ||
            entry.pid < 2 ||
            entry.pid === process.pid ||
            !Number.isSafeInteger(entry.parentPid) ||
            entry.parentPid < 2 ||
            typeof entry.detached !== "boolean"
          ) {
            throw new Error("Invalid process ownership registry entry");
          }
          if (entry.detached || process.platform === "win32") processGroups.add(entry.pid);
        }
      } catch (error) {
        if (!ownershipFailed)
          terminationErrors.push(`Process ownership inspection failed: ${String(error)}`);
        ownershipFailed = true;
      }
    }

    function terminate(cause) {
      if (reason) return;
      reason = cause;
      clearTimeout(runTimer);
      readOwnershipRegistry();
      killGroups("SIGTERM");
      killTimer = setTimeout(() => {
        readOwnershipRegistry();
        terminationSignal = "SIGKILL";
        killGroups(terminationSignal);
        waitForTermination(Date.now() + 1_000);
      }, graceMs);
    }
    function onAbort() {
      terminate("interrupted");
    }
    let runTimer = setTimeout(() => terminate(`timeout after ${timeoutMs}ms`), timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    child.on("error", (error) => {
      spawnError = error;
    });
    child.on("close", (code, childSignal) => {
      closed = true;
      exitCode = code;
      exitSignal = childSignal;
      readOwnershipRegistry();
      if (!reason && (spawnError || code !== 0 || ownershipFailed)) {
        terminate(
          spawnError
            ? "spawn failed"
            : ownershipFailed
              ? "ownership inspection failed"
              : "nonzero exit",
        );
      } else if (!reason && liveGroups().length) {
        terminate("runner exited with live descendants");
      }
      finish();
    });
  });
}

module.exports = { runExperienceSlotProcess, RUN_TIMEOUT_MS, CLEANUP_TIMEOUT_MS, TEST_TIMEOUT_MS };
