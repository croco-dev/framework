import type { ShellRuntimePlatform } from "../routes/shell";

export const SHELL_STREAM_DEFAULT_DEADLINE_MS = 10_000;
export const SHELL_STREAM_DEFAULT_REGION_TIMEOUT_MS = 5_000;
/** Bounded total response for the buffered Lambda delivery path. */
export const SHELL_STREAM_DEFAULT_MAX_BUFFERED_BYTES = 1024 * 1024;

export const SHELL_STREAM_DELIVERY_HEADER = "x-croco-delivery";
/** Server-Timing metrics when no shell duration was measured. */
export const SHELL_STREAM_SERVER_TIMING = "shell, regions";

export const SHELL_STREAM_RENDER_ABORTED_CODE = "meta-vite/shell-stream-aborted" as const;
export const SHELL_STREAM_MAX_BUFFERED_BYTES_CODE =
  "meta-vite/shell-stream-max-buffered-bytes" as const;

export class ShellStreamAbortedError extends Error {
  readonly code = SHELL_STREAM_RENDER_ABORTED_CODE;

  constructor(reason?: unknown) {
    super("SSR render aborted");
    this.name = "ShellStreamAbortedError";
    if (reason !== undefined) {
      this.cause = reason;
    }
  }
}

export class ShellStreamMaxBufferedBytesError extends Error {
  readonly code = SHELL_STREAM_MAX_BUFFERED_BYTES_CODE;

  constructor(limitBytes: number) {
    super(`SSR render exceeded max buffered bytes (${limitBytes})`);
    this.name = "ShellStreamMaxBufferedBytesError";
  }
}

const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

export type ShellStreamDelivery = "stream" | "buffered";

export type ShellStreamPolicy = {
  readonly delivery: ShellStreamDelivery;
  readonly deadlineMs: number;
  readonly regionTimeoutMs: number;
  readonly maxBufferedBytes: number;
};

export type ShellStreamRequest = {
  readonly signal?: AbortSignal | null;
  readonly deadlineMs?: number;
  readonly regionTimeoutMs?: number;
  /** Total-response cap for the buffered delivery path. */
  readonly maxBufferedBytes?: number;
};

/**
 * Each phase uses the same absolute deadline. Install a timer for pending
 * work and also check elapsed time at the boundary, since a synchronous
 * render can return before an overdue timer gets a turn.
 */
export function createShellRenderLifetime(requestSignal: AbortSignal, deadlineAt: number) {
  const controller = new AbortController();
  const { signal } = controller;
  const expire = () =>
    controller.abort(new ShellStreamAbortedError("SSR render deadline exceeded"));
  const forwardAbort = () => controller.abort(toShellAbortError(requestSignal.reason));

  if (requestSignal.aborted) {
    forwardAbort();
  } else {
    requestSignal.addEventListener("abort", forwardAbort, { once: true });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const armTimer = () => {
    if (signal.aborted) return;
    const remainingMs = Math.ceil(deadlineAt - performance.now());
    if (remainingMs <= 0) {
      expire();
    } else {
      // Node can wake before the monotonic deadline and treats delays above
      // its 32-bit limit as one millisecond. Recheck the clock on each wake.
      timer = setTimeout(armTimer, Math.min(remainingMs, MAX_TIMER_DELAY_MS));
    }
  };
  armTimer();

  const abortIfExpired = () => {
    if (!signal.aborted && performance.now() >= deadlineAt) expire();
  };
  const check = () => {
    abortIfExpired();
    signal.throwIfAborted();
  };

  return {
    controller,
    abortIfExpired,
    check,
    async run<T>(operation: () => Promise<T>): Promise<T> {
      check();
      let onAbort: (() => void) | undefined;
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
      });
      try {
        const work = Promise.resolve().then(() => {
          check();
          return operation();
        });
        const value = await Promise.race([work, aborted]);
        check();
        return value;
      } finally {
        if (onAbort) signal.removeEventListener("abort", onAbort);
      }
    },
    dispose() {
      requestSignal.removeEventListener("abort", forwardAbort);
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}

export function toShellAbortError(reason: unknown): Error {
  return reason instanceof Error ? reason : new ShellStreamAbortedError(reason);
}

export function resolveShellStreamPolicy(
  platform: ShellRuntimePlatform | undefined,
  request: ShellStreamRequest,
): ShellStreamPolicy {
  return {
    // Lambda (API Gateway v2 default adapter) buffers; Node and Workers pipe.
    delivery: platform === "lambda" ? "buffered" : "stream",
    deadlineMs: normalizePositive(request.deadlineMs, SHELL_STREAM_DEFAULT_DEADLINE_MS),
    regionTimeoutMs: normalizePositive(
      request.regionTimeoutMs,
      SHELL_STREAM_DEFAULT_REGION_TIMEOUT_MS,
    ),
    maxBufferedBytes: normalizePositive(
      request.maxBufferedBytes,
      SHELL_STREAM_DEFAULT_MAX_BUFFERED_BYTES,
    ),
  };
}

export function applyShellStreamHeaders(
  headers: Headers,
  delivery: ShellStreamDelivery,
  platform: ShellRuntimePlatform | "unknown",
  shellDurationMs?: number,
): void {
  headers.set(
    SHELL_STREAM_DELIVERY_HEADER,
    delivery === "stream" ? `stream; host=${platform}` : `buffered; host=${platform}`,
  );
  const timing = isObservableDuration(shellDurationMs, platform)
    ? `shell;dur=${shellDurationMs}, regions`
    : SHELL_STREAM_SERVER_TIMING;
  headers.append("Server-Timing", timing);
}

export function isObservableDuration(
  durationMs: number | undefined,
  platform: ShellRuntimePlatform | "unknown" | undefined,
): durationMs is number {
  // In deployed Workers, a clock that did not advance may hide CPU time.
  return (
    durationMs !== undefined &&
    Number.isFinite(durationMs) &&
    durationMs >= 0 &&
    (durationMs > 0 || platform !== "cloudflare")
  );
}

function normalizePositive(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}
