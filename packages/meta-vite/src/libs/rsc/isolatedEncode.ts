import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { RenderRouteIR } from "../routes/types";
import type { RuntimeContext } from "../render/types";

export class RscFlightEncodeFailedProblem extends Problem {
  readonly code = "meta-vite/rsc-flight-encode-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(route: string, exitCode: number, detail: string) {
    super(
      "meta-vite/rsc-flight-encode-failed",
      ProblemCategory.InternalServerError,
      `RSC Flight encoder failed for route '${route}' (exit ${exitCode})`,
      { extensions: { route, exitCode, detail: detail.slice(0, 500) } },
    );
  }
}

const ENCODE_TIMEOUT_MS = 30_000;

// Unbounded stdout/stderr buffering lets a large Flight payload pin memory per
// request. Fail the encode explicitly past this cap instead of growing the
// host buffer; concurrency/pooling stays out of scope for this change.
const ENCODE_MAX_OUTPUT_BYTES = 8 * 1024 * 1024;

function stderrBytes(stderr: readonly Uint8Array[]): number {
  let total = 0;
  for (const chunk of stderr) {
    total += chunk.byteLength;
  }
  return total;
}

function resolveEncoderModule(): string {
  // NOTE: this module must not use `import.meta.url`. tsup bundles it into an
  // empty shim object (`var It={}`), so `fileURLToPath(import.meta.url)`
  // throws at runtime in the published `dist/index.mjs` and hangs consumers.
  // Resolve the encoder entry through Node resolution anchored at the current
  // working directory instead: both a packed consumer root and the monorepo
  // root resolve `@croco/meta-vite` via `node_modules`.
  const anchor = createRequire(join(process.cwd(), "package.json"));
  const specifiers = [
    "@croco/meta-vite/rsc/encoder",
    "@croco/meta-vite/dist/libs/rsc/flightEncode.entry.js",
  ];
  for (const specifier of specifiers) {
    try {
      return anchor.resolve(specifier);
    } catch {
      continue; // try next specifier; resolution failure is the expected miss signal
    }
  }
  // Last resort: locate the package root and append the dist path. This
  // covers pnpm-symlinked monorepo installs where subpath exports are only
  // declared under `publishConfig`.
  try {
    const packageJson = anchor.resolve("@croco/meta-vite/package.json");
    return join(
      packageJson.replace(/package\.json$/, ""),
      "dist",
      "libs",
      "rsc",
      "flightEncode.entry.js",
    );
  } catch {
    // Fall through to the cwd-anchored heuristic below; both resolution
    // attempts failing means the encoder entry is not resolvable, and the
    // caller surfaces that as an explicit encode failure downstream.
    return join(
      process.cwd(),
      "node_modules",
      "@croco",
      "meta-vite",
      "dist",
      "libs",
      "rsc",
      "flightEncode.entry.js",
    );
  }
}

export type IsolatedRscEncodeInput = {
  readonly route: RenderRouteIR;
  readonly request: Request;
  readonly context?: RuntimeContext;
};

export async function encodeRscFlightInIsolatedEncoder(
  input: IsolatedRscEncodeInput,
): Promise<ReadableStream<Uint8Array>> {
  const encoderModule = resolveEncoderModule();
  const payload = JSON.stringify({
    routePath: input.route.path,
    componentRef: input.route.componentRef,
  });
  const child = spawn(process.execPath, ["--conditions=react-server", encoderModule], {
    env: {
      ...process.env,
      ["CROCO_RSC_COMPONENT_PATH"]: input.route.componentRef ?? "",
      ["NODE_ENV"]: process.env["NODE_ENV"] ?? "production",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdin.write(payload);
  child.stdin.end();

  const chunks: Uint8Array[] = [];
  const stderr: Uint8Array[] = [];
  let stdoutBytes = 0;
  let outputLimitError: Error | undefined;
  const exit = new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`RSC Flight encoder timed out for route '${input.route.path}'`));
    }, ENCODE_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Uint8Array) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes > ENCODE_MAX_OUTPUT_BYTES) {
        outputLimitError ??= new Error(
          `RSC Flight encoder output exceeded ${ENCODE_MAX_OUTPUT_BYTES} bytes for route '${input.route.path}'`,
        );
        child.kill("SIGKILL");
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Uint8Array) => {
      if (stderrBytes(stderr) < ENCODE_MAX_OUTPUT_BYTES) {
        stderr.push(chunk);
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (outputLimitError) {
        reject(outputLimitError);
        return;
      }
      resolve(code ?? 1);
    });
  });

  const code = await exit;
  if (code !== 0) {
    const detail = Buffer.concat(stderr).toString("utf8").slice(0, 500);

    throw new RscFlightEncodeFailedProblem(input.route.path, code, detail);
  }

  const bytes = Buffer.concat(chunks);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}
