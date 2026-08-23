import { Problem, ProblemCategory } from "@croco/problems-core";

import type { SearchableIndexDeclaration } from "../decorators/SearchableTypes";

export class SearchableIndexConflictProblem extends Problem {
  constructor(indexName: string, declarations: readonly SearchableIndexDeclaration[]) {
    super(
      "search-core/searchable-index-conflict",
      ProblemCategory.Conflict,
      `Searchable index '${indexName}' has multiple declarations`,
      {
        extensions: {
          indexName,
          declarations: [...declarations].sort(compareSearchableIndexDeclarations),
        },
      },
    );
  }
}

function compareSearchableIndexDeclarations(
  left: SearchableIndexDeclaration,
  right: SearchableIndexDeclaration,
): number {
  const leftLocation = left.sourceLocation;
  const rightLocation = right.sourceLocation;
  const pathOrder = (leftLocation?.path ?? "").localeCompare(rightLocation?.path ?? "");
  if (pathOrder !== 0) return pathOrder;

  const lineOrder = (leftLocation?.line ?? 0) - (rightLocation?.line ?? 0);
  if (lineOrder !== 0) return lineOrder;

  const columnOrder = (leftLocation?.column ?? 0) - (rightLocation?.column ?? 0);
  return columnOrder === 0 ? left.targetName.localeCompare(right.targetName) : columnOrder;
}

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
