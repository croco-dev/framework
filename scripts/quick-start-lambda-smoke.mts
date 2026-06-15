/**
 * quick-start-lambda-smoke.mts
 *
 * Verifies that the documented quick-start-lambda example installs, builds, and starts locally
 * without cloud credentials.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const packageName = "@croco-example/quick-start-lambda";
const smokeRoot = mkdtempSync(join(tmpdir(), "croco-quick-start-lambda-smoke-"));
const commandTimeoutMs = 600_000;
const startupTimeoutMs = 30_000;
const requestTimeoutMs = 5_000;

type SmokeResponse = {
  readonly status: number;
  readonly body: string;
};

type ProcessOutcome =
  | {
      readonly code: number | null;
      readonly signal: NodeJS.Signals | null;
      readonly status: "exit";
    }
  | {
      readonly error: Error;
      readonly status: "error";
    }
  | {
      readonly status: "timeout";
    };

try {
  copyWorkspace(rootDir, smokeRoot);

  await runPhase("install", "pnpm", [
    "install",
    "--frozen-lockfile",
    "--filter",
    `${packageName}...`,
    "--ignore-scripts",
  ]);
  await runPhase("build", "pnpm", ["--filter", `${packageName}...`, "build"]);
  await runRuntimeSmoke();

  console.log("quick-start-lambda-smoke: all checks passed");
} finally {
  rmSync(smokeRoot, { force: true, recursive: true });
}

function copyWorkspace(sourceDir: string, targetDir: string): void {
  console.log(`quick-start-lambda-smoke: copying workspace to ${targetDir}`);

  cpSync(sourceDir, targetDir, {
    dereference: false,
    filter(source) {
      const relativePath = relative(sourceDir, source);
      if (!relativePath) {
        return true;
      }

      const segments = relativePath.split(sep);
      return !segments.some((segment) =>
        [".git", ".turbo", "ci-reports", "coverage", "dist", "node_modules"].includes(segment),
      );
    },
    recursive: true,
  });
}

async function runPhase(label: string, command: string, args: readonly string[]): Promise<void> {
  console.log(`quick-start-lambda-smoke: ${label} started`);

  const child = spawn(command, [...args], {
    cwd: smokeRoot,
    detached: process.platform !== "win32",
    env: { ...process.env, CI: "true" },
    stdio: "inherit",
  });

  const outcome = await waitForProcess(child, commandTimeoutMs);

  if (outcome.status === "timeout") {
    terminateProcessGroup(child, "SIGKILL");
    throw new Error(
      `quick-start-lambda-smoke: ${label} failed: ${command} ${args.join(" ")} timed out after ${commandTimeoutMs}ms`,
    );
  }

  if (outcome.status === "error") {
    throw new Error(`quick-start-lambda-smoke: ${label} failed: ${outcome.error.message}`);
  }

  if (outcome.code !== 0) {
    throw new Error(
      `quick-start-lambda-smoke: ${label} failed: ${command} ${args.join(" ")} exited ${outcome.code ?? "null"}${outcome.signal ? ` (${outcome.signal})` : ""}`,
    );
  }

  console.log(`quick-start-lambda-smoke: ${label} passed`);
}

async function waitForProcess(child: ChildProcess, timeoutMs: number): Promise<ProcessOutcome> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      new Promise<ProcessOutcome>((resolveProcess) => {
        child.once("error", (error) => resolveProcess({ error, status: "error" }));
        child.once("exit", (code, signal) => resolveProcess({ code, signal, status: "exit" }));
      }),
      new Promise<{ readonly status: "timeout" }>((resolveTimeout) => {
        timeout = setTimeout(() => resolveTimeout({ status: "timeout" }), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function terminateProcessGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) {
    return;
  }

  if (process.platform === "win32") {
    child.kill(signal);
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code !== "ESRCH") {
      throw error;
    }
  }
}

async function runRuntimeSmoke(): Promise<void> {
  const port = await findOpenPort();
  const exampleDir = join(smokeRoot, "examples", "quick-start-lambda");
  const server = spawn("pnpm", ["--dir", exampleDir, "dev"], {
    cwd: smokeRoot,
    detached: process.platform !== "win32",
    env: { ...process.env, CI: "true", NODE_ENV: "development", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const serverOutput: string[] = [];
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;

  server.stdout.on("data", (chunk: Buffer) => {
    const output = chunk.toString();
    serverOutput.push(output);
    writeLiveServerOutput(output, process.stdout);
  });
  server.stderr.on("data", (chunk: Buffer) => {
    const output = chunk.toString();
    serverOutput.push(output);
  });
  server.on("exit", (code, signal) => {
    exitCode = code;
    exitSignal = signal;
  });

  try {
    await waitForHealthyServer(port, () => describeServerExit(exitCode, exitSignal, serverOutput));
    await assertEndpoint("health", port, "/api/health", {
      expectedStatus: 200,
      expectedText: '"status":"ok"',
    });
    await assertEndpoint("unauthorized users", port, "/api/users", { expectedStatus: 401 });
    await assertEndpoint("authorized users", port, "/api/users", {
      expectedStatus: 200,
      expectedText: "Alice",
      headers: { "x-api-key": "test-key" },
    });
    await assertEndpoint("create user", port, "/api/users", {
      body: JSON.stringify({ name: "Carol", email: "carol@example.com" }),
      expectedStatus: 200,
      expectedText: "Carol",
      headers: { "content-type": "application/json", "x-api-key": "test-key" },
      method: "POST",
    });
  } finally {
    await stopServer(server);
  }
}

function writeLiveServerOutput(output: string, stream: NodeJS.WriteStream): void {
  const visibleOutput = output
    .split(/\r?\n/)
    .filter(
      (line) => !line.includes("ELIFECYCLE") && !line.includes("Command failed with exit code 143"),
    )
    .join("\n");

  if (visibleOutput) {
    stream.write(visibleOutput);
  }
}

async function findOpenPort(): Promise<number> {
  const { createServer } = await import("node:net");

  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        server.close();
        reject(new Error("quick-start-lambda-smoke: failed to allocate a TCP port"));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolvePort(port);
      });
    });
  });
}

async function waitForHealthyServer(
  port: number,
  describeExit: () => string | undefined,
): Promise<void> {
  const startedAt = Date.now();
  let lastError: string | undefined;

  while (Date.now() - startedAt < startupTimeoutMs) {
    const exitDescription = describeExit();
    if (exitDescription) {
      throw new Error(`quick-start-lambda-smoke: startup failed: ${exitDescription}`);
    }

    try {
      const response = await request(port, "/api/health");
      if (response.status === 200 && response.body.includes('"status":"ok"')) {
        console.log("quick-start-lambda-smoke: startup passed");
        return;
      }

      lastError = `health returned ${response.status}: ${response.body}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await delay(500);
  }

  throw new Error(`quick-start-lambda-smoke: startup timed out: ${lastError ?? "no response"}`);
}

async function assertEndpoint(
  label: string,
  port: number,
  path: string,
  options: {
    readonly body?: string;
    readonly expectedStatus: number;
    readonly expectedText?: string;
    readonly headers?: Record<string, string>;
    readonly method?: string;
  },
): Promise<void> {
  const response = await request(port, path, {
    body: options.body,
    headers: options.headers,
    method: options.method,
  });

  if (response.status !== options.expectedStatus) {
    throw new Error(
      `quick-start-lambda-smoke: ${label} failed: expected status ${options.expectedStatus}, got ${response.status} with ${response.body}`,
    );
  }

  if (options.expectedText && !response.body.includes(options.expectedText)) {
    throw new Error(
      `quick-start-lambda-smoke: ${label} failed: expected response to contain ${options.expectedText}, got ${response.body}`,
    );
  }

  console.log(`quick-start-lambda-smoke: ${label} passed`);
}

async function request(
  port: number,
  path: string,
  init: {
    readonly body?: string;
    readonly headers?: Record<string, string>;
    readonly method?: string;
  } = {},
): Promise<SmokeResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      body: init.body,
      headers: init.headers,
      method: init.method ?? "GET",
      signal: controller.signal,
    });

    return {
      body: await response.text(),
      status: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function describeServerExit(
  exitCode: number | null,
  exitSignal: NodeJS.Signals | null,
  output: readonly string[],
): string | undefined {
  if (exitCode === null && exitSignal === null) {
    return undefined;
  }

  return `server exited with code ${exitCode ?? "null"} and signal ${exitSignal ?? "null"}\n${output.join("")}`;
}

async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) {
    return;
  }

  const exitPromise = new Promise<void>((resolveExit) => {
    server.once("exit", () => resolveExit());
  });

  terminateProcessGroup(server, "SIGTERM");

  const exited = await Promise.race([exitPromise.then(() => true), delay(5_000).then(() => false)]);

  if (!exited) {
    terminateProcessGroup(server, "SIGKILL");
    await exitPromise;
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
