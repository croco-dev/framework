import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { defineCommand } from "citty";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { DataGenerationProblem, generateDataArtifacts } from "@croco/warehouse-tooling";
import type { CompiledDataConfig } from "@croco/warehouse-tooling";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";

const DATA_COMMAND_INVALID_ARGUMENTS = "DATA_COMMAND_INVALID_ARGUMENTS";
const DATA_CONFIG_WORKER_FAILED = "DATA_CONFIG_WORKER_FAILED";
const CONFIG_REASON = /^(?:[a-z-]{1,80}|WAREHOUSE_[A-Z_]{1,70}|etl-core\/[a-z-]{1,70})$/;
class DataCommandProblem extends Problem {
  constructor(
    code: string,
    readonly reason?: string,
    readonly location?: { file: string; line: number; column: number },
  ) {
    super(code, ProblemCategory.BadRequest, code);
  }
}

function invalidDataArgumentsProblem(): DataCommandProblem {
  return new DataCommandProblem(DATA_COMMAND_INVALID_ARGUMENTS);
}
function dataConfigWorkerFailedProblem(): DataCommandProblem {
  return new DataCommandProblem(DATA_CONFIG_WORKER_FAILED);
}

// Config is trusted repository code. These guards prevent accidental online work,
// not deliberate attempts by hostile JavaScript to escape a sandbox.
const OFFLINE_WORKER = `
import { syncBuiltinESMExports } from 'node:module';
import { writeSync } from 'node:fs';
const validReason = ${CONFIG_REASON};
const deny = () => { throw Object.assign(new Error('Offline config cannot use the network'), { code: 'DATA_CONFIG_NETWORK_DENIED' }); };
for (const [name, methods] of Object.entries({
  net: ['connect', 'createConnection', 'createServer'],
  tls: ['connect', 'createServer'], http: ['request', 'get', 'createServer'],
  https: ['request', 'get', 'createServer'], http2: ['connect', 'createServer', 'createSecureServer'],
  dgram: ['createSocket'], dns: ['lookup', 'resolve', 'resolve4', 'resolve6', 'reverse'],
})) {
  const module = (await import('node:' + name)).default;
  for (const method of methods) module[method] = deny;
  if (name === 'net') module.Socket.prototype.connect = deny;
  if (name === 'dns') {
    for (const key of Object.keys(module.promises)) if (typeof module.promises[key] === 'function') module.promises[key] = deny;
  }
}
globalThis.fetch = deny;
globalThis.WebSocket = deny;
syncBuiltinESMExports();
try {
  const { compileDataConfig } = await import(process.argv[1]);
  const module = await import(process.argv[2]);
  const compiled = await compileDataConfig(module.default, { rootDir: process.cwd(), ...(process.argv[3] ? { environment: process.argv[3] } : {}) });
  writeSync(3, JSON.stringify({ ok: true, compiled }));
} catch (error) {
  const allowed = ['DATA_CONFIG_NETWORK_DENIED', 'ERR_ACCESS_DENIED'];
  const code = allowed.includes(error?.code) ? error.code : 'DATA_CONFIG_INVALID';
  const reason = error?.code === "warehouse-tooling/invalid-config" && typeof error.reason === "string" && validReason.test(error.reason) ? error.reason : undefined;
  const candidate = error?.location;
  const location = candidate && typeof candidate.file === "string" && /^[a-zA-Z0-9_./-]+$/.test(candidate.file) && !candidate.file.startsWith("/") && !candidate.file.split("/").includes("..") && Number.isInteger(candidate.line) && candidate.line > 0 && Number.isInteger(candidate.column) && candidate.column > 0 ? { file: candidate.file, line: candidate.line, column: candidate.column } : undefined;
  writeSync(3, JSON.stringify({ ok: false, code, reason, location }));
  process.exitCode = 1;
}
`;

export function compileOfflineConfig(
  configPath: string,
  cwd: string,
  environment?: string,
): Promise<CompiledDataConfig> {
  return new Promise((accept, reject) => {
    const toolingUrl = import.meta.resolve("@croco/warehouse-tooling/offline");
    let dependencyRoot = dirname(fileURLToPath(toolingUrl));
    while (
      basename(dependencyRoot) !== "node_modules" &&
      !existsSync(resolve(dependencyRoot, "pnpm-workspace.yaml"))
    ) {
      const parent = dirname(dependencyRoot);
      if (parent === dependencyRoot) throw new DataCommandProblem("DATA_CONFIG_RUNTIME_LOCATION");
      dependencyRoot = parent;
    }
    const child = spawn(
      process.execPath,
      [
        "--permission",
        `--allow-fs-read=${realpathSync(cwd)}`,
        `--allow-fs-read=${realpathSync(dependencyRoot)}`,
        "--experimental-strip-types",
        "--input-type=module",
        "--eval",
        OFFLINE_WORKER,
        toolingUrl,
        pathToFileURL(realpathSync(configPath)).href,
        environment ?? "",
      ],
      { cwd: realpathSync(cwd), env: {}, stdio: ["ignore", "ignore", "ignore", "pipe"] },
    );
    let output = "";
    let failure: string | undefined;
    const timeout = setTimeout(() => {
      failure = "DATA_CONFIG_TIMEOUT";
      child.kill("SIGKILL");
    }, 10_000);
    const stream = child.stdio[3];
    if (stream && "on" in stream)
      stream.on("data", (chunk: Buffer) => {
        if (Buffer.byteLength(output) + chunk.length > 4 * 1024 * 1024) {
          failure = "DATA_CONFIG_OUTPUT_LIMIT";
          child.kill("SIGKILL");
        } else output += chunk.toString("utf8");
      });
    child.on("error", () => {
      clearTimeout(timeout);
      reject(dataConfigWorkerFailedProblem());
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (failure) {
        reject(new DataCommandProblem(failure));
        return;
      }
      try {
        const report = JSON.parse(output) as {
          ok: boolean;
          compiled?: CompiledDataConfig;
          code?: string;
          reason?: string;
          location?: { file: string; line: number; column: number };
        };
        if (code === 0 && report.ok && report.compiled) accept(report.compiled);
        else
          reject(
            new DataCommandProblem(
              report.code === "DATA_CONFIG_NETWORK_DENIED" || report.code === "ERR_ACCESS_DENIED"
                ? report.code
                : "DATA_CONFIG_INVALID",
              typeof report.reason === "string" && CONFIG_REASON.test(report.reason)
                ? report.reason
                : undefined,
              report.location,
            ),
          );
      } catch {
        reject(dataConfigWorkerFailedProblem());
      }
    });
  });
}

function createDataAction(action: "validate" | "generate") {
  return defineCommand({
    meta: { name: action, description: `${action} offline data declarations` },
    args: {
      config: {
        type: "string",
        required: true,
        description: "Trusted TS/JS module exporting a default data config",
      },
      cwd: { type: "string", description: "Repository working directory" },
      environment: { type: "string", description: "Declared environment overlay" },
      ...(action === "generate"
        ? {
            output: {
              type: "string" as const,
              required: true,
              description: "Generated artifact directory",
            },
            "migration-id": {
              type: "string" as const,
              required: true,
              description: "Reviewed migration artifact ID",
            },
          }
        : {}),
    },
    async run({ args, rawArgs }) {
      const runtime = getCrocoCommandRuntime();
      const allowed = new Set([
        "--config",
        "--cwd",
        "--environment",
        ...(action === "generate" ? ["--output", "--migration-id"] : []),
      ]);
      try {
        for (let index = 0; index < rawArgs.length; index++) {
          const token = rawArgs[index] ?? "";
          const [flag, inline] = token.split(/=([\s\S]*)/);
          const value = inline ?? rawArgs[++index];
          if (!allowed.has(flag ?? "") || !value?.trim() || value.startsWith("--"))
            throw invalidDataArgumentsProblem();
        }
        const cwd = typeof args.cwd === "string" ? resolve(runtime.cwd, args.cwd) : runtime.cwd;
        const compiled = await compileOfflineConfig(
          resolve(cwd, args.config),
          cwd,
          args.environment,
        );
        let manifest = compiled.manifest;
        if (action === "generate") {
          manifest = await generateDataArtifacts(resolve(cwd, String(args["output"])), compiled, {
            migrationId: String(args["migration-id"]),
          });
        }
        runtime.stdout(
          JSON.stringify({
            status: action === "generate" ? "generated" : "valid",
            manifest,
          }),
        );
      } catch (error) {
        if (error instanceof DataGenerationProblem && error.committedManifest !== undefined) {
          runtime.stderr(
            JSON.stringify({
              status: "committed-cleanup-failed",
              reason: error.reason,
              manifest: error.committedManifest,
            }),
          );
          runtime.setExitCode(1);
          return;
        }
        if (error instanceof DataGenerationProblem && /^[a-z-]{1,80}$/.test(error.reason)) {
          const file =
            typeof error.file === "string" &&
            /^[a-zA-Z0-9_./-]+$/.test(error.file) &&
            !error.file.startsWith("/") &&
            error.file.split("/").every((part) => part !== "" && part !== "." && part !== "..")
              ? error.file
              : undefined;
          runtime.stderr(
            JSON.stringify({
              code: "DATA_GENERATION_FAILED",
              reason: error.reason,
              ...(file ? { file } : {}),
            }),
          );
          runtime.setExitCode(1);
          return;
        }
        const message =
          error instanceof Error && /^DATA_[A-Z_]+$|^ERR_ACCESS_DENIED$/.test(error.message)
            ? error.message
            : "DATA_COMMAND_FAILED";
        runtime.stderr(
          error instanceof DataCommandProblem && (error.reason || error.location)
            ? JSON.stringify({
                code: message,
                reason: error.reason,
                ...(error.location ? { location: error.location } : {}),
              })
            : message,
        );
        runtime.setExitCode(1);
      }
    },
  });
}

export const data = defineCommand({
  meta: { name: "data", description: "Validate and generate offline data artifacts" },
  setup({ rawArgs }) {
    if (rawArgs[0]?.startsWith("-")) throw invalidDataArgumentsProblem();
  },
  subCommands: { validate: createDataAction("validate"), generate: createDataAction("generate") },
});
