import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { RenderRouteIR } from "../routes/types";
import type { RuntimeContext } from "../render/types";

export class RscFlightEncodeFailedProblem extends Problem {
  readonly code = "meta-vite/rsc-flight-encode-failed";
  readonly category = ProblemCategory.InternalServerError;

  /**
   * `exitCode` is null when the encoder never ran — the entry point is not
   * installed, which is a packaging failure rather than a render failure, so it
   * must stay distinguishable from a child that exited with a real code.
   */
  constructor(route: string, exitCode: number | null, detail: string) {
    super(
      "meta-vite/rsc-flight-encode-failed",
      ProblemCategory.InternalServerError,
      `RSC Flight encoder failed for route '${route}'${
        exitCode === null ? "" : ` (exit ${exitCode})`
      }`,
      // `detail` is a reserved Problem field and would be rejected here, so the
      // captured encoder output travels under `encoderOutput`.
      { extensions: { route, exitCode, encoderOutput: detail.slice(0, 500) } },
    );
  }
}

/**
 * The isolated encoder renders in a child process over a JSON pipe, while a
 * `RuntimeContext` carries live host values (`env` records, a Cloudflare
 * `executionContext`, a Lambda context) that cannot cross that boundary.
 * Silently dropping them would hand a server component an `undefined` host
 * value — a wrong answer that renders fine — so the render is refused instead.
 */
export class RscFlightContextUnsupportedProblem extends Problem {
  readonly code = "meta-vite/rsc-flight-context-unsupported";
  readonly category = ProblemCategory.InternalServerError;

  constructor(route: string, platform: string) {
    super(
      "meta-vite/rsc-flight-context-unsupported",
      ProblemCategory.InternalServerError,
      `RSC route '${route}' cannot render with a runtime context: the isolated Flight encoder runs in a child process and cannot carry platform '${platform}' values`,
      { extensions: { route, platform } },
    );
  }
}

export class RscFlightEncodeTimeoutProblem extends Problem {
  readonly code = "meta-vite/rsc-flight-encode-timeout";
  readonly category = ProblemCategory.InternalServerError;

  constructor(route: string, timeoutMs: number) {
    super(
      "meta-vite/rsc-flight-encode-timeout",
      ProblemCategory.InternalServerError,
      `RSC Flight encoder timed out for route '${route}' after ${timeoutMs}ms`,
      { extensions: { route, timeoutMs } },
    );
  }
}

/**
 * The caller disconnected before the isolated encoder finished, so the child
 * process is killed and the pending render is abandoned instead of running to
 * the timeout. No response can be delivered any more.
 */
export class RscFlightEncodeAbortedProblem extends Problem {
  readonly code = "meta-vite/rsc-flight-encode-aborted";
  readonly category = ProblemCategory.BadRequest;

  constructor(route: string) {
    super(
      "meta-vite/rsc-flight-encode-aborted",
      ProblemCategory.BadRequest,
      `RSC Flight encoding for route '${route}' was aborted because the client disconnected`,
      { extensions: { route } },
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
  /**
   * Overrides the resolved encoder module path. Only used by tests to run a
   * stubbed encoder without building the package first.
   */
  readonly encoderModule?: string;
};

/**
 * Runs the official Flight encoder in an isolated `react-server` child and
 * relays its stdout as it is produced: a Flight render keeps its stream open
 * until every Suspense boundary resolves, so waiting for the child to exit
 * before answering would hold back the shell and defeat streaming. The child is
 * torn down on abort, timeout, output overrun, or a consumer cancel, and those
 * failures are raised on the returned stream instead of being swallowed.
 */
export async function encodeRscFlightInIsolatedEncoder(
  input: IsolatedRscEncodeInput,
): Promise<ReadableStream<Uint8Array>> {
  // The child renders over a JSON pipe, so a runtime context cannot travel
  // with the request. Refuse before spawning: a component reading a host value
  // would otherwise render `undefined` and look successful.
  if (input.context) {
    throw new RscFlightContextUnsupportedProblem(input.route.path, input.context.platform);
  }

  const encoderModule = input.encoderModule ?? resolveEncoderModule();
  const requestSignal = input.request.signal;

  // A caller that already disconnected never receives a response, so refuse
  // before spawn instead of paying for a child process nobody reads.
  if (requestSignal.aborted) {
    throw new RscFlightEncodeAbortedProblem(input.route.path);
  }

  // Once the stream is returned, a spawn failure can only reach the caller as a
  // broken body on an already-committed 200. Refuse the request that cannot be
  // answered while the Failure can still be turned into a response status.
  if (!existsSync(encoderModule)) {
    throw new RscFlightEncodeFailedProblem(
      input.route.path,
      null,
      `encoder entry not found at '${encoderModule}'`,
    );
  }

  // Server components read the request they were rendered for, so forward the
  // fields a document/Flight request carries and let the child rebuild it.
  // Guessing them from `route.path` alone would hand components the wrong URL,
  // query, and cookies.
  const payload = JSON.stringify({
    routePath: input.route.path,
    componentRef: input.route.componentRef,
    request: {
      url: input.request.url,
      method: input.request.method,
      headers: Object.fromEntries(input.request.headers),
    },
  });

  let child: ChildProcess | undefined;
  let settled = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = spawn(process.execPath, ["--conditions=react-server", encoderModule], {
        env: {
          ...process.env,
          ["CROCO_RSC_COMPONENT_PATH"]: input.route.componentRef ?? "",
          ["NODE_ENV"]: process.env["NODE_ENV"] ?? "production",
        },
        stdio: ["pipe", "pipe", "pipe"],
      });
      child = encoder;

      const stderr: Uint8Array[] = [];
      let stdoutBytes = 0;
      let outputLimitError: Error | undefined;

      const timer = setTimeout(() => {
        // Reject with a typed Problem so operators can distinguish an encoder
        // stall from a render failure: both surface as 500, but the timeout
        // code (`rsc-flight-encode-timeout`) carries the route and budget.
        fail(new RscFlightEncodeTimeoutProblem(input.route.path, ENCODE_TIMEOUT_MS));
      }, ENCODE_TIMEOUT_MS);

      // The encoder is a per-request child process. Without forwarding the
      // caller's abort it keeps rendering (and holding memory) for up to the
      // full timeout after the client has already gone away.
      const onAbort = (): void => {
        fail(new RscFlightEncodeAbortedProblem(input.route.path));
      };
      requestSignal.addEventListener("abort", onAbort, { once: true });

      function fail(error: Error): void {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        requestSignal.removeEventListener("abort", onAbort);
        encoder.kill("SIGKILL");
        // desiredSize is null exactly when the stream is already closed,
        // errored, or cancelled, and error() would throw in that state.
        if (controller.desiredSize !== null) {
          controller.error(error);
        }
      }

      // The child can exit before it reads the payload; an `error` event on the
      // stdin pipe without a listener would take the host process down.
      encoder.stdin.on("error", (error: Error) => {
        fail(error instanceof Error ? error : new Error(String(error)));
      });
      encoder.stdin.write(payload);
      encoder.stdin.end();

      encoder.stdout.on("data", (chunk: Uint8Array) => {
        stdoutBytes += chunk.byteLength;
        if (stdoutBytes > ENCODE_MAX_OUTPUT_BYTES) {
          outputLimitError ??= new Error(
            `RSC Flight encoder output exceeded ${ENCODE_MAX_OUTPUT_BYTES} bytes for route '${input.route.path}'`,
          );
          fail(outputLimitError);
          return;
        }

        if (controller.desiredSize === null) {
          // The consumer cancelled the stream, so stop producing bytes nobody
          // reads instead of failing on a terminal controller.
          encoder.kill("SIGKILL");
          return;
        }
        controller.enqueue(chunk);
      });
      encoder.stderr.on("data", (chunk: Uint8Array) => {
        if (stderrBytes(stderr) < ENCODE_MAX_OUTPUT_BYTES) {
          stderr.push(chunk);
        }
      });
      encoder.on("error", (error) => {
        fail(error instanceof Error ? error : new Error(String(error)));
      });
      encoder.on("close", (code) => {
        clearTimeout(timer);
        requestSignal.removeEventListener("abort", onAbort);
        if (settled) {
          return;
        }
        settled = true;

        if (outputLimitError) {
          if (controller.desiredSize !== null) {
            controller.error(outputLimitError);
          }
          return;
        }

        if (code !== 0) {
          const detail = Buffer.concat(stderr).toString("utf8").slice(0, 500);
          // A killed child reports no exit code; 1 keeps it distinct from the
          // `null` that marks an encoder which never started.
          const failure = new RscFlightEncodeFailedProblem(input.route.path, code ?? 1, detail);
          if (controller.desiredSize !== null) {
            controller.error(failure);
          }
          return;
        }

        controller.close();
      });
    },
    cancel() {
      settled = true;
      child?.kill("SIGKILL");
    },
  });
}
