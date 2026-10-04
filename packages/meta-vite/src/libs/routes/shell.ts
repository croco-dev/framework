/**
 * Minimal per-request runtime context for shell/region contracts.
 * Mirrors `RuntimeContext["platform"]` without importing render types so the
 * route contract layer stays free of render-layer dependencies.
 */
export type ShellRuntimePlatform = "cloudflare" | "lambda" | "node";

export type ShellRuntimeContext = {
  readonly platform: ShellRuntimePlatform;
  readonly env?: unknown;
  readonly executionContext?: unknown;
  readonly event?: unknown;
  readonly lambdaContext?: unknown;
};

/**
 * Shell resolution for shell-first streaming SSR.
 *
 * Resolve before the render commits response headers. Use it for existence,
 * authorization, redirect, and status decisions that must not change after
 * the shell flushes (404, login redirect, critical 5xx).
 */
export type ShellDecision =
  | { readonly kind: "render" }
  | { readonly kind: "notFound" }
  | {
      readonly kind: "redirect";
      readonly location: string;
      readonly status?: 301 | 302 | 303 | 307 | 308;
    }
  | { readonly kind: "failed"; readonly status: 500 | 502 | 503 | 504 };

export type ShellDecisionInput = {
  readonly request: Request;
  readonly context?: ShellRuntimeContext;
  /** AbortSignal for the request; shell resolution races the render deadline. */
  readonly signal: AbortSignal;
};

export type DeferredRegionLoaderInput = {
  readonly signal: AbortSignal;
  readonly request?: Request;
  readonly context?: ShellRuntimeContext;
};

export type DeferredRegionLoader = (input?: DeferredRegionLoaderInput) => Promise<unknown>;

/**
 * Deferred (non-critical) region declared by a page route.
 * Regions render behind a Suspense boundary after the critical shell flushes.
 * Loaders run with the request AbortSignal so client disconnect, region
 * timeout, or overall deadline cancels upstream work.
 */
export type DeferredRegionDefinition = {
  readonly id: string;
  readonly loader: DeferredRegionLoader;
  /** Per-region timeout in milliseconds. Defaults to the render deadline. */
  readonly timeoutMs?: number;
};

/**
 * Per-request shell streaming options.
 */
export type ShellRenderOptions = {
  /**
   * Overall render deadline in milliseconds. The render AbortSignal aborts
   * when the request signal aborts or this deadline elapses.
   */
  readonly deadlineMs?: number;
  /**
   * Per-region timeout in milliseconds applied when a region does not declare
   * its own timeoutMs.
   */
  readonly regionTimeoutMs?: number;
  /**
   * Maximum total bytes buffered for one slow consumer before the render aborts.
   * Bounds the complete buffered response on the Lambda delivery path; stream
   * delivery applies pull-based backpressure (`desiredSize` + `highWaterMark: 1`)
   * instead of a cumulative cap so full-size shells are not cut off mid-stream.
   */
  readonly maxBufferedBytes?: number;
  /**
   * Aggregate observability only. Individual timings or payload contents are
   * never exposed to the client through this hook.
   */
  readonly onSettle?: (summary: ShellSettleSummary) => void;
};

export type ShellSettleSummary = {
  readonly delivery: "stream" | "buffered";
  readonly platform: ShellRuntimePlatform | "unknown";
  readonly shellCommitted: boolean;
  readonly regionsSettled: number;
  readonly regionsFailed: number;
  readonly regionsCancelled: number;
  readonly bytes: number;
  readonly timedOut: boolean;
  readonly clientAborted: boolean;
  /** Why the stream ended early; absent on the normal completion path. */
  readonly abortReason?: "deadline" | "client-abort" | "max-buffered-bytes" | "render-error";
};

export type PageRouteStreamDefinition = {
  /** Resolve existence/auth/redirect/status before header commit. */
  readonly resolveShell?: (input: ShellDecisionInput) => Promise<ShellDecision>;
  /** Deferred regions streamed after the shell. */
  readonly regions?: readonly DeferredRegionDefinition[];
  /** Shell render policy for this route. */
  readonly stream?: ShellRenderOptions;
};
