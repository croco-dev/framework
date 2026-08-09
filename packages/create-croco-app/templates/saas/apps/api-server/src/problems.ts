import { Problem, ProblemCategory } from "@croco/problems-core";

export class DemoEndpointDisabledProblem extends Problem {
  readonly code = "saas-demo/demo-endpoint-disabled";
  readonly category = ProblemCategory.Forbidden;

  constructor() {
    super(
      undefined,
      undefined,
      "SaaS demo endpoints require SAAS_DEMO_ENDPOINTS_ENABLED=true and remain disabled in production.",
    );
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

export class InvalidJobsQueryProblem extends Problem {
  readonly code = "saas-demo/invalid-jobs-query";
  readonly category = ProblemCategory.ValidationError;

  constructor(name: string, value: string) {
    super(undefined, undefined, `Invalid jobs ${name}: ${value}.`);
  }
}

export class JobNotFoundProblem extends Problem {
  readonly code = "saas-demo/job-not-found";
  readonly category = ProblemCategory.NotFound;

  constructor(jobId: string) {
    super(undefined, undefined, `Job ${jobId} not found.`);
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

export class SaasBillableUsageProblem extends Problem {
  readonly code = "saas-demo/billable-usage-failed";
  readonly category = ProblemCategory.InternalServerError;

  constructor(message: string) {
    super(undefined, undefined, message);
  }
}

export class SqliteFixtureStateProblem extends Problem {
  readonly code = "saas-demo/sqlite-fixture-state-invalid";
  readonly category = ProblemCategory.InternalServerError;

  constructor() {
    super(undefined, undefined, "SQLite fixture state must be an object.");
  }
}
