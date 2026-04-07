import type { MiddlewareFunction } from '../types';

export type GracefulShutdownOptions = {
  timeoutMs?: number;
  onShutdown?: () => void | Promise<void>;
  signals?: NodeJS.Signals[];
};

type ShutdownState = {
  isShuttingDown: boolean;
  activeRequests: Set<string>;
  shutdownPromise: Promise<void> | null;
};

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

const state: ShutdownState = {
  isShuttingDown: false,
  activeRequests: new Set<string>(),
  shutdownPromise: null,
};

export const gracefulShutdownMiddleware = (options: GracefulShutdownOptions = {}): MiddlewareFunction => {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, onShutdown, signals = DEFAULT_SIGNALS } = options;

  setupSignalHandlers(signals, timeoutMs, onShutdown);

  return async (ctx, next): Promise<void> => {
    if (state.isShuttingDown) {
      ctx.res.status = 503;
      ctx.raw.header('Retry-After', '10');
      ctx.raw.header('Connection', 'close');
      throw ctx.jsonResponse(
        {
          error: 'Server is shutting down',
        },
        503
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
};

export function setupGracefulShutdown(options: GracefulShutdownOptions = {}): () => Promise<void> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, onShutdown, signals = DEFAULT_SIGNALS } = options;

  return () => performShutdown(timeoutMs, onShutdown, signals);
}

function setupSignalHandlers(
  signals: NodeJS.Signals[],
  timeoutMs: number,
  onShutdown?: () => void | Promise<void>
): void {
  const handler = async (): Promise<void> => {
    await performShutdown(timeoutMs, onShutdown, signals);
  };

  for (const signal of signals) {
    process.once(signal, handler);
  }
}

async function performShutdown(
  timeoutMs: number,
  onShutdown?: () => void | Promise<void>,
  signals?: NodeJS.Signals[]
): Promise<void> {
  if (state.isShuttingDown) {
    return state.shutdownPromise ?? Promise.resolve();
  }

  state.isShuttingDown = true;

  state.shutdownPromise = new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      resolve();
    }, timeoutMs);

    const checkInterval = setInterval(() => {
      if (state.activeRequests.size === 0) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        resolve();
      }
    }, 100);
  });

  await state.shutdownPromise;

  if (onShutdown) {
    await onShutdown();
  }

  if (signals) {
    for (const signal of signals) {
      process.removeAllListeners(signal);
    }
  }

  process.exit(0);
}

function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getActiveRequestCount(): number {
  return state.activeRequests.size;
}

export function isShuttingDown(): boolean {
  return state.isShuttingDown;
}

export function resetShutdownState(): void {
  state.isShuttingDown = false;
  state.activeRequests.clear();
  state.shutdownPromise = null;

  ['SIGTERM', 'SIGINT'].forEach((signal) => {
    process.removeAllListeners(signal);
  });
}
