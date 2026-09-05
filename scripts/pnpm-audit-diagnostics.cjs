const diagnosticsChannel = require("node:diagnostics_channel");
const { writeSync } = require("node:fs");

const startedAt = performance.now();
const requestIds = new WeakMap();
let requestCount = 0;
let eventCount = 0;
let stage = "before-request";

function record(event, details = {}) {
  if (event !== "exit" && eventCount++ >= 32) {
    if (eventCount !== 33) return;
    event = "limit";
    details = {};
  }
  const cpu = process.cpuUsage();
  writeSync(
    2,
    `dependency-audit-transport ${JSON.stringify({
      event,
      elapsedMs: Math.round(performance.now() - startedAt),
      cpuUserMs: Math.round(cpu.user / 1000),
      cpuSystemMs: Math.round(cpu.system / 1000),
      stage,
      ...details,
    })}\n`,
  );
}

record("start", { nodeVersion: process.version });

for (const [channel, event, nextStage] of [
  ["create", "request", "waiting-send"],
  ["bodySent", "body-sent", "waiting-headers"],
  ["headers", "headers", "reading-body"],
  ["trailers", "body-complete", "processing-response"],
  ["error", "request-error", "request-failed"],
]) {
  diagnosticsChannel
    .channel(`undici:request:${channel}`)
    .subscribe(({ request, response, error }) => {
      if (!request.path.split("?")[0].endsWith("/-/npm/v1/security/advisories/bulk")) {
        return;
      }
      if (!requestIds.has(request)) {
        requestIds.set(request, ++requestCount);
      }
      stage = nextStage;
      record(event, {
        requestId: requestIds.get(request),
        ...(event === "headers" ? { statusCode: response.statusCode } : {}),
        ...(event === "request-error"
          ? {
              errorCode:
                typeof error?.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code)
                  ? error.code
                  : "UNKNOWN",
            }
          : {}),
      });
    });
}

setInterval(() => record("progress"), 10_000).unref();
process.on("exit", (code) => record("exit", { code }));
