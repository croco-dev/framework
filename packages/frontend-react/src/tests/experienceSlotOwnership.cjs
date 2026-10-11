const childProcess = require("node:child_process");
const { appendFileSync } = require("node:fs");
const { syncBuiltinESMExports } = require("node:module");

const registry = process.env.CROCO_EXPERIENCE_SLOT_PROCESS_REGISTRY;
if (!registry) throw new Error("ExperienceSlot process ownership registry is required");
const originalSpawn = childProcess.spawn;
childProcess.spawn = function (command, args, options) {
  const child = originalSpawn.apply(this, arguments);
  if (child.pid) {
    const spawnOptions = Array.isArray(args) ? options : args;
    const detached = spawnOptions?.detached === true;
    try {
      appendFileSync(
        registry,
        `${JSON.stringify({ pid: child.pid, parentPid: process.pid, detached })}\n`,
      );
    } catch (error) {
      if (detached && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
      throw error;
    }
  }
  return child;
};
syncBuiltinESMExports();
