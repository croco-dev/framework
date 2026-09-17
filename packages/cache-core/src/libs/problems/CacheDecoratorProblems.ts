import { Problem, ProblemCategory } from "@croco/problems-core";

type CacheInvalidationProblemOperation = {
  readonly id?: string;
  readonly key?: string;
  readonly kind: string;
  readonly pattern?: string;
  readonly tag?: string;
};

export type CacheInvalidationFailure = {
  readonly adapterName: string;
  readonly causeCode?: string;
  readonly causeMessage: string;
  readonly eventName: string;
  readonly operation: CacheInvalidationProblemOperation;
};

export class CacheDecoratorConfigProblem extends Problem {
  readonly code = "cache-core/invalid-decorator-config";
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string) {
    super(undefined, undefined, detail);
  }
}

/** Reports an argument graph that cannot be encoded into a deterministic decorator cache key. */
export class CacheKeyArgumentProblem extends Problem {
  readonly code = "cache-core/cache-key-argument-unsupported";
  readonly category = ProblemCategory.ValidationError;

  constructor(
    readonly path: string,
    readonly reason: string,
  ) {
    super(
      "cache-core/cache-key-argument-unsupported",
      ProblemCategory.ValidationError,
      `Cache key argument at '${path}' ${reason}.`,
      { extensions: { path, reason } },
    );
  }
}

export type CacheInvalidationDiagnostic = {
  readonly code: string;
  readonly message: string;
  readonly target: string;
};

export class CacheInvalidationGraphProblem extends Problem {
  readonly code = "cache-core/invalidation-graph-invalid";
  readonly category = ProblemCategory.ValidationError;

  constructor(readonly diagnostics: readonly CacheInvalidationDiagnostic[]) {
    super(
      "cache-core/invalidation-graph-invalid",
      ProblemCategory.ValidationError,
      `Cache invalidation graph has ${diagnostics.length} diagnostic(s).`,
      { extensions: { diagnostics } },
    );
  }
}

export class UnknownCacheInvalidationEventProblem extends Problem {
  readonly code = "cache-core/invalidation-event-unknown";
  readonly category = ProblemCategory.ValidationError;

  constructor(readonly eventName: string) {
    super(
      "cache-core/invalidation-event-unknown",
      ProblemCategory.ValidationError,
      `Cache invalidation event '${eventName}' is not declared in the manifest.`,
      { extensions: { eventName } },
    );
  }
}

export class UnsupportedCacheInvalidationCapabilityProblem extends Problem {
  readonly code = "cache-core/invalidation-capability-unsupported";
  readonly category = ProblemCategory.InternalServerError;

  constructor(
    readonly adapterName: string,
    readonly operation: CacheInvalidationProblemOperation,
  ) {
    super(
      "cache-core/invalidation-capability-unsupported",
      ProblemCategory.InternalServerError,
      `Cache adapter '${adapterName}' does not support ${operation.kind} invalidation.`,
      { extensions: { adapterName, operation } },
    );
  }
}

export class CacheInvalidationFailedProblem extends Problem {
  readonly code = "cache-core/invalidation-failed";
  readonly category = ProblemCategory.InternalServerError;
  readonly failures: readonly CacheInvalidationFailure[];

  constructor(
    readonly eventName: string,
    readonly adapterName: string,
    readonly operation: CacheInvalidationProblemOperation,
    cause: unknown,
    additionalFailures: readonly CacheInvalidationFailure[] = [],
  ) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    const causeCode = cause instanceof Problem ? cause.code : undefined;
    const failure = {
      adapterName,
      ...(causeCode === undefined ? {} : { causeCode }),
      causeMessage,
      eventName,
      operation,
    };
    const failures = [failure, ...additionalFailures];
    super(
      "cache-core/invalidation-failed",
      ProblemCategory.InternalServerError,
      failures.length === 1
        ? `Cache invalidation for event '${eventName}' failed at ${operation.kind} operation '${operation.id ?? ""}'.`
        : `Cache invalidation for event '${eventName}' failed for ${failures.length} operations.`,
      {
        cause: cause instanceof Error ? cause : undefined,
        extensions: {
          adapterName,
          ...(causeCode === undefined ? {} : { causeCode }),
          causeMessage,
          eventName,
          operation,
        },
      },
    );
    this.failures = failures;
  }
}

export class CacheInvalidationAssertionProblem extends Problem {
  readonly code = "cache-core/invalidation-assertion-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(detail: string) {
    super("cache-core/invalidation-assertion-failed", ProblemCategory.InternalServerError, detail);
  }
}
