import { Problem, ProblemCategory } from "@croco/problems-core";

export class MissingTenantProblem extends Problem {
  constructor(operation: string) {
    super(
      "MISSING_TENANT",
      ProblemCategory.BadRequest,
      `Tenant context is required for search operation: ${operation}`,
      {
        extensions: { operation },
      },
    );
  }
}

export type SearchSyncIdentityConflictSource =
  | "context.tenantId"
  | "payload.id"
  | "payload.tenantId";

export class SearchSyncIdentityConflictProblem extends Problem {
  constructor(source: SearchSyncIdentityConflictSource) {
    super(
      "search-core/sync-identity-conflict",
      ProblemCategory.Conflict,
      `Search sync identity conflicts with the event envelope: ${source}`,
      {
        extensions: { source },
      },
    );
  }
}

export class TransformNotFoundProblem extends Problem {
  readonly code = "search-core/transform-not-found";
  readonly category = ProblemCategory.NotFound;
  constructor(id: string) {
    super(undefined, undefined, `Transform not found: '${id}'`);
  }
}

export class StrategyUnavailableProblem extends Problem {
  constructor(strategyName: string, reason: string) {
    super(
      "STRATEGY_UNAVAILABLE",
      ProblemCategory.InternalServerError,
      `Search strategy '${strategyName}' is unavailable: ${reason}`,
      {
        extensions: { strategyName, reason },
      },
    );
  }
}

export class IndexNotFoundProblem extends Problem {
  constructor(indexName: string) {
    super("INDEX_NOT_FOUND", ProblemCategory.NotFound, `Search index not found: ${indexName}`, {
      extensions: { indexName },
    });
  }
}

export class SearchCapabilityUnavailableProblem extends Problem {
  constructor(capability: string, engineName: string) {
    super(
      "SEARCH_CAPABILITY_UNAVAILABLE",
      ProblemCategory.NotImplemented,
      `Search engine '${engineName}' does not support capability: ${capability}`,
      {
        extensions: { capability, engineName },
      },
    );
  }
}
