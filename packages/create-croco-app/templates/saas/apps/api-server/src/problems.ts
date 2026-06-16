import { Problem, ProblemCategory } from "@croco/problems-core";

export class DemoEndpointDisabledProblem extends Problem {
  readonly code = "saas-demo/demo-endpoint-disabled";
  readonly category = ProblemCategory.Forbidden;

  constructor() {
    super(undefined, undefined, "SaaS demo endpoints are disabled in production.");
  }
}

export class InvalidPortProblem extends Problem {
  readonly code = "saas-demo/invalid-port";
  readonly category = ProblemCategory.ValidationError;

  constructor(value: string | undefined) {
    super(
      undefined,
      undefined,
      `PORT must be an integer between 1 and 65535. Received: ${value ?? "unset"}.`,
    );
  }
}

export class TenantAlreadyExistsProblem extends Problem {
  readonly code = "saas-demo/tenant-already-exists";
  readonly category = ProblemCategory.Conflict;

  constructor(tenantId: string) {
    super(undefined, undefined, `Tenant ${tenantId} already exists.`);
  }
}

export class TenantNotFoundProblem extends Problem {
  readonly code = "saas-demo/tenant-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(tenantId: string) {
    super(undefined, undefined, `Tenant ${tenantId} not found.`);
  }
}

export class SaasDemoSmokeProblem extends Problem {
  readonly code = "saas-demo/smoke-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(failures: readonly string[]) {
    super(undefined, undefined, `SaaS demo smoke failed: ${failures.join("; ")}`);
  }
}
