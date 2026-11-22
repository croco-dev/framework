import { Worker } from "node:worker_threads";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { RscFlightEncodeAbortedProblem } from "./isolatedEncode";
import { assertRscPlainData } from "./plainData";
import type { RuntimeContext } from "../render/types";
import type { RscDocumentRender, RscRenderRequest, RscServerActionOptions } from "./buildEntry";
import type {
  RscHostMessage,
  RscRenderMode,
  RscSerializedError,
  RscSerializedRequest,
  RscWorkerData,
  RscWorkerMessage,
  RscWorkerRoute,
} from "./rscBuildProtocol";

/**
 * A render or action threw inside the build's worker. The worker's message
 * stays in the extensions for operators and is never sent to clients.
 */
export class RscBuildWorkerFailedProblem extends Problem {
  readonly code = "meta-vite/rsc-build-worker-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(operation: "render" | "action", target: string, cause: RscSerializedError) {
    super(
      "meta-vite/rsc-build-worker-failed",
      ProblemCategory.InternalServerError,
      `RSC build ${operation} '${target}' failed`,
      {
        extensions: {
          operation,
          target,
          workerMessage: cause.message.slice(0, 500),
          ...(cause.code ? { causeCode: cause.code } : {}),
          ...(cause.name ? { causeName: cause.name } : {}),
        },
      },
    );
  }
}

/** The build's worker exited or was closed, so it cannot render any more. */
export class RscBuildWorkerUnavailableProblem extends Problem {
  readonly code = "meta-vite/rsc-build-worker-unavailable";
  readonly category = ProblemCategory.InternalServerError;

  constructor(reason: string) {
    super(
      "meta-vite/rsc-build-worker-unavailable",
      ProblemCategory.InternalServerError,
      `The RSC build worker is unavailable: ${reason}`,
      { extensions: { reason } },
    );
  }
}

export class RscBuildActionNotFoundProblem extends Problem {
  readonly code = "meta-vite/rsc-build-action-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(name: string) {
    super(
      "meta-vite/rsc-build-action-not-found",
      ProblemCategory.NotFound,
      `The RSC build declares no action named '${name}'`,
      { extensions: { name } },
    );
  }
}

export type RscWorkerReady = Extract<RscWorkerMessage, { type: "ready" }>;
export type RscWorkerFailure = Extract<RscWorkerMessage, { type: "failed" }>;

type PendingRender = {
  readonly kind: "render";
  readonly target: string;
  readonly onStarted: () => void;
  readonly onChunk: (bytes: Uint8Array) => void;
  readonly onEnd: (embeddedFlight: string | undefined) => void;
  readonly onError: (problem: Problem) => void;
};

type PendingAction = {
  readonly kind: "action";
  readonly resolve: (value: unknown) => void;
  readonly reject: (problem: Problem) => void;
  readonly target: string;
};

type OpenedRender = {
  readonly stream: ReadableStream<Uint8Array>;
  readonly started: Promise<void>;
  readonly embeddedFlight: Promise<string | undefined>;
};

export type RscBuildWorkerClient = {
  readonly routes: readonly RscWorkerRoute[];
  readonly clientEntryUrl: string;
  readonly actions: readonly string[];
  readonly renderFlight: (input: RscRenderRequest) => ReadableStream<Uint8Array>;
  readonly renderDocument: (input: RscRenderRequest) => Promise<RscDocumentRender>;
  readonly invokeAction: (
    name: string,
    input: unknown,
    options: RscServerActionOptions,
  ) => Promise<unknown>;
  readonly close: () => Promise<void>;
};

const READY_TIMEOUT_MS = 30_000;

/**
 * Starts the worker for one build and waits until it loaded both entries.
 * Resolves with the failure the worker reported when an entry is unusable.
 */
export async function startRscBuildWorker(
  workerFile: string,
  data: RscWorkerData,
): Promise<RscBuildWorkerClient | RscWorkerFailure> {
  const worker = new Worker(workerFile, { workerData: data });
  const first = await waitForFirstMessage(worker);
  if (first.type === "failed") {
    await worker.terminate();
    return first;
  }
  // A server keeps the process alive on its own; the worker must not keep a
  // finished script running.
  worker.unref();
  return createClient(worker, first);
}

function waitForFirstMessage(worker: Worker): Promise<RscWorkerReady | RscWorkerFailure> {
  return new Promise((resolve) => {
    const settle = (message: RscWorkerReady | RscWorkerFailure): void => {
      clearTimeout(timer);
      worker.off("message", onMessage);
      worker.off("error", onError);
      worker.off("exit", onExit);
      resolve(message);
    };
    const onMessage = (message: RscWorkerMessage): void => {
      if (message.type === "ready" || message.type === "failed") {
        settle(message);
      }
    };
    const onError = (error: Error): void =>
      settle({
        type: "failed",
        artifact: "worker",
        reason: `the build worker failed: ${error.message}`,
      });
    const onExit = (code: number): void =>
      settle({
        type: "failed",
        artifact: "worker",
        reason: `the build worker exited with code ${code}`,
      });
    const timer = setTimeout(() => {
      void worker.terminate();
      settle({
        type: "failed",
        artifact: "worker",
        reason: `the build did not finish loading within ${READY_TIMEOUT_MS}ms`,
      });
    }, READY_TIMEOUT_MS);
    worker.on("message", onMessage);
    worker.on("error", onError);
    worker.on("exit", onExit);
  });
}

function createClient(worker: Worker, ready: RscWorkerReady): RscBuildWorkerClient {
  const pending = new Map<number, PendingRender | PendingAction>();
  let nextId = 1;
  let unavailable: RscBuildWorkerUnavailableProblem | undefined;

  const failAll = (problem: RscBuildWorkerUnavailableProblem): void => {
    unavailable ??= problem;
    for (const entry of pending.values()) {
      if (entry.kind === "render") {
        entry.onError(problem);
      } else {
        entry.reject(problem);
      }
    }
    pending.clear();
  };

  worker.on("message", (message: RscWorkerMessage) => dispatch(pending, message));
  worker.on("error", (error: Error) =>
    failAll(new RscBuildWorkerUnavailableProblem(`the worker failed: ${error.message}`)),
  );
  worker.on("exit", (code: number) =>
    failAll(new RscBuildWorkerUnavailableProblem(`the worker exited with code ${code}`)),
  );

  const send = (message: RscHostMessage): void => {
    worker.postMessage(message);
  };
  const assertAvailable = (): void => {
    if (unavailable) {
      throw unavailable;
    }
  };

  const openRender = (mode: RscRenderMode, input: RscRenderRequest): OpenedRender => {
    assertAvailable();
    assertContext(input.context);
    const id = nextId++;
    let started!: { resolve: () => void; reject: (problem: Problem) => void };
    let ended!: {
      resolve: (flight: string | undefined) => void;
      reject: (problem: Problem) => void;
    };
    const startedPromise = new Promise<void>((resolve, reject) => {
      started = { resolve, reject };
    });
    const embeddedFlight = new Promise<string | undefined>((resolve, reject) => {
      ended = { resolve, reject };
    });
    // Rejections are delivered through the stream; these copies are optional.
    startedPromise.catch(() => undefined);
    embeddedFlight.catch(() => undefined);

    let wakePull: (() => void) | undefined;
    const wake = (): void => {
      wakePull?.();
      wakePull = undefined;
    };
    // The worker stops answering a cancelled render, so the host side settles
    // here; otherwise a caller awaiting the shell or the next row would wait forever.
    const onAbort = (): void => {
      const entry = pending.get(id);
      pending.delete(id);
      send({ type: "cancel", id, reason: "aborted" });
      if (entry?.kind === "render") {
        entry.onError(new RscFlightEncodeAbortedProblem(input.route));
      }
    };

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        pending.set(id, {
          kind: "render",
          target: input.route,
          onStarted: () => started.resolve(),
          onChunk: (bytes) => {
            controller.enqueue(bytes);
            wake();
          },
          onEnd: (flight) => {
            input.signal.removeEventListener("abort", onAbort);
            controller.close();
            ended.resolve(flight);
            wake();
          },
          onError: (problem) => {
            input.signal.removeEventListener("abort", onAbort);
            controller.error(problem);
            started.reject(problem);
            ended.reject(problem);
            wake();
          },
        });
        input.signal.addEventListener("abort", onAbort, { once: true });
        send({
          type: "render",
          id,
          mode,
          route: input.route,
          request: serializeRequest(input.request),
          ...(input.context ? { context: input.context } : {}),
        });
      },
      // One chunk per pull keeps the consumer's backpressure in force across
      // the thread boundary.
      pull() {
        return new Promise<void>((resolve) => {
          wakePull = resolve;
          send({ type: "pull", id });
        });
      },
      cancel(reason) {
        input.signal.removeEventListener("abort", onAbort);
        pending.delete(id);
        send({ type: "cancel", id, reason: String(reason ?? "cancelled") });
      },
    });

    return { stream, started: startedPromise, embeddedFlight };
  };

  return {
    routes: ready.routes,
    clientEntryUrl: ready.clientEntryUrl,
    actions: ready.actions,
    renderFlight: (input) => openRender("flight", input).stream,
    renderDocument: async (input) => {
      const render = openRender("document", input);
      await render.started;
      return {
        html: render.stream,
        embeddedFlight: async () => (await render.embeddedFlight) ?? "",
      };
    },
    invokeAction: async (name, input, options) => {
      assertAvailable();
      if (!ready.actions.includes(name)) {
        throw new RscBuildActionNotFoundProblem(name);
      }
      assertRscPlainData(input, "input");
      assertContext(options.context);
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { kind: "action", resolve, reject, target: name });
        send({
          type: "action",
          id,
          name,
          input,
          request: serializeRequest(options.request),
          ...(options.context ? { context: options.context } : {}),
        });
      });
    },
    close: async () => {
      failAll(new RscBuildWorkerUnavailableProblem("the build was closed"));
      await worker.terminate();
    },
  };
}

function dispatch(
  pending: Map<number, PendingRender | PendingAction>,
  message: RscWorkerMessage,
): void {
  if (message.type === "ready" || message.type === "failed") {
    return;
  }
  const entry = pending.get(message.id);
  if (!entry) {
    return;
  }

  if (entry.kind === "action") {
    pending.delete(message.id);
    if (message.type === "action-result") {
      entry.resolve(message.value);
    } else if (message.type === "error") {
      entry.reject(new RscBuildWorkerFailedProblem("action", entry.target, message.error));
    }
    return;
  }

  switch (message.type) {
    case "started":
      entry.onStarted();
      return;
    case "chunk":
      entry.onChunk(message.bytes);
      return;
    case "end":
      pending.delete(message.id);
      entry.onEnd(message.embeddedFlight);
      return;
    case "error":
      pending.delete(message.id);
      entry.onError(new RscBuildWorkerFailedProblem("render", entry.target, message.error));
      return;
    case "action-result":
      return;
  }
}

function assertContext(context: RuntimeContext | undefined): void {
  if (context !== undefined) {
    assertRscPlainData(context, "context");
  }
}

function serializeRequest(request: Request): RscSerializedRequest {
  return { url: request.url, method: request.method, headers: [...request.headers] };
}
