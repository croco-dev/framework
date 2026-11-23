import { availableParallelism } from "node:os";
import type { SmokeMatrixCaseTiming } from "./create-croco-app-generated-smoke-matrix.mts";

export const GENERATED_SMOKE_CONCURRENCY_ENV = "CROCO_GENERATED_SMOKE_CONCURRENCY";
export const DEFAULT_GENERATED_SMOKE_CONCURRENCY = 2;
// Playwright journeys bind fixed ports 3000/5173 and browser installs share one
// PLAYWRIGHT_BROWSERS_PATH, so cases that touch either must not overlap.
export const BROWSER_RESOURCE_LOCK = "browser";

const BROWSER_VALIDATION_COMMANDS = new Set(["test:browser:install", "test:journey"]);

export function resolveGeneratedSmokeConcurrency(
  env: NodeJS.ProcessEnv = process.env,
  parallelism: number = availableParallelism(),
): number {
  const configured = env[GENERATED_SMOKE_CONCURRENCY_ENV];
  if (configured) {
    const parsed = Number.parseInt(configured, 10);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return Math.max(1, Math.min(DEFAULT_GENERATED_SMOKE_CONCURRENCY, Math.floor(parallelism / 2)));
}

export function generatedSmokeCaseResourceLocks(
  validations: readonly { readonly args?: readonly string[] }[],
): readonly string[] {
  return validations.some(
    ({ args }) => args?.[0] !== undefined && BROWSER_VALIDATION_COMMANDS.has(args[0]),
  )
    ? [BROWSER_RESOURCE_LOCK]
    : [];
}

export function orderGeneratedSmokeCasesForPool<T>(
  items: readonly T[],
  locksOf: (item: T) => readonly string[],
): readonly T[] {
  return [
    ...items.filter((item) => locksOf(item).length > 0),
    ...items.filter((item) => locksOf(item).length === 0),
  ];
}

export async function runWithResourceLocks<T>(
  items: readonly T[],
  options: {
    readonly concurrency: number;
    readonly locksOf: (item: T) => readonly string[];
    readonly run: (item: T) => Promise<void>;
  },
): Promise<void> {
  const pending = [...items];
  const heldLocks = new Set<string>();
  const active = new Set<Promise<void>>();

  const launchRunnable = (): void => {
    for (const item of pending.splice(0)) {
      const locks = options.locksOf(item);
      if (active.size >= options.concurrency || locks.some((lock) => heldLocks.has(lock))) {
        pending.push(item);
        continue;
      }
      for (const lock of locks) heldLocks.add(lock);
      const execution: Promise<void> = options.run(item).finally(() => {
        for (const lock of locks) heldLocks.delete(lock);
        active.delete(execution);
      });
      active.add(execution);
    }
  };

  launchRunnable();
  while (active.size > 0) {
    await Promise.race(active);
    launchRunnable();
  }
}

export function combineGeneratedSmokeCaseTiming(
  preparation: SmokeMatrixCaseTiming,
  verification: SmokeMatrixCaseTiming,
): SmokeMatrixCaseTiming {
  return {
    durationMs: preparation.durationMs + verification.durationMs,
    steps: [...preparation.steps, ...verification.steps],
  };
}

export function prefixOutputLine(caseName: string, line: string): string {
  return `[${caseName}] ${line}`;
}
