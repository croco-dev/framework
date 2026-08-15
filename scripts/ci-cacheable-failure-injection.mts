import { VerificationProblem } from "./verification-problem.mts";

export const CACHEABLE_FAILURE_CLASSES = [
  "none",
  "core-verification",
  "generated-apps",
  "package-artifacts",
  "coverage-security",
  "validate-synthesis",
] as const;

export type CacheableFailureClass = (typeof CACHEABLE_FAILURE_CLASSES)[number];

export const CACHEABLE_FAILURE_COMMAND = {
  "core-verification": "verification-policy",
  "generated-apps": "generated-app-smoke",
  "package-artifacts": "package-entrypoints-smoke",
  "coverage-security": "security-allowlists",
  "validate-synthesis": "test-evidence-reconcile",
} as const satisfies Readonly<Record<Exclude<CacheableFailureClass, "none">, string>>;

export const CACHEABLE_INJECTED_FAILURE_CODE = "CACHEABLE_EXPERIMENT_INJECTED_FAILURE";

export function parseCacheableFailureClass(value: string): CacheableFailureClass {
  if (!CACHEABLE_FAILURE_CLASSES.includes(value as CacheableFailureClass)) {
    throw new VerificationProblem(
      "UNKNOWN_CACHEABLE_FAILURE_CLASS",
      "input",
      `Failure class must be one of ${CACHEABLE_FAILURE_CLASSES.join(", ")}.`,
    );
  }
  return value as CacheableFailureClass;
}

export function injectedFailureCommandId(failureClass: CacheableFailureClass): string | null {
  return failureClass === "none" ? null : CACHEABLE_FAILURE_COMMAND[failureClass];
}

export function injectedFailureDiagnostic(commandId: string): string {
  return `${commandId}:${CACHEABLE_INJECTED_FAILURE_CODE}`;
}
