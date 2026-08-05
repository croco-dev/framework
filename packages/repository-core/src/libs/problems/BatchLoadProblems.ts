import { Problem, ProblemCategory } from "@croco/problems-core";

export class BatchLoaderFactoryNotRegisteredProblem extends Problem {
  readonly code = "repository-core/batch-loader-factory-not-registered";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super(
      undefined,
      undefined,
      "BatchLoad requires an IBatchLoaderFactory to be registered with BATCH_LOADER_FACTORY_TOKEN",
    );
  }
}

export class BatchLoaderFactoryResolutionProblem extends Problem {
  readonly code = "repository-core/batch-loader-factory-resolution-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(message: string) {
    super(undefined, undefined, `Failed to resolve IBatchLoaderFactory for BatchLoad: ${message}`);
  }
}

/**
 * Raised when one explicit BatchLoad name is reused by different decorated methods or repository scopes.
 */
export class BatchLoaderScopeCollisionProblem extends Problem {
  readonly code = "repository-core/batch-loader-scope-collision";
  readonly category = ProblemCategory.InternalServerError;

  constructor(name: string) {
    super(
      undefined,
      undefined,
      `BatchLoad name '${name}' is already claimed by a different method or repository scope`,
    );
  }
}

/** Raised when findByIds returns an entry without an explicit key and value. */
export class BatchLoadUnkeyedResultProblem extends Problem {
  readonly code = "repository-core/batch-load-result-unkeyed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(index: number) {
    super(
      undefined,
      undefined,
      `BatchLoad findByIds result at index ${index} must contain a key and value`,
    );
  }
}

/** Raised when findByIds returns the same requested key more than once. */
export class BatchLoadDuplicateResultKeyProblem extends Problem {
  readonly code = "repository-core/batch-load-result-key-duplicate";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super(undefined, undefined, "BatchLoad findByIds returned the same result key more than once");
  }
}

/** Raised when findByIds returns a key that was not included in the batch request. */
export class BatchLoadUnexpectedResultKeyProblem extends Problem {
  readonly code = "repository-core/batch-load-result-key-unexpected";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super(undefined, undefined, "BatchLoad findByIds returned a result key that was not requested");
  }
}

/** Raised when a result's explicit key disagrees with the configured entity identity field. */
export class BatchLoadResultIdentityMismatchProblem extends Problem {
  readonly code = "repository-core/batch-load-result-identity-mismatch";
  readonly category = ProblemCategory.InternalServerError;

  constructor(identityField: string) {
    super(
      undefined,
      undefined,
      `BatchLoad findByIds result value must expose '${identityField}' matching its explicit key`,
    );
  }
}
