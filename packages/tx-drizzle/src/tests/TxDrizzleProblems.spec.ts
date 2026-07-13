import { ProblemCategory } from "@croco/problems-core";
import { describe, expect, it } from "vitest";
import {
  RlsConfigurationProblem,
  RlsExecuteUnsupportedProblem,
  SavepointUnsupportedProblem,
  TenantContextRequiredProblem,
} from "../libs/problems/TxDrizzleProblems";

describe("TxDrizzleProblems", () => {
  it("should create value-redacted RlsConfigurationProblem metadata", () => {
    const problem = new RlsConfigurationProblem("configKey");

    expect(problem.code).toBe("tx-drizzle/rls-configuration-invalid");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("Invalid RLS configuration field: configKey");
    expect(problem.extensions).toEqual({ field: "configKey", retryable: false });
    expect(problem.toJSON()).toMatchObject({
      code: "tx-drizzle/rls-configuration-invalid",
      field: "configKey",
      retryable: false,
    });
  });

  it("should create TenantContextRequiredProblem with expected metadata", () => {
    const problem = new TenantContextRequiredProblem();

    expect(problem.code).toBe("tx-drizzle/tenant-context-required");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe("Tenant context is required");
  });

  it("should create RlsExecuteUnsupportedProblem with expected metadata", () => {
    const problem = new RlsExecuteUnsupportedProblem("app.current_tenant");

    expect(problem.code).toBe("tx-drizzle/rls-execute-unsupported");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe(
      "Transaction client does not support execute(), cannot set RLS key 'app.current_tenant'",
    );
  });

  it("should create SavepointUnsupportedProblem with expected metadata", () => {
    const problem = new SavepointUnsupportedProblem();

    expect(problem.code).toBe("tx-drizzle/savepoint-unsupported");
    expect(problem.category).toBe(ProblemCategory.InternalServerError);
    expect(problem.detail).toBe(
      "Transaction client does not support savepoint(), nested transaction requires client.transaction()",
    );
  });
});
