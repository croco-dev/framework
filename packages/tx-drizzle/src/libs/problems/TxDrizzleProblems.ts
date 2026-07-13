import { Problem, ProblemCategory } from "@croco/problems-core";

export type RlsConfigurationField = "adminRoles" | "configKey" | "tableName" | "tenantColumn";

/** Invalid static configuration for PostgreSQL row-level security helpers. */
export class RlsConfigurationProblem extends Problem {
  readonly code = "tx-drizzle/rls-configuration-invalid";
  readonly category = ProblemCategory.InternalServerError;

  constructor(field: RlsConfigurationField) {
    super(
      "tx-drizzle/rls-configuration-invalid",
      ProblemCategory.InternalServerError,
      `Invalid RLS configuration field: ${field}`,
      { extensions: { field, retryable: false } },
    );
  }
}

export class TenantContextRequiredProblem extends Problem {
  readonly code = "tx-drizzle/tenant-context-required";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(undefined, undefined, "Tenant context is required");
  }
}

export class RlsExecuteUnsupportedProblem extends Problem {
  readonly code = "tx-drizzle/rls-execute-unsupported";
  readonly category = ProblemCategory.InternalServerError;
  constructor(configKey: string) {
    super(
      undefined,
      undefined,
      `Transaction client does not support execute(), cannot set RLS key '${configKey}'`,
    );
  }
}

export class SavepointUnsupportedProblem extends Problem {
  readonly code = "tx-drizzle/savepoint-unsupported";
  readonly category = ProblemCategory.InternalServerError;
  constructor() {
    super(
      undefined,
      undefined,
      "Transaction client does not support savepoint(), nested transaction requires client.transaction()",
    );
  }
}
