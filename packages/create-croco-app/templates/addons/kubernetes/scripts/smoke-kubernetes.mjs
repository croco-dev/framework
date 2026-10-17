import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { startKubernetesApplication } = require("../apps/api-server/dist/kubernetes.js");

let releaseRequest;
let markEntered;
const blocked = new Promise((resolve) => {
  releaseRequest = resolve;
});
const entered = new Promise((resolve) => {
  markEntered = resolve;
});
const running = await startKubernetesApplication(
  { port: 0, hostname: "127.0.0.1" },
  {
    extraMiddlewares: [
      async (ctx, next) => {
        if (ctx.req.path === "/users") {
          markEntered();
          await blocked;
        }
        await next();
      },
    ],
  },
);
const address = running.host.server.address();
assert.ok(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}`;
let closing;
try {
  assert.equal((await fetch(`${base}/health/ready`)).status, 200);
  assert.equal((await fetch(`${base}/health/live`)).status, 200);
  const pendingRequest = fetch(`${base}/users`, { signal: AbortSignal.timeout(15000) });
  await entered;
  closing = running.close();
  assert.strictEqual(running.close(), closing);
  assert.equal((await fetch(`${base}/health/ready`)).status, 503);
  assert.equal((await fetch(`${base}/health/live`)).status, 200);
  assert.equal((await fetch(`${base}/users`, { method: "POST", body: "{}" })).status, 503);
  releaseRequest();
  assert.equal((await pendingRequest).status, 200);
  await closing;
  assert.equal(running.host.server, null);
  await assert.rejects(fetch(`${base}/health/ready`, { signal: AbortSignal.timeout(1000) }));
  console.log(
    "Node Host: ready 200 -> draining 503; in-flight request completed; shared close released listener. Live cluster: not verified.",
  );
} finally {
  releaseRequest();
  await (closing ?? running.close());
}

// Exercise the compiled process entrypoint and its real SIGTERM handler as well.
const { fork } = await import("node:child_process");
const { setTimeout: delay } = await import("node:timers/promises");
const child = fork(new URL("../apps/api-server/dist/kubernetes.js", import.meta.url), [], {
  silent: true,
  env: { ...process.env, PORT: String(address.port), TELEMETRY_ENABLED: "false", NODE_ENV: "test" },
});
let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += String(chunk);
});
const exited = new Promise((resolve) => {
  child.once("exit", (code, signal) => resolve({ code, signal }));
});
try {
  const deadline = Date.now() + 15000;
  let ready = false;
  while (!ready && Date.now() < deadline && child.exitCode === null) {
    try {
      ready =
        (await fetch(`${base}/health/ready`, { signal: AbortSignal.timeout(1000) })).status === 200;
    } catch {
      /* The child has not bound its listener yet. */
    }
    if (!ready) await delay(20);
  }
  assert.ok(ready, `Compiled entrypoint never became ready: ${stderr}`);
  child.kill("SIGTERM");
  // Readiness becomes unavailable before the five-second propagation window ends.
  let draining = false;
  while (!draining && Date.now() < deadline) {
    draining =
      (await fetch(`${base}/health/ready`, { signal: AbortSignal.timeout(1000) })).status === 503;
    if (!draining) await delay(20);
  }
  assert.ok(draining, "SIGTERM must change readiness to 503");
  const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
  try {
    assert.deepEqual(await exited, { code: 0, signal: null }, stderr);
  } finally {
    clearTimeout(timer);
  }
  console.log("Compiled process SIGTERM: readiness 503, graceful exit code 0.");
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  await exited;
}
