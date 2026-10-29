import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";

const fromTest = createRequire(import.meta.url);
const fromInstrumentation = createRequire(
  fromTest.resolve("@opentelemetry/auto-instrumentations-node"),
);
const fromHostMetrics = createRequire(
  fromInstrumentation.resolve("@opentelemetry/instrumentation-host-metrics"),
);

describe("host metrics dependency security", () => {
  it("removes PowerShell Unicode delimiters from Windows service filters", async () => {
    // Execute the dependency's Windows branch in isolation; capture the sink without spawning PowerShell.
    const worker = new Worker(
      `
      const { parentPort, workerData } = require("node:worker_threads");
      Object.defineProperty(process, "platform", { value: "win32" });
      const util = require(workerData.util);
      const commands = [];
      util.powerShell = async (command) => { commands.push(command); return ""; };
      const { services } = require(workerData.processes);
      (async () => {
        await services("Spooler");
        await services("not-a-service” (Write-Output marker) “");
        parentPort.postMessage(commands);
      })().catch((error) => { throw error; });
      `,
      {
        eval: true,
        workerData: {
          util: join(dirname(fromHostMetrics.resolve("systeminformation")), "util.js"),
          processes: join(dirname(fromHostMetrics.resolve("systeminformation")), "processes.js"),
        },
      },
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const commands = await new Promise<unknown>((resolve, reject) => {
        worker.once("message", resolve);
        worker.once("error", reject);
        timer = setTimeout(
          () => reject(new Error("Windows services coercion did not complete")),
          5_000,
        );
      });
      expect(commands).toEqual([
        `Get-CimInstance Win32_Service -Filter "Name='spooler'" | select Name,Caption,Started,StartMode,ProcessId | fl`,
        `Get-CimInstance Win32_Service -Filter "Name='not-a-service write-output marker'" | select Name,Caption,Started,StartMode,ProcessId | fl`,
      ]);
    } finally {
      clearTimeout(timer);
      await worker.terminate();
    }
  });
});
