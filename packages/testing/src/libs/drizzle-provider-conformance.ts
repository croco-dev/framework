import * as assert from "node:assert/strict";
import { Problem, type ProblemCategory } from "@croco/problems-core";

export type DrizzleProviderConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type DrizzleProviderConformanceCheck = {
  readonly name: string;
  run(): Promise<void>;
};

export type DrizzleProviderConformanceCapability =
  | {
      readonly supported: true;
      readonly checks: readonly DrizzleProviderConformanceCheck[];
    }
  | {
      readonly supported: false;
      readonly reason: string;
    };

export type DrizzleProviderRepositoryErrorConformance = {
  readonly notFound: DrizzleProviderConformanceCapability;
  readonly validation: DrizzleProviderConformanceCapability;
  readonly duplicate: DrizzleProviderConformanceCapability;
  readonly conflict: DrizzleProviderConformanceCapability;
  readonly retryableFailure: DrizzleProviderConformanceCapability;
};

export type DrizzleProviderTransactionConformance = {
  readonly participation: DrizzleProviderConformanceCapability;
  readonly rollback: DrizzleProviderConformanceCapability;
};

export type DrizzleProviderConformanceOptions = {
  readonly providerName: string;
  readonly schema: DrizzleProviderConformanceCapability;
  readonly transaction: DrizzleProviderTransactionConformance;
  readonly tenantIsolation: DrizzleProviderConformanceCapability;
  readonly repositoryErrors: DrizzleProviderRepositoryErrorConformance;
};

export type DrizzleProviderConformanceSuite = {
  readonly cases: readonly DrizzleProviderConformanceCase[];
};

export type DrizzleProblemExpectation = {
  readonly code: string;
  readonly category?: ProblemCategory;
  readonly status?: number;
};

type CapabilityEntry = {
  readonly label: string;
  readonly capability: DrizzleProviderConformanceCapability;
};

export function createDrizzleProviderConformanceSuite(
  options: DrizzleProviderConformanceOptions,
): DrizzleProviderConformanceSuite {
  assertNonEmpty(options.providerName, "Drizzle provider conformance requires providerName.");

  const capabilities: readonly CapabilityEntry[] = [
    {
      label: "schema and migration assumptions",
      capability: options.schema,
    },
    {
      label: "transaction participation",
      capability: options.transaction.participation,
    },
    {
      label: "transaction rollback",
      capability: options.transaction.rollback,
    },
    {
      label: "tenant isolation",
      capability: options.tenantIsolation,
    },
    {
      label: "not-found error semantics",
      capability: options.repositoryErrors.notFound,
    },
    {
      label: "validation error semantics",
      capability: options.repositoryErrors.validation,
    },
    {
      label: "duplicate error semantics",
      capability: options.repositoryErrors.duplicate,
    },
    {
      label: "conflict error semantics",
      capability: options.repositoryErrors.conflict,
    },
    {
      label: "retryable failure semantics",
      capability: options.repositoryErrors.retryableFailure,
    },
  ];

  return {
    cases: capabilities.flatMap(({ label, capability }) =>
      toCapabilityCases(options.providerName, label, capability),
    ),
  };
}

export async function assertDrizzleProblem(
  operation: () => unknown | Promise<unknown>,
  expectation: DrizzleProblemExpectation,
): Promise<Problem> {
  try {
    await operation();
  } catch (error) {
    assert.ok(
      error instanceof Problem,
      `Expected Croco Problem '${expectation.code}', received ${formatError(error)}.`,
    );
    assert.equal(error.code, expectation.code);

    if (expectation.category !== undefined) {
      assert.equal(error.category, expectation.category);
    }

    if (expectation.status !== undefined) {
      assert.equal(error.status, expectation.status);
    }

    return error;
  }

  assert.fail(`Expected Croco Problem '${expectation.code}' but operation resolved.`);
}

function toCapabilityCases(
  providerName: string,
  label: string,
  capability: DrizzleProviderConformanceCapability,
): DrizzleProviderConformanceCase[] {
  if (!capability.supported) {
    return [
      {
        name: `${providerName}: documents unsupported ${label}`,
        run: async () => {
          assertNonEmpty(
            capability.reason,
            `${providerName} must document why ${label} is unsupported.`,
          );
        },
      },
    ];
  }

  assert.ok(capability.checks.length > 0, `${providerName} must define ${label} checks.`);

  return capability.checks.map((check) => {
    assertNonEmpty(check.name, `${providerName} has an unnamed ${label} check.`);

    return {
      name: `${providerName}: ${label}: ${check.name}`,
      run: check.run,
    };
  });
}

function assertNonEmpty(value: string, message: string): void {
  assert.ok(value.trim().length > 0, message);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}
