import { describe, expect, it } from "vitest";
import * as testingEntrypoint from "@croco/testing";
import {
  createAuthProviderConformanceSuite,
  createBillingProviderConformanceSuite,
  createLlmProviderConformanceSuite,
  createProviderConformanceMatrixSuite,
  createProviderNoCredentialConformanceSuite,
  createQStashBatchConformanceSuite,
  createQStashTaskConformanceSuite,
  createQStashTriggerConformanceSuite,
  createStorageProviderConformanceSuite,
  createUpstashRedisMeteringConformanceSuite,
  createUpstashRedisRateLimitConformanceSuite,
  type AuthProviderTenantMappingEvidence,
  type FailureDrillEvidenceRecord,
  type ProviderConformanceCapabilityManifest,
  type QStashBatchPublishRecord,
  type QStashTaskPublishRecord,
  type QStashTriggerScheduleRecord,
  type QStashTriggerSyncDetail,
} from "@croco/testing";
import * as drizzleEntrypoint from "@croco/testing/drizzle";
import { createDrizzleProviderConformanceSuite } from "@croco/testing/drizzle";

// These package tests resolve public specifiers to source; package-entrypoints:smoke covers built CJS/ESM/types consumers.
type SuiteWithNamedCases = {
  readonly cases: readonly {
    readonly name: string;
  }[];
};

type RequiredKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? never : K;
}[keyof T];

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type Expect<T extends true> = T;

type _AuthTenantMappingRequiredKeys = Expect<
  Equal<RequiredKeys<AuthProviderTenantMappingEvidence>, "externalOrgId">
>;
type _FailureEvidenceRequiredKeys = Expect<
  Equal<RequiredKeys<FailureDrillEvidenceRecord>, "kind" | "name">
>;
type _ProviderCapabilityManifestRequiredKeys = Expect<
  Equal<
    RequiredKeys<ProviderConformanceCapabilityManifest>,
    "methods" | "name" | "required" | "supported"
  >
>;
type _QStashTaskPublishRecordRequiredKeys = Expect<
  Equal<RequiredKeys<QStashTaskPublishRecord>, never>
>;
type _QStashBatchPublishRecordRequiredKeys = Expect<
  Equal<RequiredKeys<QStashBatchPublishRecord>, never>
>;
type _QStashTriggerScheduleRecordRequiredKeys = Expect<
  Equal<RequiredKeys<QStashTriggerScheduleRecord>, never>
>;
type _QStashTriggerSyncDetailRequiredKeys = Expect<
  Equal<RequiredKeys<QStashTriggerSyncDetail>, "action" | "applied">
>;

const PUBLIC_CONFORMANCE_HELPER_EXPORTS = [
  "assertContractObservation",
  "assertDrizzleProblem",
  "createAuthProviderConformanceSuite",
  "createBillingProviderConformanceSuite",
  "createContractCaseArbitrary",
  "createDrizzleProviderConformanceSuite",
  "createFileContractFailureSink",
  "createLlmProviderConformanceSuite",
  "createProviderConformanceMatrixSuite",
  "createProviderNoCredentialConformanceSuite",
  "createQStashBatchConformanceSuite",
  "createQStashTaskConformanceSuite",
  "createQStashTriggerConformanceSuite",
  "createStorageProviderConformanceSuite",
  "createUpstashRedisMeteringConformanceSuite",
  "createUpstashRedisRateLimitConformanceSuite",
  "runContractFuzz",
  "runContractRuntimeDifferential",
] as const;

const SERVERLESS_LIVE_SMOKE_CASE_NAME =
  "keeps live smoke optional and skipped unless explicitly env-gated";

function caseNames(suite: SuiteWithNamedCases): string[] {
  return suite.cases.map((testCase) => testCase.name);
}

function unexecuted(): never {
  throw new TypeError("Conformance contract fixtures are name-only and should not run.");
}

const liveSmokeGate = {
  requiredEnv: ["CROCO_CONFORMANCE_LIVE_SMOKE"],
  isEnabled: () => false,
};

const supportedDrizzleCheck = (name: string) =>
  ({
    supported: true,
    checks: [
      {
        name,
        run: async () => undefined,
      },
    ],
  }) as const;

const unsupportedDrizzleCapability = (reason: string) =>
  ({
    supported: false,
    reason,
  }) as const;

describe("@croco/testing conformance public contract", () => {
  it("exports conformance helpers from the root package entrypoint", () => {
    const exportsByName = new Map(Object.entries(testingEntrypoint));

    for (const helperName of PUBLIC_CONFORMANCE_HELPER_EXPORTS) {
      expect(exportsByName.get(helperName), helperName).toBeTypeOf("function");
    }
  });

  it("keeps the Drizzle subpath entrypoint aligned with the root helpers", () => {
    expect(Object.keys(drizzleEntrypoint).sort()).toEqual([
      "assertDrizzleProblem",
      "createDrizzleProviderConformanceSuite",
    ]);
    expect(drizzleEntrypoint.assertDrizzleProblem).toBe(testingEntrypoint.assertDrizzleProblem);
    expect(drizzleEntrypoint.createDrizzleProviderConformanceSuite).toBe(
      testingEntrypoint.createDrizzleProviderConformanceSuite,
    );
  });

  it("locks auth provider case names, including optional evidence cases", () => {
    const suite = createAuthProviderConformanceSuite({
      providerName: "Contract Auth",
      auth: {
        expectedUser: {
          id: "user_123",
          email: "user@example.com",
          roles: ["member"],
          permissions: ["orders:read"],
        },
        authenticateValid: unexecuted,
        authenticateMissingCredentials: unexecuted,
        invalidCredentials: {
          allowNull: true,
          run: unexecuted,
        },
        malformedPayload: {
          code: "auth/malformed-payload",
          run: unexecuted,
        },
        upstreamFailure: {
          code: "auth/upstream-failed",
          retryable: true,
          run: unexecuted,
        },
      },
      webhooks: {
        processValid: unexecuted,
        invalidSignature: {
          code: "auth/invalid-signature",
          run: unexecuted,
        },
        invalidPayload: {
          code: "auth/invalid-payload",
          run: unexecuted,
        },
      },
      tenantMapping: {
        createEvidence: unexecuted,
      },
      readiness: {
        requiredEnv: ["AUTH_CLIENT_SECRET"],
        createMissingConfigHealth: unexecuted,
        createReadyHealth: unexecuted,
      },
      liveSmoke: {
        ...liveSmokeGate,
        requiredEnv: ["AUTH_LIVE_SMOKE"],
      },
    });

    expect(caseNames(suite)).toEqual([
      "authenticates valid credentials into the Croco AuthUser contract",
      "treats missing credentials as unauthenticated without throwing",
      "maps invalid credentials to a stable auth failure contract",
      "maps malformed provider payloads to stable Croco Problems",
      "surfaces upstream auth failures as redacted Croco Problems",
      "processes valid webhooks through provider handlers",
      "rejects invalid webhook signatures with stable Croco Problems",
      "reports missing auth configuration without leaking secrets",
      "rejects malformed webhook payloads with stable Croco Problems",
      "maps provider organization identity to Croco tenant evidence",
      "reports ready auth configuration without exposing secret values",
      "keeps live auth smoke optional and skipped unless explicitly env-gated",
    ]);
  });

  it("locks storage provider case names", () => {
    const suite = createStorageProviderConformanceSuite({
      providerName: "Contract Storage",
      createProvider: unexecuted,
    });

    expect(caseNames(suite)).toEqual([
      "stores and reads buffer objects with required metadata",
      "stores and streams readable objects",
      "deletes existing objects and reports them missing",
      "reports missing objects with deterministic not-found behavior",
      "rejects invalid storage keys consistently",
      "rejects invalid signed URL expiries with one provider-independent contract",
      "creates public and signed URLs without leaking object contents",
    ]);
  });

  it("locks provider matrix manifest and capability case names", () => {
    const suite = createProviderConformanceMatrixSuite({
      profiles: [
        {
          packageName: "@croco/billing-polar",
          providerName: "Polar",
          category: "billing",
          capabilities: [
            {
              name: "checkout",
              required: true,
              supported: true,
              methods: ["createCheckout", "ensureCustomer"],
              suite: "createBillingProviderConformanceSuite",
              evidence: ["checkoutId", "checkoutUrl"],
            },
            {
              name: "portal",
              required: false,
              supported: false,
              methods: ["getCustomerPortalUrl"],
              reason: "Provider does not expose a hosted portal.",
            },
            {
              name: "legacy-subscription",
              required: true,
              supported: false,
              methods: ["migrateSubscription"],
              reason: "Legacy subscription migration is intentionally unsupported.",
            },
          ],
        },
      ],
    });

    expect(caseNames(suite)).toEqual([
      "provider conformance matrix: declares at least one provider profile",
      "@croco/billing-polar billing provider profile: declares provider identity",
      "@croco/billing-polar: billing/checkout (createCheckout, ensureCustomer): supported by createBillingProviderConformanceSuite",
      "@croco/billing-polar: billing/portal (getCustomerPortalUrl): documents unsupported optional capability",
      "@croco/billing-polar: billing/legacy-subscription (migrateSubscription): documents unsupported required capability",
    ]);
    expect(suite.manifest).toMatchObject({
      version: "croco.provider-conformance.manifest.v1",
      profiles: [
        {
          packageName: "@croco/billing-polar",
          providerName: "Polar",
          category: "billing",
          capabilities: [
            {
              name: "checkout",
              required: true,
              supported: true,
              methods: ["createCheckout", "ensureCustomer"],
              suite: "createBillingProviderConformanceSuite",
              evidence: ["checkoutId", "checkoutUrl"],
            },
            {
              name: "portal",
              required: false,
              supported: false,
              methods: ["getCustomerPortalUrl"],
              reason: "Provider does not expose a hosted portal.",
            },
            {
              name: "legacy-subscription",
              required: true,
              supported: false,
              methods: ["migrateSubscription"],
              reason: "Legacy subscription migration is intentionally unsupported.",
            },
          ],
        },
      ],
    });
  });

  it("locks provider no-credential case names", () => {
    const suite = createProviderNoCredentialConformanceSuite({
      providerName: "Contract Provider",
      secretSamples: ["contract-secret"],
      scenarios: [
        {
          name: "missing token",
          diagnosticTokens: ["PROVIDER_TOKEN"],
          expectedCode: "provider/missing-config",
          missingEnvironment: ["PROVIDER_TOKEN"],
          run: unexecuted,
        },
      ],
    });

    expect(caseNames(suite)).toEqual([
      "Contract Provider: declares at least one no-credential scenario",
      "Contract Provider missing token: reports a stable actionable diagnostic",
      "Contract Provider missing token: makes no live network or API call",
      "Contract Provider missing token: redacts secret-like configuration values",
    ]);
  });

  it("locks Drizzle provider case names from the public subpath", () => {
    const suite = createDrizzleProviderConformanceSuite({
      providerName: "Contract Drizzle",
      schema: supportedDrizzleCheck("matches migration metadata"),
      diagnostics: unsupportedDrizzleCapability("Diagnostics are emitted by a separate package."),
      transaction: {
        participation: supportedDrizzleCheck("uses caller transaction"),
        rollback: supportedDrizzleCheck("rolls back writes"),
      },
      tenantIsolation: supportedDrizzleCheck("scopes tenant id"),
      repositoryErrors: {
        notFound: supportedDrizzleCheck("maps missing rows"),
        validation: supportedDrizzleCheck("maps invalid input"),
        duplicate: supportedDrizzleCheck("maps duplicate keys"),
        conflict: supportedDrizzleCheck("maps write conflicts"),
        retryableFailure: supportedDrizzleCheck("marks retryable upstream failures"),
      },
    });

    expect(caseNames(suite)).toEqual([
      "Contract Drizzle: schema and migration assumptions: matches migration metadata",
      "Contract Drizzle: documents unsupported diagnostics and readiness redaction",
      "Contract Drizzle: transaction participation: uses caller transaction",
      "Contract Drizzle: transaction rollback: rolls back writes",
      "Contract Drizzle: tenant isolation: scopes tenant id",
      "Contract Drizzle: not-found error semantics: maps missing rows",
      "Contract Drizzle: validation error semantics: maps invalid input",
      "Contract Drizzle: duplicate error semantics: maps duplicate keys",
      "Contract Drizzle: conflict error semantics: maps write conflicts",
      "Contract Drizzle: retryable failure semantics: marks retryable upstream failures",
    ]);
  });

  it("locks LLM provider case names, including optional failure evidence", () => {
    const suite = createLlmProviderConformanceSuite({
      providerName: "Contract LLM",
      modelId: "contract-model",
      createModel: unexecuted,
      createFailingModel: unexecuted,
      prompts: {
        generate: {
          prompt: "Generate a conformance response",
        },
        stream: {
          prompt: "Stream a conformance response",
          minimumChunks: 1,
        },
        object: {
          prompt: "Return a conformance object",
          schema: {
            type: "object",
          },
        },
        tool: {
          prompt: "Call a conformance tool",
          tools: [
            {
              name: "lookup",
              description: "Look up conformance data.",
              parameters: {
                type: "object",
              },
            },
          ],
        },
        embed: {
          text: "one",
          expectedDimensions: 3,
        },
        embedMany: {
          texts: ["one", "two"],
          expectedDimensions: 3,
        },
      },
    });

    expect(caseNames(suite)).toEqual([
      "generates text with model identity and token usage",
      "streams deltas and final usage without losing abort propagation",
      "generates structured objects through the provider contract",
      "returns deterministic tool calls with usage",
      "embeds one input with stable dimensions and usage",
      "embeds many inputs with one vector per input and usage",
      "surfaces provider errors instead of hiding them",
    ]);
  });

  it("locks billing provider gateway and webhook case names", () => {
    const suite = createBillingProviderConformanceSuite({
      providerName: "Contract Billing",
      gateway: {
        createGateway: unexecuted,
        getCheckoutCreateCount: unexecuted,
        fixtures: {
          checkout: {
            billingAccountId: "account_123",
            email: "buyer@example.com",
            productId: "product_123",
            successUrl: "https://example.com/success",
            idempotencyKey: "checkout_123",
          },
          portal: {
            billingAccountId: "account_123",
            email: "buyer@example.com",
          },
          subscription: {
            externalSubscriptionId: "sub_123",
          },
        },
        failureScenarios: [
          {
            name: "surfaces gateway failures as Croco Problems",
            run: async () => unexecuted(),
          },
        ],
      },
      usage: {
        createGateway: unexecuted,
        fixtures: {
          emptyCustomerMeterStateQuery: {
            billingAccountId: "account_empty",
            meterId: "api_calls",
          },
          events: [
            {
              billingAccountId: "account_123",
              eventId: "usage_123",
              meterId: "api_calls",
              occurredAt: new Date("2026-01-31T00:00:00.000Z"),
              value: 1,
            },
          ],
          partialBatch: {
            events: [
              {
                billingAccountId: "account_123",
                eventId: "usage_123",
                meterId: "api_calls",
                occurredAt: new Date("2026-01-31T00:00:00.000Z"),
                value: 1,
              },
            ],
            expectedReceipts: { usage_123: "duplicate" },
            maxEvents: 1,
          },
          customerMeterState: {
            billingAccountId: "account_123",
            meterId: "api_calls",
            value: 1,
          },
        },
        failureScenarios: {
          http429: {
            createGateway: unexecuted,
            forbiddenValues: ["raw-provider-response"],
            fixture: {
              events: [],
              expectedProblemCode: "provider/retryable",
              kind: "http-429",
              rawResponse: "raw-provider-response",
              status: 429,
            },
            run: async () => unexecuted(),
          },
          http5xx: {
            createGateway: unexecuted,
            forbiddenValues: ["raw-provider-response"],
            fixture: {
              events: [],
              expectedProblemCode: "provider/retryable",
              kind: "http-5xx",
              rawResponse: "raw-provider-response",
              status: 500,
            },
            run: async () => unexecuted(),
          },
          timeout: {
            createGateway: unexecuted,
            forbiddenValues: ["raw-provider-response"],
            fixture: {
              events: [],
              kind: "timeout",
              expectedProblemCode: "provider/retryable",
              rawResponse: "raw-provider-response",
              upstreamCode: "RequestTimeoutError",
            },
            run: async () => unexecuted(),
          },
          invalidMeter: {
            createGateway: unexecuted,
            forbiddenValues: ["raw-provider-response"],
            fixture: {
              events: [],
              expectedProblemCode: "provider/terminal",
              kind: "invalid-meter",
              rawResponse: "raw-provider-response",
            },
            run: async () => unexecuted(),
          },
          invalidSchema: {
            createGateway: unexecuted,
            forbiddenValues: ["raw-provider-response"],
            fixture: {
              events: [],
              expectedProblemCode: "provider/terminal",
              kind: "invalid-schema",
              rawResponse: "raw-provider-response",
            },
            run: async () => unexecuted(),
          },
        },
      },
      webhook: {
        createHandler: unexecuted,
        fixtures: {
          subscription: {
            body: "{}",
            headers: {
              "x-signature": "valid",
            },
            eventId: "evt_subscription",
          },
          order: {
            body: "{}",
            headers: {
              "x-signature": "valid",
            },
            eventId: "evt_order",
          },
          invalidSignature: {
            body: "{}",
            headers: {
              "x-signature": "invalid",
            },
            eventId: "evt_invalid_signature",
          },
          invalidPayload: {
            body: "{",
            headers: {
              "x-signature": "valid",
            },
            eventId: "evt_invalid_payload",
          },
        },
      },
    });

    expect(caseNames(suite)).toEqual([
      "creates checkout sessions with stable checkout identifiers and URLs",
      "reconciles repeated checkout operation keys to the original provider session",
      "rejects checkout operation key reuse for a different product",
      "rejects checkout operation key reuse for a different success URL",
      "rejects checkout operation key reuse for a different cancel URL",
      "ensures customers before creating customer portal URLs",
      "supports deferred cancel, resume, and immediate cancel subscription lifecycle calls",
      "surfaces gateway failures as Croco Problems",
      "inserts deterministic usage events with one receipt per event",
      "acknowledges logical usage event replays without a second billed increment",
      "maps bounded partial usage batches to individual delivery receipts",
      "distinguishes empty customer meter state from a populated state",
      "classifies HTTP 429 usage delivery failures as retryable",
      "classifies HTTP 5xx usage delivery failures as retryable",
      "classifies timeout usage delivery failures as retryable",
      "classifies invalid meter usage failures as terminal",
      "classifies invalid schema usage failures as terminal",
      "accepts signed subscription lifecycle webhooks with deterministic event ids",
      "accepts signed order webhooks with deterministic event ids",
      "treats duplicate webhook deliveries as idempotent successes",
      "rejects invalid webhook signatures with Croco Problems",
      "rejects structurally invalid webhook payloads with Croco Problems",
    ]);
    expect(suite.manifest).toEqual({
      capabilityEvidence: [
        {
          capability: "usage",
          caseNames: [
            "inserts deterministic usage events with one receipt per event",
            "acknowledges logical usage event replays without a second billed increment",
            "maps bounded partial usage batches to individual delivery receipts",
            "distinguishes empty customer meter state from a populated state",
            "classifies HTTP 429 usage delivery failures as retryable",
            "classifies HTTP 5xx usage delivery failures as retryable",
            "classifies timeout usage delivery failures as retryable",
            "classifies invalid meter usage failures as terminal",
            "classifies invalid schema usage failures as terminal",
          ],
          status: "supported",
        },
      ],
      caseNames: caseNames(suite),
      providerName: "Contract Billing",
      version: "croco.billing-provider-conformance.v1",
    });
    expect(Object.isFrozen(suite.manifest)).toBe(true);
    expect(Object.isFrozen(suite.manifest.caseNames)).toBe(true);
    expect(Object.isFrozen(suite.manifest.capabilityEvidence)).toBe(true);
    for (const evidence of suite.manifest.capabilityEvidence) {
      expect(Object.isFrozen(evidence)).toBe(true);
      expect(Object.isFrozen(evidence.caseNames)).toBe(true);
    }
  });

  it("records unavailable usage capability evidence separately", () => {
    const suite = createBillingProviderConformanceSuite({
      providerName: "Unavailable Usage Billing",
      unavailableUsage: {
        createProvider: unexecuted,
      },
    });

    expect(suite.manifest).toEqual({
      capabilityEvidence: [
        {
          capability: "usage",
          caseNames: [
            "rejects unavailable usage billing capability with the public capability Problem",
          ],
          status: "unavailable",
        },
      ],
      caseNames: [
        "rejects unavailable usage billing capability with the public capability Problem",
      ],
      providerName: "Unavailable Usage Billing",
      version: "croco.billing-provider-conformance.v1",
    });
  });

  it("locks serverless provider helper case names", () => {
    const policy = {
      name: "contract",
      limit: 10,
      windowMs: 60_000,
    };

    expect(
      caseNames(
        createUpstashRedisMeteringConformanceSuite({
          providerName: "Contract Metering",
          createMissingConfig: unexecuted,
          createClient: unexecuted,
          liveSmoke: liveSmokeGate,
        }),
      ),
    ).toEqual([
      "validates required Upstash Redis metering configuration without leaking secrets",
      "adapts usage storage commands and idempotency keys without credentials",
      "preserves duplicate idempotency evidence as a terminal no-op",
      "surfaces retryable Upstash Redis metering failures as redacted Problems",
      "surfaces terminal Upstash Redis metering failures as redacted Problems",
      SERVERLESS_LIVE_SMOKE_CASE_NAME,
    ]);

    expect(
      caseNames(
        createUpstashRedisRateLimitConformanceSuite({
          providerName: "Contract Rate Limit",
          createMissingConfig: unexecuted,
          createStore: unexecuted,
          invalidPolicy: {
            ...policy,
            limit: -1,
          },
          policy,
          liveSmoke: liveSmokeGate,
        }),
      ),
    ).toEqual([
      "validates required Upstash Redis configuration without leaking secrets",
      "rejects unsupported rate-limit policies with a terminal Problem",
      "enforces allow, deny, stats, and refund idempotency semantics",
      "surfaces retryable Upstash Redis failures as redacted Problems",
      "surfaces terminal Upstash Redis failures as redacted Problems",
      SERVERLESS_LIVE_SMOKE_CASE_NAME,
    ]);

    expect(
      caseNames(
        createQStashTaskConformanceSuite({
          providerName: "Contract QStash Task",
          createMissingConfig: unexecuted,
          createPublisher: unexecuted,
          liveSmoke: liveSmokeGate,
        }),
      ),
    ).toEqual([
      "validates required QStash configuration without leaking secrets",
      "publishes task envelopes with delay, headers, and idempotency evidence",
      "rejects invalid task ids and unsupported publish options",
      "surfaces retryable QStash failures as redacted Problems",
      "surfaces terminal QStash failures as redacted Problems",
      SERVERLESS_LIVE_SMOKE_CASE_NAME,
    ]);

    expect(
      caseNames(
        createQStashBatchConformanceSuite({
          providerName: "Contract QStash Batch",
          createExecutor: unexecuted,
          liveSmoke: liveSmokeGate,
        }),
      ),
    ).toEqual([
      "executes a terminal chunk without publishing a follow-up message",
      "publishes next chunk envelopes with idempotency evidence",
      "surfaces retryable QStash batch failures as redacted Problems",
      "surfaces terminal QStash batch failures as redacted Problems",
      SERVERLESS_LIVE_SMOKE_CASE_NAME,
    ]);

    expect(
      caseNames(
        createQStashTriggerConformanceSuite({
          providerName: "Contract QStash Trigger",
          createHarness: unexecuted,
          liveSmoke: liveSmokeGate,
        }),
      ),
    ).toEqual([
      "syncs QStash schedules with stable webhook payloads",
      "rejects invalid webhook signatures before dispatch",
      "dispatches verified webhooks through the execution manager",
      "surfaces retryable QStash schedule failures as redacted diagnostics",
      "surfaces terminal QStash schedule failures as redacted diagnostics",
      SERVERLESS_LIVE_SMOKE_CASE_NAME,
    ]);
  });

  it("locks required evidence and manifest fields used by downstream packages", () => {
    const tenantEvidence = {
      externalOrgId: "org_123",
    } satisfies AuthProviderTenantMappingEvidence;
    const failureEvidence = {
      kind: "audit",
      name: "provider.contract.audit",
    } satisfies FailureDrillEvidenceRecord;
    const capabilityManifest = {
      methods: ["createCheckout"],
      name: "checkout",
      required: true,
      supported: true,
    } satisfies ProviderConformanceCapabilityManifest;
    const taskPublishRecord = {} satisfies QStashTaskPublishRecord;
    const batchPublishRecord = {} satisfies QStashBatchPublishRecord;
    const triggerScheduleRecord = {} satisfies QStashTriggerScheduleRecord;
    const triggerSyncDetail = {
      action: "created",
      applied: true,
    } satisfies QStashTriggerSyncDetail;

    expect({
      tenantEvidence,
      failureEvidence,
      capabilityManifest,
      taskPublishRecord,
      batchPublishRecord,
      triggerScheduleRecord,
      triggerSyncDetail,
    }).toEqual({
      tenantEvidence: {
        externalOrgId: "org_123",
      },
      failureEvidence: {
        kind: "audit",
        name: "provider.contract.audit",
      },
      capabilityManifest: {
        methods: ["createCheckout"],
        name: "checkout",
        required: true,
        supported: true,
      },
      taskPublishRecord: {},
      batchPublishRecord: {},
      triggerScheduleRecord: {},
      triggerSyncDetail: {
        action: "created",
        applied: true,
      },
    });
  });
});
