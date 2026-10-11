import type { DeferredRegionDefinition, DeferredRegionLoaderInput } from "../routes/shell";

/**
 * Per-request deferred region store.
 * RenderServer creates one store per request and passes its reader through
 * component props, so parallel fetches and cancellation never mix tenant,
 * auth, or request data across concurrent requests.
 */
export type DeferredRegionReader = {
  readonly signal: AbortSignal;
  readRegion(id: string): Promise<unknown>;
};

export function createDeferredRegionStore(
  regions: readonly DeferredRegionDefinition[],
  signal: AbortSignal,
  regionTimeoutMs: number,
  input?: Omit<DeferredRegionLoaderInput, "signal">,
): { readonly reader: DeferredRegionReader; readonly settle: () => Promise<RegionSettleCounts> } {
  const started = new Map<string, Promise<unknown>>();
  const counts: RegionSettleCounts = { settled: 0, failed: 0, cancelled: 0 };

  const reader: DeferredRegionReader = {
    signal,
    readRegion(id: string): Promise<unknown> {
      const existing = started.get(id);
      if (existing) {
        return existing;
      }

      const definition = regions.find((region) => region.id === id);
      if (!definition) {
        return Promise.reject(new DeferredRegionUnknownError(id));
      }

      const task = runRegion(definition, signal, regionTimeoutMs, input).then(
        (value) => {
          counts.settled += 1;
          return value;
        },
        (error) => {
          if (isCancelError(error, signal)) {
            counts.cancelled += 1;
          } else {
            counts.failed += 1;
          }
          throw error;
        },
      );
      started.set(id, task);
      return task;
    },
  };

  return {
    reader,
    settle: async () => {
      // Start every declared region so orphan work cannot linger behind a
      // single consumed region, then wait for all of them to settle.
      await Promise.allSettled(regions.map((region) => reader.readRegion(region.id)));
      return { ...counts };
    },
  };
}

export type RegionSettleCounts = {
  settled: number;
  failed: number;
  cancelled: number;
};

export class DeferredRegionUnknownError extends Error {
  readonly code = "meta-vite/deferred-region-unknown" as const;

  constructor(regionId: string) {
    super(`Unknown deferred region '${regionId}'`);
    this.name = "DeferredRegionUnknownError";
  }
}

export class DeferredRegionTimeoutError extends Error {
  readonly code = "meta-vite/deferred-region-timeout" as const;

  constructor(regionId: string, timeoutMs: number) {
    super(`Deferred region '${regionId}' timed out after ${timeoutMs}ms`);
    this.name = "DeferredRegionTimeoutError";
  }
}

export class DeferredRegionCancelledError extends Error {
  readonly code = "meta-vite/deferred-region-cancelled" as const;

  constructor(reason?: unknown) {
    super("Deferred region cancelled");
    this.name = "DeferredRegionCancelledError";
    if (reason !== undefined) {
      this.cause = reason;
    }
  }
}

async function runRegion(
  definition: DeferredRegionDefinition,
  signal: AbortSignal,
  defaultTimeoutMs: number,
  input?: Omit<DeferredRegionLoaderInput, "signal">,
): Promise<unknown> {
  if (signal.aborted) {
    throw toDeferredRegionAbortError(signal.reason);
  }

  const timeoutMs = normalizeTimeout(definition.timeoutMs, defaultTimeoutMs);
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  // Per-region controller: the loader observes this signal so a region
  // timeout aborts upstream work (the race alone would only ignore the
  // result). Parent aborts forward into the region controller.
  const regionController = new AbortController();
  const forwardAbort = () => {
    regionController.abort(signal.reason);
  };
  if (signal.aborted) {
    forwardAbort();
  } else {
    signal.addEventListener("abort", forwardAbort, { once: true });
  }

  try {
    const loaderResult = definition.loader({ ...input, signal: regionController.signal });
    if (timeoutMs === undefined) {
      return await loaderResult;
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new DeferredRegionTimeoutError(definition.id, timeoutMs);
        regionController.abort(error);
        reject(error);
      }, timeoutMs);
    });

    return await Promise.race([loaderResult, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    signal.removeEventListener("abort", forwardAbort);
  }
}

function normalizeTimeout(value: number | undefined, fallback: number): number | undefined {
  const candidate = value ?? fallback;
  if (!Number.isFinite(candidate) || candidate <= 0) {
    return undefined;
  }

  return Math.floor(candidate);
}

function isCancelError(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted && error === signal.reason) {
    return true;
  }

  return (
    error instanceof DeferredRegionTimeoutError ||
    error instanceof DeferredRegionCancelledError ||
    (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"))
  );
}

function toDeferredRegionAbortError(reason: unknown): Error {
  return reason instanceof Error ? reason : new DeferredRegionCancelledError(reason);
}
