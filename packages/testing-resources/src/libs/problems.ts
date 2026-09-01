import { Problem, ProblemCategory } from "@croco/problems-core";
import type { TestResourceDiagnosticStage } from "@croco/testing";

export type TestResourceLiveDependencyRequirement =
  | {
      readonly dependency: "pg" | "testcontainers";
      readonly resourceKind: "postgresql";
    }
  | {
      readonly dependency: "ioredis" | "testcontainers";
      readonly resourceKind: "redis";
    };
export type TestResourceLiveDependency = TestResourceLiveDependencyRequirement["dependency"];

const LIVE_DEPENDENCY_CONTRACTS = {
  postgresql: {
    installCommand: "pnpm add -D pg@8.22.0 testcontainers@12.0.4",
    label: "PostgreSQL",
  },
  redis: {
    installCommand: "pnpm add -D ioredis@5.11.1 testcontainers@12.0.4",
    label: "Redis",
  },
} as const;

const TEST_RESOURCE_LIFECYCLE_PROBLEM_METADATA = {
  startup: {
    code: "testing-resources/startup-failed",
    category: ProblemCategory.InternalServerError,
  },
  migration: {
    code: "testing-resources/migration-failed",
    category: ProblemCategory.InternalServerError,
  },
  "health-check": {
    code: "testing-resources/health-check-failed",
    category: ProblemCategory.InternalServerError,
  },
  cleanup: {
    code: "testing-resources/cleanup-failed",
    category: ProblemCategory.InternalServerError,
  },
} as const;

export class TestResourceConfigurationProblem extends Problem {
  constructor(message: string, extensions: Record<string, unknown> = {}) {
    super("testing-resources/invalid-configuration", ProblemCategory.InternalServerError, message, {
      extensions,
    });
  }
}

/**
 * Reports the optional live-resource driver that must be installed before retrying a test.
 *
 * The matching exact install command is available in `extensions.installCommand`.
 */
export class TestResourceMissingDependencyProblem extends Problem {
  constructor(
    resourceId: string,
    requirement: TestResourceLiveDependencyRequirement,
    cause?: Error,
  ) {
    const { dependency, resourceKind } = requirement;
    const contract = LIVE_DEPENDENCY_CONTRACTS[resourceKind];
    const recovery = `Run "${contract.installCommand}" and retry the live-resource test.`;

    super(
      "testing-resources/missing-live-dependency",
      ProblemCategory.InternalServerError,
      `${contract.label} test resource '${resourceId}' requires optional peer dependency '${dependency}'. ${recovery}`,
      {
        extensions: {
          dependency,
          installCommand: contract.installCommand,
          recovery,
          resourceId,
          resourceKind,
        },
        ...(cause ? { cause } : {}),
      },
    );
  }
}

export class TestResourceLifecycleProblem extends Problem {
  constructor(
    resourceId: string,
    stage: TestResourceDiagnosticStage,
    message: string,
    logs: readonly string[],
    cause?: unknown,
    failures?: readonly unknown[],
  ) {
    super(
      codeFor(stage),
      TEST_RESOURCE_LIFECYCLE_PROBLEM_METADATA[stage].category,
      `Test resource '${resourceId}' ${stage} failed: ${message}`,
      {
        extensions: {
          logs: logs.slice(-200),
          recovery: recoveryFor(stage),
          resourceId,
          stage,
          ...(failures
            ? {
                failureCount: failures.length,
                failures: failures.map(failureEvidence),
              }
            : {}),
        },
        ...(cause === undefined ? {} : { cause: toError(cause) }),
      },
    );
  }
}

function failureEvidence(error: unknown): Record<string, unknown> {
  if (error instanceof Problem) {
    return {
      ...error.toJSON(),
      message: error.message,
      name: error.name,
    };
  }

  const failure = toError(error);
  return {
    message: failure.message,
    name: failure.name,
  };
}

function codeFor(stage: TestResourceDiagnosticStage): string {
  return TEST_RESOURCE_LIFECYCLE_PROBLEM_METADATA[stage].code;
}

function recoveryFor(stage: TestResourceDiagnosticStage): string {
  switch (stage) {
    case "startup":
      return "Confirm Docker is running, the pinned image is available, and the configured startup timeout is sufficient.";
    case "migration":
      return "Inspect the retained resource logs and migration SQL, then recreate the ephemeral resource from an empty database.";
    case "health-check":
      return "Inspect the retained resource logs and verify the container port and authentication configuration.";
    case "cleanup":
      return "Inspect the retained resource logs, stop the named container if it remains, and restart Docker before retrying.";
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
