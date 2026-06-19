import { InMemoryCacheStore } from "@croco/cache-core";
import type { IsrCacheStore } from "./types";

export type IsrRuntime = "node" | "lambda" | "cloudflare-workers";

export type IsrCacheDurability = "local" | "durable";

export type IsrRuntimeDiagnosticSeverity = "info" | "error";

export type IsrRuntimeDiagnosticCode =
  | "CROCO_META_VITE_ISR_LOCAL_CACHE_ONLY"
  | "CROCO_META_VITE_ISR_WORKER_STORE_UNSAFE";

export type IsrRuntimeDiagnostic = {
  readonly code: IsrRuntimeDiagnosticCode;
  readonly severity: IsrRuntimeDiagnosticSeverity;
  readonly message: string;
  readonly recovery: string;
};

export type IsrCacheStoreProfile = {
  readonly store: IsrCacheStore;
  readonly durability: IsrCacheDurability;
  readonly label: string;
  readonly workerSafe: boolean;
};

export type DurableIsrCacheStoreProfileOptions = {
  readonly label?: string;
  readonly workerSafe?: boolean;
};

export type IsrRuntimeSupportOptions = {
  readonly runtime: IsrRuntime;
  readonly cache: IsrCacheStoreProfile;
  readonly requireDurable?: boolean;
};

export type IsrRuntimeSupportReport = {
  readonly runtime: IsrRuntime;
  readonly cacheLabel: string;
  readonly supported: boolean;
  readonly durable: boolean;
  readonly diagnostics: readonly IsrRuntimeDiagnostic[];
};

export function createLocalIsrCacheProfile(
  store: IsrCacheStore,
  label = "in-memory",
): IsrCacheStoreProfile {
  return {
    store,
    label,
    durability: "local",
    workerSafe: true,
  };
}

export function createDurableIsrCacheProfile(
  store: IsrCacheStore,
  options: DurableIsrCacheStoreProfileOptions = {},
): IsrCacheStoreProfile {
  const label = options.label ?? "durable";

  if (store instanceof InMemoryCacheStore) {
    return createLocalIsrCacheProfile(store, label);
  }

  return {
    store,
    label,
    durability: "durable",
    workerSafe: options.workerSafe ?? false,
  };
}

export function evaluateIsrRuntimeSupport(
  options: IsrRuntimeSupportOptions,
): IsrRuntimeSupportReport {
  const diagnostics: IsrRuntimeDiagnostic[] = [];

  if (options.cache.durability === "local") {
    diagnostics.push(createLocalCacheDiagnostic(options));
  }

  if (
    options.runtime === "cloudflare-workers" &&
    options.cache.durability === "durable" &&
    !options.cache.workerSafe
  ) {
    diagnostics.push(createUnsafeWorkerStoreDiagnostic(options.cache.label));
  }

  const supported = diagnostics.every((diagnostic) => diagnostic.severity !== "error");

  return {
    runtime: options.runtime,
    cacheLabel: options.cache.label,
    supported,
    durable: supported && options.cache.durability === "durable",
    diagnostics,
  };
}

function createLocalCacheDiagnostic(options: IsrRuntimeSupportOptions): IsrRuntimeDiagnostic {
  return {
    code: "CROCO_META_VITE_ISR_LOCAL_CACHE_ONLY",
    severity: options.requireDurable === true ? "error" : "info",
    message: `${options.cache.label} ISR cache is local to the current runtime instance and is not a durable production cache.`,
    recovery:
      options.runtime === "cloudflare-workers"
        ? "Supply a Worker-safe IsrCacheStore and mark its profile workerSafe before claiming durable Workers ISR."
        : "Use RedisCacheStoreAdapter or another durable IsrCacheStore before enabling a durable ISR production claim.",
  };
}

function createUnsafeWorkerStoreDiagnostic(cacheLabel: string): IsrRuntimeDiagnostic {
  return {
    code: "CROCO_META_VITE_ISR_WORKER_STORE_UNSAFE",
    severity: "error",
    message: `${cacheLabel} is not marked Worker-safe, so Cloudflare Workers durable ISR is unsupported.`,
    recovery:
      "Use a Worker-safe external IsrCacheStore, such as a cache backed by Worker-compatible bindings, and mark its profile workerSafe.",
  };
}
