import type { ILogger } from "@croco/framework-context";
import {
  GracefulShutdownConfigurationProblem,
  type GracefulShutdownPhase,
  type GracefulShutdownTimeoutOption,
  GracefulShutdownTimeoutProblem,
} from "../problems/GracefulShutdownProblems";
import type { MiddlewareFunction, NodeServerHandle } from "../types";

export type GracefulShutdownOptions = {
  timeoutMs?: number;
  onShutdown?: (signal: AbortSignal) => void | Promise<void>;
  signals?: NodeJS.Signals[];
  logger?: ILogger;
  eventBusDrainTimeoutMs?: number;
  isLambdaEnvironment?: boolean;
};

type ShutdownState = {
  isShuttingDown: boolean;
  activeRequests: Set<string>;
  shutdownPromise: Promise<void> | null;
  signalHandlers: Map<NodeJS.Signals, () => void>;
  signalFailureObserved: boolean;
  nodeServers: Set<NodeServerHandle>;
};

export type GracefulShutdownController = {
  middleware: MiddlewareFunction;
  shutdown: () => Promise<void>;
  getActiveRequestCount: () => number;
  isShuttingDown: () => boolean;
  reset: () => void;
};

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_EVENT_BUS_DRAIN_TIMEOUT_MS = 10000;
const DEFAULT_SIGNALS: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];

const states = new Set<ShutdownState>();
const middlewareStates = new WeakMap<MiddlewareFunction, ShutdownState>();
let legacyState: ShutdownState | null = null;

type NormalizedShutdownTimeouts = {
  readonly timeoutMs: number;
  readonly eventBusDrainTimeoutMs: number;
};

function createMiddlewareState(): ShutdownState {
  const state: ShutdownState = {
    isShuttingDown: false,
    activeRequests: new Set<string>(),
    shutdownPromise: null,
    signalHandlers: new Map(),
    signalFailureObserved: false,
    nodeServers: new Set<NodeServerHandle>(),
  };

  states.add(state);
  return state;
}

function getLegacyState(): ShutdownState {
  if (legacyState === null) {
    legacyState = createMiddlewareState();
  }

  return legacyState;
}

function isRunningInLambda(): boolean {
  return !!(process.env["AWS_LAMBDA_FUNCTION_NAME"] || process.env["AWS_EXECUTION_ENV"]);
}

function noopLogger(): ILogger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    fatal: () => {},
    child: () => noopLogger(),
  };
}

/**
 * shutdown 상태에서 새 요청을 차단하고 활성 요청 완료를 기다리는 미들웨어입니다.
 */
export const gracefulShutdownMiddleware = (
  options: GracefulShutdownOptions = {},
): MiddlewareFunction => {
  const { timeoutMs, eventBusDrainTimeoutMs } = normalizeShutdownTimeouts(options);
  const {
    onShutdown,
    signals = DEFAULT_SIGNALS,
    logger,
    isLambdaEnvironment = isRunningInLambda(),
  } = options;
  const state = getLegacyState();

  if (!isLambdaEnvironment) {
    setupSignalHandlers(state, signals, timeoutMs, onShutdown, logger, eventBusDrainTimeoutMs);
  }

  return createMiddlewareForState(state);
};

/**
 * 하나의 HTTP 앱에 귀속된 graceful shutdown 미들웨어와 제어 함수를 생성합니다.
 */
export function createGracefulShutdownController(
  options: GracefulShutdownOptions = {},
): GracefulShutdownController {
  const { timeoutMs, eventBusDrainTimeoutMs } = normalizeShutdownTimeouts(options);
  const {
    onShutdown,
    signals = DEFAULT_SIGNALS,
    logger,
    isLambdaEnvironment = isRunningInLambda(),
  } = options;
  const state = createMiddlewareState();

  if (!isLambdaEnvironment) {
    setupSignalHandlers(state, signals, timeoutMs, onShutdown, logger, eventBusDrainTimeoutMs);
  }

  return {
    middleware: createMiddlewareForState(state),
    shutdown: () => performShutdown(state, timeoutMs, onShutdown, logger, eventBusDrainTimeoutMs),
    getActiveRequestCount: () => state.activeRequests.size,
    isShuttingDown: () => state.isShuttingDown,
    reset: () => resetState(state),
  };
}

/**
 * 원하는 시점에 graceful shutdown 절차를 실행할 함수를 생성합니다.
 */
export function setupGracefulShutdown(options: GracefulShutdownOptions = {}): () => Promise<void> {
  const { timeoutMs, eventBusDrainTimeoutMs } = normalizeShutdownTimeouts(options);
  const { onShutdown, logger } = options;
  const state = getLegacyState();

  return () => performShutdown(state, timeoutMs, onShutdown, logger, eventBusDrainTimeoutMs);
}

function normalizeShutdownTimeouts(options: GracefulShutdownOptions): NormalizedShutdownTimeouts {
  return {
    timeoutMs: normalizeShutdownTimeout("timeoutMs", options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    eventBusDrainTimeoutMs: normalizeShutdownTimeout(
      "eventBusDrainTimeoutMs",
      options.eventBusDrainTimeoutMs ?? DEFAULT_EVENT_BUS_DRAIN_TIMEOUT_MS,
    ),
  };
}

function normalizeShutdownTimeout(option: GracefulShutdownTimeoutOption, value: number): number {
  if (!Number.isFinite(value)) {
    throw new GracefulShutdownConfigurationProblem({
      option,
      receivedValue: String(value),
    });
  }

  return Math.max(0, value);
}

function createMiddlewareForState(state: ShutdownState): MiddlewareFunction {
  const middleware: MiddlewareFunction = async (ctx, next): Promise<void> => {
    if (state.isShuttingDown) {
      ctx.res.status = 503;
      ctx.raw.header("Retry-After", "10");
      ctx.raw.header("Connection", "close");
      throw ctx.jsonResponse(
        {
          error: "Server is shutting down",
        },
        503,
      );
    }

    const requestId = crypto.randomUUID?.() ?? generateRequestId();
    state.activeRequests.add(requestId);

    try {
      await next();
    } finally {
      state.activeRequests.delete(requestId);
    }
  };

  middlewareStates.set(middleware, state);
  return middleware;
}

/** @internal Associates a Node listener with the graceful lifecycle of a configured middleware. */
export function bindGracefulShutdownServer(
  middleware: MiddlewareFunction,
  server: NodeServerHandle,
): boolean {
  const state = middlewareStates.get(middleware);
  if (!state) {
    return false;
  }

  state.nodeServers.add(server);
  if (state.isShuttingDown) {
    forceCloseNodeListener(server);
    state.nodeServers.delete(server);
  }
  return true;
}

function setupSignalHandlers(
  state: ShutdownState,
  signals: NodeJS.Signals[],
  timeoutMs: number,
  onShutdown?: (signal: AbortSignal) => void | Promise<void>,
  logger?: ILogger,
  eventBusDrainTimeoutMs?: number,
): void {
  for (const signal of signals) {
    const existingHandler = state.signalHandlers.get(signal);
    if (existingHandler) {
      process.off(signal, existingHandler);
    }

    const handler = (): void => {
      void performShutdown(state, timeoutMs, onShutdown, logger, eventBusDrainTimeoutMs).catch(
        (error: unknown) => {
          if (state.signalFailureObserved) {
            return;
          }

          state.signalFailureObserved = true;
          try {
            if (logger) {
              logger.error("Graceful shutdown failed", { error });
            } else {
              // eslint-disable-next-line no-console
              console.error("Graceful shutdown failed", { error });
            }
          } catch (loggingError) {
            try {
              console.error("Graceful shutdown failure logging failed", {
                error,
                loggingError,
              });
            } catch {
              return;
            }
          } finally {
            process.exitCode = 1;
          }
        },
      );
    };

    state.signalHandlers.set(signal, handler);
    process.on(signal, handler);
  }
}

type ShutdownDeadline = {
  readonly startedAt: number;
  readonly deadline: number;
  readonly timeoutMs: number;
  readonly controller: AbortController;
};

type EventBusDrainOutcome =
  | { readonly kind: "drained" }
  | { readonly kind: "failed"; readonly error: unknown }
  | {
      readonly kind: "skipped";
      readonly reason: "event-bus-unavailable" | "running-count-unsupported";
    };

async function drainEventBus(
  logger: ILogger,
  deadline: ShutdownDeadline,
  eventBusDrainTimeoutMs: number,
): Promise<void> {
  let outcome: EventBusDrainOutcome;

  try {
    const { EventBusConfig } = await import("@croco/events-core");
    const config = EventBusConfig.getInstance();
    const eventBus = config.getEventBus();

    if (!eventBus || typeof eventBus !== "object") {
      outcome = { kind: "skipped", reason: "event-bus-unavailable" };
    } else {
      const eventBusWithRunningCount = eventBus as {
        getRunningHandlerCount?: () => number;
      };
      if (typeof eventBusWithRunningCount.getRunningHandlerCount !== "function") {
        outcome = { kind: "skipped", reason: "running-count-unsupported" };
      } else {
        const phaseDeadline = Math.min(
          deadline.deadline,
          monotonicNow() + Math.max(0, eventBusDrainTimeoutMs),
        );
        await waitForCondition(
          () => eventBusWithRunningCount.getRunningHandlerCount?.() === 0,
          "event-bus",
          deadline,
          phaseDeadline,
        );
        outcome = { kind: "drained" };
      }
    }
  } catch (error) {
    if (error instanceof GracefulShutdownTimeoutProblem) {
      throw error;
    }

    outcome = { kind: "failed", error };
  }

  if (outcome.kind === "skipped") {
    logger.warn("Event bus drain skipped", { reason: outcome.reason });
    return;
  }

  if (outcome.kind === "failed") {
    logger.warn("Event bus drain failed", { error: outcome.error });
    return;
  }

  logger.info("Event bus drained successfully");
}

function performShutdown(
  state: ShutdownState,
  timeoutMs: number,
  onShutdown?: (signal: AbortSignal) => void | Promise<void>,
  logger?: ILogger,
  eventBusDrainTimeoutMs?: number,
): Promise<void> {
  if (state.shutdownPromise) {
    return state.shutdownPromise;
  }

  state.isShuttingDown = true;
  state.signalFailureObserved = false;

  let resolveLifecycle: (() => void) | undefined;
  let rejectLifecycle: ((error: unknown) => void) | undefined;
  const lifecyclePromise = new Promise<void>((resolve, reject) => {
    resolveLifecycle = resolve;
    rejectLifecycle = reject;
  });
  state.shutdownPromise = lifecyclePromise;

  const startedAt = monotonicNow();
  const deadline: ShutdownDeadline = {
    startedAt,
    deadline: startedAt + timeoutMs,
    timeoutMs,
    controller: new AbortController(),
  };

  queueMicrotask(() => {
    void runShutdownLifecycle(
      state,
      deadline,
      onShutdown,
      logger ?? noopLogger(),
      eventBusDrainTimeoutMs ?? DEFAULT_EVENT_BUS_DRAIN_TIMEOUT_MS,
    ).then(resolveLifecycle, rejectLifecycle);
  });

  return lifecyclePromise;
}

async function runShutdownLifecycle(
  state: ShutdownState,
  deadline: ShutdownDeadline,
  onShutdown: ((signal: AbortSignal) => void | Promise<void>) | undefined,
  log: ILogger,
  eventBusDrainTimeoutMs: number,
): Promise<void> {
  try {
    log.info("Graceful shutdown initiated", { timeoutMs: deadline.timeoutMs });

    await waitForCondition(
      () => state.activeRequests.size === 0,
      "active-requests",
      deadline,
      deadline.deadline,
    );
    log.info("Active requests completed", { elapsedMs: elapsedMs(deadline) });

    await closeNodeListeners(state, deadline);

    await drainEventBus(log, deadline, eventBusDrainTimeoutMs);

    if (onShutdown) {
      const hookResult = onShutdown(deadline.controller.signal);
      if (hookResult) {
        await waitForPromise(hookResult, "on-shutdown", deadline);
      } else {
        assertPhaseWithinDeadline("on-shutdown", deadline);
      }
      log.info("Custom shutdown hook completed");
    }

    log.info("Graceful shutdown completed", { elapsedMs: elapsedMs(deadline) });
  } finally {
    forceCloseNodeListeners(state);
    removeOwnedSignalHandlers(state);
  }
}

async function closeNodeListeners(state: ShutdownState, deadline: ShutdownDeadline): Promise<void> {
  for (const server of state.nodeServers) {
    if (!server.listening) {
      state.nodeServers.delete(server);
      continue;
    }

    const closePromise = new Promise<void>((resolve, reject) => {
      server.close((error?: Error & { code?: string }) => {
        if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await waitForPromise(closePromise, "on-shutdown", deadline);
    state.nodeServers.delete(server);
  }
}

function forceCloseNodeListeners(state: ShutdownState): void {
  for (const server of state.nodeServers) {
    forceCloseNodeListener(server);
  }
  state.nodeServers.clear();
}

function forceCloseNodeListener(server: NodeServerHandle): void {
  if (server.listening) {
    server.close(() => {});
  }
  if ("closeAllConnections" in server && typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
}

function removeOwnedSignalHandlers(state: ShutdownState): void {
  for (const [signal, handler] of state.signalHandlers.entries()) {
    process.off(signal, handler);
    state.signalHandlers.delete(signal);
  }
}

async function waitForPromise(
  promise: Promise<void>,
  phase: GracefulShutdownPhase,
  deadline: ShutdownDeadline,
): Promise<void> {
  void promise.catch(() => undefined);
  const remainingMs = deadline.deadline - monotonicNow();
  if (remainingMs <= 0) {
    throw createTimeoutProblem(phase, deadline);
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(createTimeoutProblem(phase, deadline)), remainingMs);
      }),
    ]);
    assertPhaseWithinDeadline(phase, deadline);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

async function waitForCondition(
  condition: () => boolean,
  phase: GracefulShutdownPhase,
  deadline: ShutdownDeadline,
  phaseDeadline: number,
): Promise<void> {
  if (condition()) {
    return;
  }

  const remainingMs = phaseDeadline - monotonicNow();
  if (remainingMs <= 0) {
    throw createTimeoutProblem(phase, deadline);
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let checkInterval: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const settle = (action: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      if (checkInterval !== undefined) {
        clearInterval(checkInterval);
      }
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      action();
    };

    const check = (): void => {
      try {
        if (phaseDeadline - monotonicNow() <= 0) {
          settle(() => reject(createTimeoutProblem(phase, deadline)));
        } else if (condition()) {
          settle(resolve);
        }
      } catch (error) {
        settle(() => reject(error));
      }
    };

    checkInterval = setInterval(check, Math.min(100, remainingMs));
    timeout = setTimeout(check, remainingMs);
  });
}

function assertPhaseWithinDeadline(phase: GracefulShutdownPhase, deadline: ShutdownDeadline): void {
  if (monotonicNow() >= deadline.deadline) {
    throw createTimeoutProblem(phase, deadline);
  }
}

function createTimeoutProblem(
  phase: GracefulShutdownPhase,
  deadline: ShutdownDeadline,
): GracefulShutdownTimeoutProblem {
  const problem = new GracefulShutdownTimeoutProblem({
    phase,
    timeoutMs: deadline.timeoutMs,
    elapsedMs: elapsedMs(deadline),
  });
  if (!deadline.controller.signal.aborted) {
    deadline.controller.abort(problem);
  }
  return problem;
}

function monotonicNow(): number {
  return performance.now();
}

function elapsedMs(deadline: ShutdownDeadline): number {
  return Math.max(0, monotonicNow() - deadline.startedAt);
}

function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * 현재 처리 중인 활성 요청 수를 반환합니다.
 */
export function getActiveRequestCount(): number {
  let total = 0;
  for (const state of states) {
    total += state.activeRequests.size;
  }
  return total;
}

/**
 * 현재 프로세스가 shutdown 단계인지 반환합니다.
 */
export function isShuttingDown(): boolean {
  for (const state of states) {
    if (state.isShuttingDown) {
      return true;
    }
  }
  return false;
}

/**
 * 테스트와 재초기화를 위해 shutdown 상태를 초기화합니다.
 */
export function resetShutdownState(): void {
  for (const state of states) {
    resetState(state);
  }

  states.clear();
  legacyState = null;
}

function resetState(state: ShutdownState): void {
  state.isShuttingDown = false;
  state.activeRequests.clear();
  state.shutdownPromise = null;
  state.signalFailureObserved = false;

  for (const [signal, handler] of state.signalHandlers.entries()) {
    process.off(signal, handler);
  }

  state.signalHandlers.clear();
}
