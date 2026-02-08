import { Problem, ProblemCategory } from '@croco/problems-core';

export class MissingTenantProblem extends Problem {
  constructor(operation: string) {
    super(
      'MISSING_TENANT',
      ProblemCategory.BadRequest,
      `Tenant context is required for search operation: ${operation}`,
      {
        extensions: { operation },
      }
    );
  }
}

export class TransformNotFoundProblem extends Problem {
  constructor(transformId: string) {
    super('TRANSFORM_NOT_FOUND', ProblemCategory.NotFound, `Search transform not found: ${transformId}`, {
      extensions: { transformId },
    });
  }
}

export class StrategyUnavailableProblem extends Problem {
  constructor(strategyName: string, reason: string) {
    super(
      'STRATEGY_UNAVAILABLE',
      ProblemCategory.InternalServerError,
      `Search strategy '${strategyName}' is unavailable: ${reason}`,
      {
        extensions: { strategyName, reason },
      }
    );
  }
}

export class IndexNotFoundProblem extends Problem {
  constructor(indexName: string) {
    super('INDEX_NOT_FOUND', ProblemCategory.NotFound, `Search index not found: ${indexName}`, {
      extensions: { indexName },
    });
  }
}
