import type { ShellRuntimePlatform } from "../routes/shell";

export const SHELL_STREAM_DEFAULT_DEADLINE_MS = 10_000;
export const SHELL_STREAM_DEFAULT_REGION_TIMEOUT_MS = 5_000;
/** Bounded total response for the buffered Lambda delivery path. */
export const SHELL_STREAM_DEFAULT_MAX_BUFFERED_BYTES = 1024 * 1024;

export const SHELL_STREAM_DELIVERY_HEADER = "x-croco-delivery";
export const SHELL_STREAM_SERVER_TIMING = "shell;dur=0, regions";

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
): void {
  headers.set(
    SHELL_STREAM_DELIVERY_HEADER,
    delivery === "stream" ? `stream; host=${platform}` : `buffered; host=${platform}`,
  );
  headers.set("Server-Timing", SHELL_STREAM_SERVER_TIMING);
}

function normalizePositive(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}
