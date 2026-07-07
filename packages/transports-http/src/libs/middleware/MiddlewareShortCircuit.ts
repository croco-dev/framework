const MIDDLEWARE_SHORT_CIRCUIT_KEY = "__crocoMiddlewareShortCircuit";
const DEFAULT_SHORT_CIRCUIT_REASON = "explicit-short-circuit";

export type MiddlewareShortCircuitReason = string;

export type MiddlewareShortCircuit = {
  readonly [MIDDLEWARE_SHORT_CIRCUIT_KEY]: true;
  readonly reason: MiddlewareShortCircuitReason;
};

/**
 * Marks an HTTP middleware as intentionally ending the middleware chain without calling next().
 */
export function shortCircuit(
  reason: MiddlewareShortCircuitReason = DEFAULT_SHORT_CIRCUIT_REASON,
): MiddlewareShortCircuit {
  return Object.freeze({
    [MIDDLEWARE_SHORT_CIRCUIT_KEY]: true,
    reason: normalizeShortCircuitReason(reason),
  });
}

export function isMiddlewareShortCircuit(value: unknown): value is MiddlewareShortCircuit {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<MiddlewareShortCircuit>;
  return (
    candidate[MIDDLEWARE_SHORT_CIRCUIT_KEY] === true &&
    typeof candidate.reason === "string" &&
    candidate.reason.trim().length > 0
  );
}

function normalizeShortCircuitReason(reason: string): string {
  const trimmedReason = reason.trim();

  return trimmedReason.length > 0 ? trimmedReason : DEFAULT_SHORT_CIRCUIT_REASON;
}
