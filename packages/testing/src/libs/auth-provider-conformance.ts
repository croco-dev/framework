import * as assert from "node:assert/strict";
import type { AuthUser } from "@croco/auth-core";
import type { HealthStatus } from "@croco/diagnostics-core";
import { Problem } from "@croco/problems-core";
import type { ProblemCategory } from "@croco/problems-core";

export type AuthProviderConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type AuthProviderProblemExpectation = {
  readonly category?: ProblemCategory;
  readonly code: string;
  readonly retryable?: boolean;
  run(): Promise<unknown> | unknown;
};

export type AuthProviderCredentialFailureExpectation =
  | {
      readonly allowNull: true;
      readonly problem?: AuthProviderProblemExpectation;
      run(): Promise<AuthUser | null> | AuthUser | null;
    }
  | ({
      readonly allowNull?: false;
    } & AuthProviderProblemExpectation);

export type AuthProviderAuthConformance = {
  readonly expectedUser: AuthUser;
  authenticateValid(): Promise<AuthUser | null> | AuthUser | null;
  authenticateMissingCredentials(): Promise<AuthUser | null> | AuthUser | null;
  readonly invalidCredentials: AuthProviderCredentialFailureExpectation;
  readonly malformedPayload: AuthProviderProblemExpectation;
  readonly upstreamFailure: AuthProviderProblemExpectation;
};

export type AuthProviderWebhookConformance = {
  processValid(): Promise<void> | void;
  readonly invalidPayload?: AuthProviderProblemExpectation;
  readonly invalidSignature: AuthProviderProblemExpectation;
};

export type AuthProviderTenantMappingEvidence = {
  readonly expectedTenantId?: string;
  readonly expectedUserMetadata?: Record<string, unknown>;
  readonly externalOrgId: string;
  readonly resolvedTenantId?: string | null;
  readonly unknownResolvedTenantId?: string | null;
  readonly userMetadata?: Record<string, unknown>;
};

export type AuthProviderTenantMappingConformance = {
  createEvidence(): Promise<AuthProviderTenantMappingEvidence> | AuthProviderTenantMappingEvidence;
};

export type AuthProviderReadinessConformance = {
  createMissingConfigHealth(): Promise<HealthStatus> | HealthStatus;
  createReadyHealth?(): Promise<HealthStatus> | HealthStatus;
  readonly requiredEnv: readonly string[];
};

export type AuthProviderLiveSmokeGate = {
  readonly requiredEnv: readonly string[];
  readonly isEnabled?: () => boolean;
  readonly run?: () => Promise<void>;
};

export type AuthProviderConformanceOptions = {
  readonly auth: AuthProviderAuthConformance;
  readonly liveSmoke?: AuthProviderLiveSmokeGate;
  readonly providerName: string;
  readonly readiness: AuthProviderReadinessConformance;
  readonly secretSamples?: readonly string[];
  readonly tenantMapping?: AuthProviderTenantMappingConformance;
  readonly webhooks: AuthProviderWebhookConformance;
};

export type AuthProviderConformanceSuite = {
  readonly cases: readonly AuthProviderConformanceCase[];
  readonly liveSmoke?: AuthProviderLiveSmokeGate;
};

export function createAuthProviderConformanceSuite(
  options: AuthProviderConformanceOptions,
): AuthProviderConformanceSuite {
  const cases: AuthProviderConformanceCase[] = [
    {
      name: "authenticates valid credentials into the Croco AuthUser contract",
      run: async () => {
        const user = await options.auth.authenticateValid();

        assert.deepEqual(
          user,
          options.auth.expectedUser,
          `${options.providerName} must map valid credentials to the expected AuthUser contract.`,
        );
      },
    },
    {
      name: "treats missing credentials as unauthenticated without throwing",
      run: async () => {
        const user = await options.auth.authenticateMissingCredentials();

        assert.equal(
          user,
          null,
          `${options.providerName} must return null for missing credentials.`,
        );
      },
    },
    {
      name: "maps invalid credentials to a stable auth failure contract",
      run: async () => {
        await assertCredentialFailure(options.auth.invalidCredentials, options);
      },
    },
    {
      name: "maps malformed provider payloads to stable Croco Problems",
      run: async () => {
        await assertProblemFromAction(options.auth.malformedPayload, options);
      },
    },
    {
      name: "surfaces upstream auth failures as redacted Croco Problems",
      run: async () => {
        await assertProblemFromAction(options.auth.upstreamFailure, options);
      },
    },
    {
      name: "processes valid webhooks through provider handlers",
      run: async () => {
        await options.webhooks.processValid();
      },
    },
    {
      name: "rejects invalid webhook signatures with stable Croco Problems",
      run: async () => {
        await assertProblemFromAction(options.webhooks.invalidSignature, options);
      },
    },
    {
      name: "reports missing auth configuration without leaking secrets",
      run: async () => {
        const health = await options.readiness.createMissingConfigHealth();

        assert.equal(
          health.status,
          "unhealthy",
          `${options.providerName} must report missing configuration as unhealthy.`,
        );
        assertRequiredEnvEvidence(health, options.readiness.requiredEnv, options.providerName);
        assertNoSecretLeak(JSON.stringify(health), options.secretSamples);
      },
    },
  ];

  const invalidWebhookPayload = options.webhooks.invalidPayload;
  if (invalidWebhookPayload) {
    cases.push({
      name: "rejects malformed webhook payloads with stable Croco Problems",
      run: async () => {
        await assertProblemFromAction(invalidWebhookPayload, options);
      },
    });
  }

  const tenantMapping = options.tenantMapping;
  if (tenantMapping) {
    cases.push({
      name: "maps provider organization identity to Croco tenant evidence",
      run: async () => {
        const evidence = await tenantMapping.createEvidence();

        assert.ok(evidence, `${options.providerName} must provide tenant mapping evidence.`);
        assertNonEmpty(
          evidence.externalOrgId,
          `${options.providerName} tenant mapping evidence requires externalOrgId.`,
        );

        if (evidence.expectedTenantId !== undefined) {
          assert.equal(
            evidence.resolvedTenantId,
            evidence.expectedTenantId,
            `${options.providerName} must resolve the provider org to the expected Croco tenant.`,
          );
        }

        if (evidence.unknownResolvedTenantId !== undefined) {
          assert.equal(
            evidence.unknownResolvedTenantId,
            null,
            `${options.providerName} must return null for unmapped provider organizations.`,
          );
        }

        if (evidence.expectedUserMetadata) {
          assert.ok(
            evidence.userMetadata,
            `${options.providerName} must expose provider organization evidence in AuthUser metadata.`,
          );
          for (const [key, expected] of Object.entries(evidence.expectedUserMetadata)) {
            assert.deepEqual(
              evidence.userMetadata?.[key],
              expected,
              `${options.providerName} AuthUser metadata '${key}' must match provider organization evidence.`,
            );
          }
        }
      },
    });
  }

  const createReadyHealth = options.readiness.createReadyHealth;
  if (createReadyHealth) {
    cases.push({
      name: "reports ready auth configuration without exposing secret values",
      run: async () => {
        const health = await createReadyHealth();

        assert.equal(
          health?.status,
          "healthy",
          `${options.providerName} must report complete configuration as healthy.`,
        );
        assertNoSecretLeak(JSON.stringify(health), options.secretSamples);
      },
    });
  }

  if (options.liveSmoke) {
    cases.push(createOptionalLiveSmokeCase(options.providerName, options.liveSmoke));
  }

  return {
    cases,
    ...(options.liveSmoke ? { liveSmoke: options.liveSmoke } : {}),
  };
}

async function assertCredentialFailure(
  expectation: AuthProviderCredentialFailureExpectation,
  options: Pick<AuthProviderConformanceOptions, "providerName" | "secretSamples">,
): Promise<void> {
  if (expectation.allowNull !== true) {
    await assertProblemFromAction(expectation, options);
    return;
  }

  let thrown: unknown;
  let user: AuthUser | null | undefined;

  try {
    user = await expectation.run();
  } catch (error) {
    thrown = error;
  }

  if (thrown) {
    assert.ok(
      expectation.problem,
      `${options.providerName} invalid credentials that throw must declare the expected Problem contract.`,
    );
    const problemExpectation = expectation.problem;
    assertProblem(thrown, problemExpectation, options);
    return;
  }

  assert.equal(user, null, `${options.providerName} must return null for invalid credentials.`);
}

async function assertProblemFromAction(
  expectation: AuthProviderProblemExpectation,
  options: Pick<AuthProviderConformanceOptions, "providerName" | "secretSamples">,
): Promise<Problem> {
  let thrown: unknown;

  try {
    await expectation.run();
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown, `${options.providerName} must throw a Croco Problem.`);
  return assertProblem(thrown, expectation, options);
}

function assertProblem(
  thrown: unknown,
  expectation: AuthProviderProblemExpectation,
  options: Pick<AuthProviderConformanceOptions, "providerName" | "secretSamples">,
): Problem {
  assert.ok(thrown instanceof Problem, `${options.providerName} must throw a Croco Problem.`);

  const problem = thrown as Problem;
  assert.equal(
    problem.code,
    expectation.code,
    `${options.providerName} must expose stable Problem code '${expectation.code}'.`,
  );

  if (expectation.category !== undefined) {
    assert.equal(
      problem.category,
      expectation.category,
      `${options.providerName} Problem '${expectation.code}' must expose the expected category.`,
    );
  }

  if (expectation.retryable !== undefined) {
    assert.equal(
      problem.extensions?.retryable,
      expectation.retryable,
      `${options.providerName} Problem '${expectation.code}' must expose retryable=${String(
        expectation.retryable,
      )}.`,
    );
  }

  assertNoSecretLeak(JSON.stringify(problem.toJSON()), options.secretSamples);
  assertNoSecretLeak(problem.message, options.secretSamples);
  assertNoSecretLeak(problem.cause?.message ?? "", options.secretSamples);
  assertNoSecretLeak(problem.cause?.stack ?? "", options.secretSamples);

  return problem;
}

function createOptionalLiveSmokeCase(
  providerName: string,
  gate: AuthProviderLiveSmokeGate,
): AuthProviderConformanceCase {
  return {
    name: "keeps live auth smoke optional and skipped unless explicitly env-gated",
    run: async () => {
      assert.ok(
        gate.requiredEnv.length > 0,
        `${providerName} live smoke gate must declare required environment variables.`,
      );

      const enabled = gate.isEnabled
        ? gate.isEnabled()
        : gate.requiredEnv.every((name) => process.env[name]);
      if (!enabled) {
        return;
      }

      assert.ok(gate.run, `${providerName} live smoke gate is enabled but has no run hook.`);
      await gate.run();
    },
  };
}

function assertRequiredEnvEvidence(
  health: HealthStatus,
  requiredEnv: readonly string[],
  providerName: string,
): void {
  assert.ok(requiredEnv.length > 0, `${providerName} readiness must declare required env names.`);

  const serialized = JSON.stringify(health);
  for (const envName of requiredEnv) {
    assert.ok(
      serialized.includes(envName),
      `${providerName} readiness report must include required env '${envName}'.`,
    );
  }
}

function assertNoSecretLeak(value: string, secretSamples: readonly string[] | undefined): void {
  for (const secret of secretSamples ?? []) {
    if (!secret) {
      continue;
    }
    assert.equal(
      value.includes(secret),
      false,
      `Conformance evidence must not leak secret sample '${secret}'.`,
    );
  }
}

function assertNonEmpty(value: string, message: string): void {
  assert.ok(value.trim().length > 0, message);
}
