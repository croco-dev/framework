import {
  InvalidCacheConfigurationProblem,
  MAX_CACHE_ENTRIES,
  MAX_CACHE_TIMER_DELAY_MS,
} from "./problems/CacheStoreProblems";
import type { CacheNumericOption } from "./problems/CacheStoreProblems";

const CACHE_NUMERIC_OPTION_MAXIMUMS: Readonly<Record<CacheNumericOption, number>> = {
  maxEntries: MAX_CACHE_ENTRIES,
  cleanupIntervalMs: MAX_CACHE_TIMER_DELAY_MS,
};

export function assertValidCacheNumericOption(option: CacheNumericOption, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > CACHE_NUMERIC_OPTION_MAXIMUMS[option]) {
    throw new InvalidCacheConfigurationProblem(option, value);
  }
}
