export const RUN_TIMEOUT_MS: number;
export const CLEANUP_TIMEOUT_MS: number;
export const TEST_TIMEOUT_MS: number;
export function runExperienceSlotProcess(
  runner: string,
  options?: {
    timeoutMs?: number;
    cleanupTimeoutMs?: number;
    graceMs?: number;
    signal?: AbortSignal;
    args?: string[];
  },
): Promise<string>;
