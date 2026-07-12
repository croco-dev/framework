import { Problem, ProblemCategory, type ProblemOptions } from "@croco/problems-core";

export const IDEMPOTENCY_DIAGNOSTIC_CODES = {
  keyConflict: "idempotency-core/key-conflict",
  invalidKey: "idempotency-core/invalid-key",
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
};

class IdempotencyProblem extends Problem {
  constructor(options: IdempotencyProblemOptions) {
    const problemOptions: ProblemOptions = {
      extensions: options.extensions,
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
        reservationId: options.reservationId,
      },
    });
  }
}
