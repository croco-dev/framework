const { spawn } = require("node:child_process");
const { appendFileSync, existsSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const [mode, directory, role = "parent"] = process.argv.slice(2);
const diagnostic = (stage, event, details = {}) =>
  process.stderr.write(
    `${JSON.stringify({ runner: "experienceSlotBrowser", stage, event, ...details })}\n`,
  );
if (mode === "browser-stall" || mode === "browser-startup-stall") {
  const { createRequire } = require("node:module");
  const docsRequire = createRequire(join(__dirname, "../../../../docs/package.json"));
  const { chromium } = docsRequire("@playwright/test");
  if (mode === "browser-startup-stall") {
    const childProcess = require("node:child_process");
    const ownedSpawn = childProcess.spawn;
    childProcess.spawn = function (command) {
      const child = ownedSpawn.apply(this, arguments);
      if (command === chromium.executablePath() && child.pid) {
        writeFileSync(join(directory, "pids"), `${process.pid}\n${child.pid}\n`);
        process.kill(child.pid, "SIGSTOP");
        writeFileSync(join(directory, "ready"), "ready");
      }
      return child;
    };
    chromium
      .launch({ executablePath: chromium.executablePath(), timeout: 10_000 })
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
  } else
    (async () => {
      const server = await chromium.launchServer({ timeout: 10_000 });
      const pid = server.process().pid;
      diagnostic("chromium.process", "owned", { pid });
      writeFileSync(join(directory, "pids"), `${process.pid}\n${pid}\n`);
      process.kill(pid, "SIGSTOP");
      writeFileSync(join(directory, "ready"), "ready");
    })().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
} else if (mode === "success") {
  process.stdout.write("[]");
} else if (mode === "tmp-success") {
  writeFileSync(join(tmpdir(), "owned-file"), "owned");
  process.stdout.write(tmpdir());
} else if (mode === "malformed-diagnostic") {
  setInterval(() => process.stderr.write("{malformed diagnostic}\n"), 30);
} else if (mode === "malformed") {
  process.stdout.write("invalid JSON");
} else if (mode === "signal") {
  process.kill(process.pid, "SIGTERM");
} else if (mode === "failure") {
  diagnostic("bundle", "completed");
  diagnostic("assertion", "failed");
  process.stderr.write("focus assertion failed\n");
  process.exitCode = 1;
} else if (mode.startsWith("cleanup-")) {
  const emit = () => diagnostic("cleanup", "start");
  if (mode === "cleanup-late") {
    process.on("SIGTERM", emit);
    setInterval(() => {}, 10_000);
  } else {
    process.stderr.write("{malformed diagnostic}\n");
    emit();
    if (mode === "cleanup-success") setTimeout(() => process.stdout.write("[]"), 400);
    else setInterval(emit, 30);
  }
} else {
  writeFileSync(join(tmpdir(), `owned-${role}`), "owned");
  appendFileSync(join(directory, "pids"), `${process.pid}\n`);
  if (role === "parent") {
    mkdirSync(join(directory, "owned-temp"));
    process.on("SIGTERM", () => {
      rmSync(join(directory, "owned-temp"), { recursive: true });
      diagnostic("cleanup", "completed");
      process.exitCode = 1;
      clearInterval(keepAlive);
    });
  } else {
    process.on("SIGTERM", () => {});
  }
  if (role !== "grandchild") {
    const descendant = spawn(
      process.execPath,
      [__filename, mode, directory, role === "parent" ? "child" : "grandchild"],
      { stdio: "ignore", detached: role === "parent" && mode.includes("detached") },
    );
    descendant.unref();
    if (role === "parent" && mode.includes("detached") && !mode.includes("unregistered"))
      diagnostic("chromium.process", "owned", { pid: descendant.pid });
  } else {
    writeFileSync(join(directory, "ready"), "ready");
  }
  diagnostic(role, "completed");
  if (mode === "json-hang") process.stdout.write("[]");
  const keepAlive = setInterval(() => {}, 10_000);
  if (role === "parent" && mode.startsWith("parent-")) {
    const readyCheck = setInterval(() => {
      if (!existsSync(join(directory, "ready"))) return;
      clearInterval(readyCheck);
      clearInterval(keepAlive);
      if (mode.startsWith("parent-signaled")) {
        process.removeAllListeners("SIGTERM");
        process.kill(process.pid, "SIGTERM");
      } else {
        process.exitCode = mode.startsWith("parent-exit1") ? 1 : 0;
      }
    }, 10);
  }
}
