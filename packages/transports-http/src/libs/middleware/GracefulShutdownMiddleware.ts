import type { ILogger } from "@croco/framework-context";
import type { MiddlewareFunction } from "../types";

export type GracefulShutdownOptions = {
  timeoutMs?: number;
  onShutdown?: () => void | Promise<void>;
  signals?: NodeJS.Signals[];
  logger?: ILogger;
  eventBusDrainTimeoutMs?: number;
  isLambdaEnvironment?: boolean;
};

type ShutdownState = {
  isShuttingDown: boolean;
  activeRequests: Set<string>;
  shutdownPromise: Promise<void> | null;
  signalHandlers: Map<NodeJS.Signals, () => Promise<void>>;
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

function createMiddlewareState(): ShutdownState {
  const state = {
    isShuttingDown: false,
    activeRequests: new Set<string>(),
    shutdownPromise: null,
    signalHandlers: new Map(),
  };

  states.add(state);
  return state;
}

const states = new Set<ShutdownState>();

function isRunningInLambda(): boolean {
  return !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV);
}

function noopLogger(): ILogger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => noopLogger(),
  };
}

/**
 * shutdown 상태에서 새 요청을 차단하고 활성 요청 완료를 기다리는 미들웨어입니다.
 */
export const gracefulShutdownMiddleware = (
  options: GracefulShutdownOptions = {},
): MiddlewareFunction => createGracefulShutdownController(options).middleware;

/**
 * 하나의 HTTP 앱에 귀속된 graceful shutdown 미들웨어와 제어 함수를 생성합니다.
 */
export function createGracefulShutdownController(
  options: GracefulShutdownOptions = {},
): GracefulShutdownController {
  const state = createMiddlewareState();
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onShutdown,
    signals = DEFAULT_SIGNALS,
    logger,
    isLambdaEnvironment = isRunningInLambda(),
  } = options;

  if (!isLambdaEnvironment) {
    setupSignalHandlers(
      state,
      signals,
      timeoutMs,
      onShutdown,
      logger,
      options.eventBusDrainTimeoutMs,
    );
  }

  return {
    middleware: createMiddlewareForState(state),
    shutdown: () =>
      performShutdown(
        state,
        timeoutMs,
        onShutdown,
        signals,
        logger,
        options.eventBusDrainTimeoutMs,
      ),
    getActiveRequestCount: () => state.activeRequests.size,
    isShuttingDown: () => state.isShuttingDown,
    reset: () => resetState(state),
  };
}

/**
 * 원하는 시점에 graceful shutdown 절차를 실행할 함수를 생성합니다.
 */
export function setupGracefulShutdown(options: GracefulShutdownOptions = {}): () => Promise<void> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    onShutdown,
    signals = DEFAULT_SIGNALS,
    logger,
    eventBusDrainTimeoutMs,
  } = options;

  const state = createMiddlewareState();

  return () =>
    performShutdown(state, timeoutMs, onShutdown, signals, logger, eventBusDrainTimeoutMs);
}

function createMiddlewareForState(state: ShutdownState): MiddlewareFunction {
  return async (ctx, next): Promise<void> => {
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

      if (state.isShuttingDown && state.activeRequests.size === 0 && state.shutdownPromise) {
        state.shutdownPromise = null;
      }
    }
  };
}

function setupSignalHandlers(
  state: ShutdownState,
  signals: NodeJS.Signals[],
  timeoutMs: number,
  onShutdown?: () => void | Promise<void>,
  logger?: ILogger,
  eventBusDrainTimeoutMs?: number,
): void {
  for (const signal of signals) {
    const handler = async (): Promise<void> => {
      await performShutdown(state, timeoutMs, onShutdown, signals, logger, eventBusDrainTimeoutMs);
    };

    state.signalHandlers.set(signal, handler);
    process.on(signal, handler);
  }
}

async function drainEventBus(logger: ILogger, timeoutMs: number): Promise<void> {
  try {
    const { EventBusConfig } = await import("@croco/events-core");
    const config = EventBusConfig.getInstance();
    const eventBus = config.getEventBus();

    if (!eventBus || typeof eventBus !== "object") {
      return;
    }

    const startTime = Date.now();

    const eventBusWithRunningCount = eventBus as { getRunningHandlerCount?: () => number };
    if (typeof eventBusWithRunningCount.getRunningHandlerCount !== "function") {
      return;
    }

    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        const runningCount = eventBusWithRunningCount.getRunningHandlerCount?.() ?? 0;

        if (runningCount === 0) {
          clearInterval(checkInterval);
          logger.info("Event bus drained successfully");
          resolve();
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          logger.warn("Event bus drain timeout exceeded", { runningCount });
          resolve();
        }
      }, 100);
    });
  } catch (error) {
    // Intentionally ignored: drain failure should not block shutdown
    logger?.warn?.("Event bus drain failed", { error });
  }
}

async function performShutdown(
  state: ShutdownState,
  timeoutMs: number,
  onShutdown?: () => void | Promise<void>,
  signals?: NodeJS.Signals[],
  logger?: ILogger,
  eventBusDrainTimeoutMs?: number,
): Promise<void> {
  const log = logger ?? noopLogger();

  if (state.isShuttingDown) {
    return state.shutdownPromise ?? Promise.resolve();
  }

  state.isShuttingDown = true;
  log.info("Graceful shutdown initiated", { timeoutMs });

  const startTime = Date.now();
  const drainTimeout = eventBusDrainTimeoutMs ?? DEFAULT_EVENT_BUS_DRAIN_TIMEOUT_MS;

  state.shutdownPromise = new Promise<void>((resolve) => {
    let finished = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let checkInterval: ReturnType<typeof setInterval> | undefined;

    const cleanup = (): void => {
      if (finished) {
        return;
      }

      finished = true;

      if (timeout !== undefined) {
        clearTimeout(timeout);
      }

      if (checkInterval !== undefined) {
        clearInterval(checkInterval);
      }
    };

    const resolveOnce = (): void => {
      cleanup();
      resolve();
    };

    timeout = setTimeout(() => {
      log.error("Shutdown timeout exceeded", { elapsedMs: Date.now() - startTime });
      resolveOnce();
    }, timeoutMs);

    checkInterval = setInterval(() => {
      if (state.activeRequests.size === 0) {
        resolveOnce();
      }
    }, 100);
  });

  await state.shutdownPromise;
  log.info("Active requests completed", { elapsedMs: Date.now() - startTime });

  await drainEventBus(log, drainTimeout);

  if (onShutdown) {
    try {
      await onShutdown();
      log.info("Custom shutdown hook completed");
    } catch (error) {
      log.error(
        "Custom shutdown hook failed",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  if (signals) {
    for (const signal of signals) {
      const handler = state.signalHandlers.get(signal);

      if (handler) {
        process.off(signal, handler);
        state.signalHandlers.delete(signal);
      }
    }
  }

  log.info("Graceful shutdown completed", { elapsedMs: Date.now() - startTime });
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
}

function resetState(state: ShutdownState): void {
  state.isShuttingDown = false;
  state.activeRequests.clear();
  state.shutdownPromise = null;

  for (const [signal, handler] of state.signalHandlers.entries()) {
    process.off(signal, handler);
  }

  state.signalHandlers.clear();
}
