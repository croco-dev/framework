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
