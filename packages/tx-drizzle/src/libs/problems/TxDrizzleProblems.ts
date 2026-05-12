import { Problem, ProblemCategory } from "@croco/problems-core";

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
