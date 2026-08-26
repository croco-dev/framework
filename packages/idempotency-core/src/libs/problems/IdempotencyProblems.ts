import { Problem, ProblemCategory, type ProblemOptions } from "@croco/problems-core";

export const IDEMPOTENCY_DIAGNOSTIC_CODES = {
  keyConflict: "idempotency-core/key-conflict",
  invalidKey: "idempotency-core/invalid-key",
  invalidSnapshot: "idempotency-core/invalid-snapshot",
  invalidTtl: "idempotency-core/invalid-ttl",
  reservationExpired: "idempotency-core/reservation-expired",
  reservationNotFound: "idempotency-core/reservation-not-found",
  reservationState: "idempotency-core/reservation-state",
} as const;

export type IdempotencyDiagnosticCode =
  (typeof IDEMPOTENCY_DIAGNOSTIC_CODES)[keyof typeof IDEMPOTENCY_DIAGNOSTIC_CODES];

type IdempotencyProblemOptions = {
  readonly code: IdempotencyDiagnosticCode;
  readonly category: ProblemCategory;
  readonly detail: string;
  readonly extensions?: Record<string, unknown>;
  readonly cause?: Error;
};

class IdempotencyProblem extends Problem {
  constructor(options: IdempotencyProblemOptions) {
    const problemOptions: ProblemOptions = {
      ...(options.extensions === undefined ? {} : { extensions: options.extensions }),
      ...(options.cause === undefined ? {} : { cause: options.cause }),
    };

    super(options.code, options.category, options.detail, problemOptions);
  }
}

export class IdempotencyConflictProblem extends IdempotencyProblem {
  constructor(options: {
    readonly key: string;
    readonly namespace: string;
    readonly tenantId: string | null;
  }) {
    super({
      code: IDEMPOTENCY_DIAGNOSTIC_CODES.keyConflict,
      category: ProblemCategory.Conflict,
      detail: `Idempotency key '${options.key}' was reused with a different fingerprint`,
      extensions: {
        key: options.key,
        namespace: options.namespace,
        tenantId: options.tenantId,
        fingerprintMismatch: true,
      },
    });
  }
}

export class InvalidIdempotencyKeyProblem extends IdempotencyProblem {
  constructor(reason: string, extensions: Record<string, unknown> = {}) {
    super({
      code: IDEMPOTENCY_DIAGNOSTIC_CODES.invalidKey,
      category: ProblemCategory.BadRequest,
      detail: `Invalid idempotency key: ${reason}`,
      extensions,
    });
  }
}

export type IdempotencySnapshotField = "metadata" | "problem" | "record" | "response";

export type InvalidIdempotencySnapshotProblemOptions = {
  readonly field: IdempotencySnapshotField;
  readonly cause?: Error;
};

/** Raised when a value cannot be captured with the structured clone algorithm. */
export class InvalidIdempotencySnapshotProblem extends IdempotencyProblem {
  constructor(options: InvalidIdempotencySnapshotProblemOptions) {
    super({
      code: IDEMPOTENCY_DIAGNOSTIC_CODES.invalidSnapshot,
      category: ProblemCategory.ValidationError,
      detail: `Idempotency ${options.field} must support stable structured cloning`,
      extensions: {
        field: options.field,
        constraint: "stable-structured-clone-compatible",
      },
      ...(options.cause === undefined ? {} : { cause: options.cause }),
    });
  }
}

export type IdempotencyTtlConstraint = "positive-safe-integer" | "valid-date-range";

export type InvalidIdempotencyTtlProblemOptions = {
  readonly constraint: IdempotencyTtlConstraint;
  readonly receivedValue: number | string;
};

/** Raised when an idempotency TTL cannot produce a valid future expiration. */
export class InvalidIdempotencyTtlProblem extends IdempotencyProblem {
  constructor(options: InvalidIdempotencyTtlProblemOptions) {
    super({
      code: IDEMPOTENCY_DIAGNOSTIC_CODES.invalidTtl,
      category: ProblemCategory.BadRequest,
      detail: `Idempotency ttlMs must satisfy ${options.constraint}; received ${String(options.receivedValue)}`,
      extensions: {
        field: "ttlMs",
        constraint: options.constraint,
        receivedValue: options.receivedValue,
      },
    });
  }
}

export class IdempotencyReservationNotFoundProblem extends IdempotencyProblem {
  constructor(options: { readonly storageKey: string; readonly reservationId: string }) {
    super({
      code: IDEMPOTENCY_DIAGNOSTIC_CODES.reservationNotFound,
      category: ProblemCategory.Conflict,
      detail: `Idempotency reservation '${options.reservationId}' is no longer active`,
      extensions: {
        storageKey: options.storageKey,
        reservationId: options.reservationId,
      },
    });
  }
}

export class IdempotencyReservationExpiredProblem extends IdempotencyProblem {
  constructor(options: { readonly expiredAt: Date; readonly observedAt: Date }) {
    super({
      code: IDEMPOTENCY_DIAGNOSTIC_CODES.reservationExpired,
      category: ProblemCategory.Conflict,
      detail: "Idempotency reservation ownership expired before completion",
      extensions: {
        expiredAt: options.expiredAt.toISOString(),
        observedAt: options.observedAt.toISOString(),
      },
    });
  }
}

export class IdempotencyReservationStateProblem extends IdempotencyProblem {
  constructor(options: {
    readonly storageKey: string;
    readonly expected: string;
    readonly actual: string;
    readonly reservationId?: string;
  }) {
    super({
      code: IDEMPOTENCY_DIAGNOSTIC_CODES.reservationState,
      category: ProblemCategory.Conflict,
      detail: `Idempotency reservation '${options.storageKey}' is '${options.actual}', expected '${options.expected}'`,
      extensions: {
        storageKey: options.storageKey,
        expected: options.expected,
        actual: options.actual,
        ...(options.reservationId === undefined ? {} : { reservationId: options.reservationId }),
      },
    });
  }
}
