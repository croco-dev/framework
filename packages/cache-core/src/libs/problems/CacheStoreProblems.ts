import { Problem, ProblemCategory } from "@croco/problems-core";

/** Largest cache capacity that preserves exact integer eviction semantics. */
export const MAX_CACHE_ENTRIES = Number.MAX_SAFE_INTEGER;
/** Largest cleanup interval that Node.js timers accept without clamping. */
export const MAX_CACHE_TIMER_DELAY_MS = 2_147_483_647;

export type CacheNumericOption = "maxEntries" | "cleanupIntervalMs";

/** In-memory cache numeric configuration cannot be represented with safe runtime semantics. */
export class InvalidCacheConfigurationProblem extends Problem {
  readonly code = "cache-core/invalid-configuration";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    readonly option: CacheNumericOption,
    readonly value: number,
  ) {
    const constraint =
      option === "maxEntries"
        ? `an integer between 1 and ${MAX_CACHE_ENTRIES}`
        : `an integer between 1 and ${MAX_CACHE_TIMER_DELAY_MS} milliseconds`;
    super(
      undefined,
      undefined,
      `Invalid in-memory cache configuration: ${option} must be ${constraint}; received ${value}`,
    );
  }
}

/**
 * RFC 7807 형식의 유효하지 않은 캐시 TTL 검증 문제입니다.
 */
export class InvalidCacheTtlProblem extends Problem {
  readonly code = "cache-core/invalid-ttl";
  readonly category = ProblemCategory.ValidationError;
  readonly receivedTtl: string;

  constructor(ttlMs: number) {
    const receivedTtl = String(ttlMs);
    super(
      "cache-core/invalid-ttl",
      ProblemCategory.ValidationError,
      `Cache TTL must be a finite, non-negative number of milliseconds; received ${receivedTtl}.`,
      { extensions: { receivedTtl } },
    );
    this.receivedTtl = receivedTtl;
  }
}
