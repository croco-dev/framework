import { Problem, ProblemCategory, type ProblemOptions } from "@croco/problems-core";

export const TENANT_ISOLATION_DIAGNOSTIC_CODES = {
  contextMissing: "tenant-core/isolation-context-missing",
  defaultFallback: "tenant-core/default-tenant-fallback",
  adminBypassReasonRequired: "tenant-core/admin-bypass-reason-required",
  unsafeQuery: "tenant-core/unsafe-query",
  crossTenantLeak: "tenant-core/cross-tenant-leak",
} as const;

export type TenantIsolationDiagnosticCode =
  (typeof TENANT_ISOLATION_DIAGNOSTIC_CODES)[keyof typeof TENANT_ISOLATION_DIAGNOSTIC_CODES];

type TenantIsolationProblemOptions = {
  operation: string;
  detail: string;
  extensions?: Record<string, unknown>;
};

class TenantIsolationProblem extends Problem {
  constructor(
    code: TenantIsolationDiagnosticCode,
    category: ProblemCategory,
    options: TenantIsolationProblemOptions,
  ) {
    const problemOptions: ProblemOptions = {
      extensions: {
        operation: options.operation,
        ...options.extensions,
      },
    };

    super(code, category, options.detail, problemOptions);
  }
}

export class TenantIsolationContextMissingProblem extends TenantIsolationProblem {
  constructor(operation: string) {
    super(TENANT_ISOLATION_DIAGNOSTIC_CODES.contextMissing, ProblemCategory.Unauthorized, {
      operation,
      detail: `Tenant context is required for tenant-scoped operation '${operation}'`,
    });
  }
}

export class TenantDefaultFallbackProblem extends TenantIsolationProblem {
  constructor(operation: string, tenantId: string) {
    super(TENANT_ISOLATION_DIAGNOSTIC_CODES.defaultFallback, ProblemCategory.BadRequest, {
      operation,
      detail: `Tenant-scoped operation '${operation}' attempted to use unsafe default tenant '${tenantId}'`,
      extensions: {
        tenantId,
      },
    });
  }
}

export class TenantAdminBypassReasonRequiredProblem extends TenantIsolationProblem {
  constructor(operation: string) {
    super(TENANT_ISOLATION_DIAGNOSTIC_CODES.adminBypassReasonRequired, ProblemCategory.Forbidden, {
      operation,
      detail: `Admin/system tenant bypass for operation '${operation}' requires an explicit reason`,
    });
  }
}

export class TenantUnsafeQueryProblem extends TenantIsolationProblem {
  constructor(operation: string, reason: string, extensions: Record<string, unknown> = {}) {
    super(TENANT_ISOLATION_DIAGNOSTIC_CODES.unsafeQuery, ProblemCategory.Forbidden, {
      operation,
      detail: `Unsafe tenant query for operation '${operation}': ${reason}`,
      extensions,
    });
  }
}

export class TenantCrossTenantLeakProblem extends TenantIsolationProblem {
  constructor(operation: string, tenantId: string, leakedTenantId: string) {
    super(TENANT_ISOLATION_DIAGNOSTIC_CODES.crossTenantLeak, ProblemCategory.InternalServerError, {
      operation,
      detail: `Tenant isolation leak detected in '${operation}': expected '${tenantId}', got '${leakedTenantId}'`,
      extensions: {
        expectedTenantId: tenantId,
        leakedTenantId,
      },
    });
  }
}
