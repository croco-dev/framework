import * as assert from "node:assert/strict";
import {
  BILLING_PROVIDER_CAPABILITIES,
  type BillingGateway,
  type BillingProvider,
  type BillingProviderCapability,
  type CustomerMeterState,
  type CustomerMeterStateQuery,
  type CheckoutResult,
  type CreateCheckoutParams,
  type LicensedQuantityGateway,
  type UsageBillingEvent,
  type UsageBillingBatchReceipt,
  type UsageBillingEventReceipt,
  type UsageBillingGateway,
} from "@croco/billing-core";
import { Problem } from "@croco/problems-core";

export type BillingProviderConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type BillingGatewayConformanceFixtures = {
  readonly checkout: CreateCheckoutParams;
  readonly portal: {
    readonly billingAccountId: string;
    readonly email: string;
  };
  readonly subscription: {
    readonly externalSubscriptionId: string;
  };
};

export type BillingGatewayConformanceAssertions<TGateway extends BillingGateway = BillingGateway> =
  {
    readonly checkout?: (
      result: CheckoutResult,
      context: {
        readonly gateway: TGateway;
        readonly params: CreateCheckoutParams;
        readonly providerName: string;
      },
    ) => void | Promise<void>;
    readonly customerPortal?: (
      portalUrl: string,
      context: {
        readonly gateway: TGateway;
        readonly billingAccountId: string;
        readonly customerId: string;
        readonly providerName: string;
      },
    ) => void | Promise<void>;
    readonly subscriptionLifecycle?: (context: {
      readonly gateway: TGateway;
      readonly externalSubscriptionId: string;
      readonly providerName: string;
    }) => void | Promise<void>;
  };

export type BillingGatewayFailureScenario<TGateway extends BillingGateway = BillingGateway> = {
  readonly name: string;
  readonly createGateway?: () => TGateway | Promise<TGateway>;
  readonly run: (gateway: TGateway) => Promise<unknown>;
  readonly assertProblem?: (problem: Problem) => void | Promise<void>;
};

export type BillingGatewayConformanceOptions<TGateway extends BillingGateway = BillingGateway> = {
  readonly createGateway: () => TGateway | Promise<TGateway>;
  readonly getCheckoutCreateCount: (gateway: TGateway) => number | Promise<number>;
  readonly checkoutConflictProblemCode?: string;
  readonly fixtures: BillingGatewayConformanceFixtures;
  readonly assertions?: BillingGatewayConformanceAssertions<TGateway>;
  readonly failureScenarios?: readonly BillingGatewayFailureScenario<TGateway>[];
};

export type BillingWebhookResult = {
  readonly success: boolean;
  readonly eventId?: string;
  readonly error?: string;
};

export type BillingWebhookHandlerContract<
  TResult extends BillingWebhookResult = BillingWebhookResult,
> = {
  handle(body: Buffer | string, headers: Record<string, string>): Promise<TResult>;
};

export type BillingWebhookFixture = {
  readonly body: Buffer | string;
  readonly headers: Record<string, string>;
  readonly eventId: string;
};

export type BillingWebhookConformanceAssertions<
  TResult extends BillingWebhookResult = BillingWebhookResult,
  THandler extends BillingWebhookHandlerContract<TResult> = BillingWebhookHandlerContract<TResult>,
> = {
  readonly subscription?: (
    result: TResult,
    context: {
      readonly handler: THandler;
      readonly fixture: BillingWebhookFixture;
      readonly providerName: string;
    },
  ) => void | Promise<void>;
  readonly order?: (
    result: TResult,
    context: {
      readonly handler: THandler;
      readonly fixture: BillingWebhookFixture;
      readonly providerName: string;
    },
  ) => void | Promise<void>;
  readonly idempotency?: (
    results: readonly [TResult, TResult],
    context: {
      readonly handler: THandler;
      readonly fixture: BillingWebhookFixture;
      readonly providerName: string;
    },
  ) => void | Promise<void>;
  readonly invalidSignature?: (problem: Problem) => void | Promise<void>;
  readonly invalidPayload?: (problem: Problem) => void | Promise<void>;
};

export type BillingWebhookConformanceOptions<
  TResult extends BillingWebhookResult = BillingWebhookResult,
  THandler extends BillingWebhookHandlerContract<TResult> = BillingWebhookHandlerContract<TResult>,
> = {
  readonly createHandler: () => THandler | Promise<THandler>;
  readonly fixtures: {
    readonly subscription: BillingWebhookFixture;
    readonly order: BillingWebhookFixture;
    readonly invalidSignature: BillingWebhookFixture;
    readonly invalidPayload?: BillingWebhookFixture;
  };
  readonly assertions?: BillingWebhookConformanceAssertions<TResult, THandler>;
};

export type BillingProviderConformanceOptions<
  TGateway extends BillingGateway = BillingGateway,
  TResult extends BillingWebhookResult = BillingWebhookResult,
  THandler extends BillingWebhookHandlerContract<TResult> = BillingWebhookHandlerContract<TResult>,
> = {
  readonly capabilities?: BillingProviderCapabilityConformanceOptions;
  readonly providerName: string;
  readonly gateway?: BillingGatewayConformanceOptions<TGateway>;
  readonly licensedQuantity?: LicensedQuantityGatewayConformanceOptions;
  readonly unavailableUsage?: UnavailableUsageBillingCapabilityConformanceOptions;
  readonly usage?: UsageBillingGatewayConformanceOptions;
  readonly webhook?: BillingWebhookConformanceOptions<TResult, THandler>;
};

export type BillingProviderCapabilityConformanceOptions = {
  readonly createProvider: () => BillingProvider | Promise<BillingProvider>;
  readonly required: readonly BillingProviderCapability[];
};

export type LicensedQuantityGatewayConformanceOptions = {
  readonly createGateway: () => LicensedQuantityGateway | Promise<LicensedQuantityGateway>;
  readonly externalSubscriptionId: string;
  readonly initialQuantity: number;
  readonly firstQuantity: number;
  readonly newerQuantity: number;
};

export type UsageBillingConformanceFixtures = {
  readonly emptyCustomerMeterStateQuery: CustomerMeterStateQuery;
  readonly events: readonly UsageBillingEvent[];
  readonly partialBatch: {
    readonly events: readonly UsageBillingEvent[];
    readonly expectedReceipts: Readonly<Record<string, UsageBillingEventReceipt["status"]>>;
    readonly maxEvents: number;
  };
  readonly customerMeterState: Omit<CustomerMeterState, "updatedAt">;
};

type UsageBillingFailureFixtureBase = {
  readonly events: readonly UsageBillingEvent[];
  readonly expectedProblemCode: string;
  readonly rawResponse: string;
};

export type UsageBillingRetryableFailureFixture = UsageBillingFailureFixtureBase &
  (
    | {
        readonly kind: "http-429";
        readonly status: 429;
      }
    | {
        readonly kind: "http-5xx";
        readonly status: 500 | 502 | 503 | 504;
      }
    | {
        readonly kind: "timeout";
        readonly upstreamCode: "RequestTimeoutError";
      }
  );

export type UsageBillingTerminalFailureFixture = UsageBillingFailureFixtureBase &
  (
    | {
        readonly kind: "invalid-meter";
      }
    | {
        readonly kind: "invalid-schema";
      }
  );

export type UsageBillingFailureScenario<
  TFixture extends UsageBillingRetryableFailureFixture | UsageBillingTerminalFailureFixture,
  TGateway extends UsageBillingGateway = UsageBillingGateway,
> = {
  readonly createGateway: (fixture: TFixture) => TGateway | Promise<TGateway>;
  readonly fixture: TFixture;
  readonly forbiddenValues: readonly [string, ...string[]];
  readonly run: (gateway: TGateway, fixture: TFixture) => Promise<unknown>;
};

export type UsageBillingLiveSmokeGate = {
  readonly requiredEnv: readonly string[];
  readonly isEnabled?: () => boolean;
  readonly run?: () => Promise<void>;
};

export type UsageBillingGatewayConformanceOptions<
  TGateway extends UsageBillingGateway = UsageBillingGateway,
> = {
  readonly createGateway: () => TGateway | Promise<TGateway>;
  readonly failureScenarios: {
    readonly http429: UsageBillingFailureScenario<
      Extract<UsageBillingRetryableFailureFixture, { kind: "http-429" }>,
      TGateway
    >;
    readonly http5xx: UsageBillingFailureScenario<
      Extract<UsageBillingRetryableFailureFixture, { kind: "http-5xx" }>,
      TGateway
    >;
    readonly timeout: UsageBillingFailureScenario<
      Extract<UsageBillingRetryableFailureFixture, { kind: "timeout" }>,
      TGateway
    >;
    readonly invalidMeter: UsageBillingFailureScenario<
      Extract<UsageBillingTerminalFailureFixture, { kind: "invalid-meter" }>,
      TGateway
    >;
    readonly invalidSchema: UsageBillingFailureScenario<
      Extract<UsageBillingTerminalFailureFixture, { kind: "invalid-schema" }>,
      TGateway
    >;
  };
  readonly fixtures: UsageBillingConformanceFixtures;
  readonly assertCustomerMeterStateUpdatedAt?: (
    updatedAt: Date,
    context: {
      readonly expected: Omit<CustomerMeterState, "updatedAt">;
      readonly previousUpdatedAt?: Date;
      readonly providerName: string;
    },
  ) => void | Promise<void>;
  readonly liveSmoke?: UsageBillingLiveSmokeGate;
};

export type UnavailableUsageBillingCapabilityConformanceOptions = {
  readonly createProvider: () => BillingProvider | Promise<BillingProvider>;
};

export type BillingProviderConformanceSuite = {
  readonly cases: readonly BillingProviderConformanceCase[];
  readonly manifest: BillingProviderConformanceManifest;
};

export type BillingProviderConformanceManifest = {
  readonly capabilityEvidence: readonly BillingProviderConformanceCapabilityEvidence[];
  readonly caseNames: readonly string[];
  readonly providerName: string;
  readonly version: "croco.billing-provider-conformance.v1";
};

export type BillingProviderConformanceCapabilityEvidence = {
  readonly capability: BillingProviderCapability;
  readonly caseNames: readonly string[];
  readonly status: "supported" | "unavailable";
};

export function createBillingProviderConformanceSuite<
  TGateway extends BillingGateway = BillingGateway,
  TResult extends BillingWebhookResult = BillingWebhookResult,
  THandler extends BillingWebhookHandlerContract<TResult> = BillingWebhookHandlerContract<TResult>,
>(
  options: BillingProviderConformanceOptions<TGateway, TResult, THandler>,
): BillingProviderConformanceSuite {
  assert.ok(
    options.usage === undefined || options.unavailableUsage === undefined,
    "A billing provider cannot declare usage billing capability as both supported and unavailable.",
  );
  const cases: BillingProviderConformanceCase[] = [];
  const capabilityEvidence: BillingProviderConformanceCapabilityEvidence[] = [];

  if (options.capabilities) {
    cases.push(
      ...createBillingProviderCapabilityConformanceCases(
        options.providerName,
        options.capabilities,
      ),
    );
  }

  if (options.gateway) {
    cases.push(...createBillingGatewayConformanceCases(options.providerName, options.gateway));
  }

  if (options.licensedQuantity) {
    cases.push(
      ...createLicensedQuantityGatewayConformanceCases(
        options.providerName,
        options.licensedQuantity,
      ),
    );
  }

  if (options.usage) {
    const start = cases.length;
    cases.push(...createUsageBillingGatewayConformanceCases(options.providerName, options.usage));
    capabilityEvidence.push({
      capability: "usage",
      caseNames: cases.slice(start).map(({ name }) => name),
      status: "supported",
    });
  }

  if (options.unavailableUsage) {
    const start = cases.length;
    cases.push(
      createUnavailableUsageBillingCapabilityConformanceCase(
        options.providerName,
        options.unavailableUsage,
      ),
    );
    capabilityEvidence.push({
      capability: "usage",
      caseNames: cases.slice(start).map(({ name }) => name),
      status: "unavailable",
    });
  }

  if (options.webhook) {
    cases.push(
      ...createBillingWebhookConformanceCases<TResult, THandler>(
        options.providerName,
        options.webhook,
      ),
    );
  }

  return {
    cases,
    manifest: Object.freeze({
      capabilityEvidence: Object.freeze(
        capabilityEvidence.map((evidence) =>
          Object.freeze({ ...evidence, caseNames: Object.freeze(evidence.caseNames) }),
        ),
      ),
      caseNames: Object.freeze(cases.map(({ name }) => name)),
      providerName: options.providerName,
      version: "croco.billing-provider-conformance.v1",
    }),
  };
}

const BILLING_PROVIDER_CAPABILITY_METHODS = {
  checkout: [
    "ensureCustomer",
    "createCheckout",
    "reconcileCheckout",
    "cancelSubscription",
    "resumeSubscription",
    "getCustomerPortalUrl",
  ],
  "licensed-quantity": ["getQuantity", "setQuantity"],
  usage: ["ingest", "getCustomerMeterState"],
} as const satisfies Record<BillingProviderCapability, readonly string[]>;

function createBillingProviderCapabilityConformanceCases(
  providerName: string,
  options: BillingProviderCapabilityConformanceOptions,
): BillingProviderConformanceCase[] {
  return [
    {
      name: "exposes an inspectable billing provider capability profile",
      run: async () => {
        const provider = await options.createProvider();

        assertNonEmptyString(
          provider.profile.providerName,
          `${providerName} provider profile name`,
        );
        for (const capability of BILLING_PROVIDER_CAPABILITIES) {
          const declaration = provider.profile.capabilities[capability];
          assert.equal(
            typeof declaration.supported,
            "boolean",
            `${providerName} must explicitly declare billing capability '${capability}'`,
          );
          if (!declaration.supported) {
            assertNonEmptyString(
              declaration.reason,
              `${providerName} unsupported capability '${capability}' reason`,
            );
          }
        }
      },
    },
    ...options.required.map(
      (capability): BillingProviderConformanceCase => ({
        name: `requires billing provider capability '${capability}' independently`,
        run: async () => {
          const provider = await options.createProvider();
          const implementation = provider.requireCapability(capability);

          for (const method of BILLING_PROVIDER_CAPABILITY_METHODS[capability]) {
            assert.equal(
              typeof implementation[method as keyof typeof implementation],
              "function",
              `${providerName} capability '${capability}' must implement '${method}'`,
            );
          }
        },
      }),
    ),
  ];
}

function createLicensedQuantityGatewayConformanceCases(
  providerName: string,
  options: LicensedQuantityGatewayConformanceOptions,
): BillingProviderConformanceCase[] {
  return [
    {
      name: "applies licensed quantity idempotently and rejects stale source versions",
      run: async () => {
        const gateway = await options.createGateway();
        const initial = await gateway.getQuantity(options.externalSubscriptionId);
        assert.equal(
          initial.quantity,
          options.initialQuantity,
          `${providerName} must expose the provider-observed licensed quantity`,
        );

        const firstInput = {
          externalSubscriptionId: options.externalSubscriptionId,
          quantity: options.firstQuantity,
          reconciliationId: `${providerName}:quantity:first`,
          operationId: `${providerName}:quantity:first:attempt:1`,
          sourceVersion: 1,
        };
        const first = await gateway.setQuantity(firstInput);
        assert.equal(
          first.status,
          "applied",
          `${providerName} must apply the first licensed quantity update`,
        );
        const duplicate = await gateway.setQuantity(firstInput);
        assert.equal(
          duplicate.status,
          "duplicate",
          `${providerName} must acknowledge a repeated operation identity without another effect`,
        );

        const newer = await gateway.setQuantity({
          externalSubscriptionId: options.externalSubscriptionId,
          quantity: options.newerQuantity,
          reconciliationId: `${providerName}:quantity:newer`,
          operationId: `${providerName}:quantity:newer:attempt:1`,
          sourceVersion: 2,
        });
        assert.equal(newer.status, "applied", `${providerName} must apply a newer source version`);
        const stale = await gateway.setQuantity({
          externalSubscriptionId: options.externalSubscriptionId,
          quantity: options.firstQuantity,
          reconciliationId: `${providerName}:quantity:stale`,
          operationId: `${providerName}:quantity:stale:attempt:1`,
          sourceVersion: 1,
        });
        assert.equal(
          stale.status,
          "stale",
          `${providerName} must reject a quantity update older than the accepted source version`,
        );
        assert.equal(
          (await gateway.getQuantity(options.externalSubscriptionId)).quantity,
          options.newerQuantity,
          `${providerName} must preserve the newer quantity after stale delivery`,
        );
      },
    },
  ];
}

function createUsageBillingGatewayConformanceCases(
  providerName: string,
  options: UsageBillingGatewayConformanceOptions,
): BillingProviderConformanceCase[] {
  const createGateway = async (): Promise<UsageBillingGateway> => await options.createGateway();
  const { events, partialBatch, customerMeterState } = options.fixtures;

  const cases: BillingProviderConformanceCase[] = [
    {
      name: "inserts deterministic usage events with one receipt per event",
      run: async () => {
        assert.ok(
          events.length > 0,
          `${providerName} usage fixture must include at least one event.`,
        );
        assert.ok(
          events.length <= partialBatch.maxEvents,
          `${providerName} usage fixture exceeds its declared maximum batch size of ${partialBatch.maxEvents}.`,
        );
        const gateway = await createGateway();
        const receipt = await gateway.ingest(events);

        assertUsageReceipts(
          receipt.receipts,
          events,
          Object.fromEntries(events.map(({ eventId }) => [eventId, "inserted"])),
          `${providerName} must insert each new usage event exactly once`,
        );
      },
    },
    {
      name: "acknowledges logical usage event replays without a second billed increment",
      run: async () => {
        const gateway = await createGateway();
        await gateway.ingest(events);
        const beforeReplay = await gateway.getCustomerMeterState({
          billingAccountId: customerMeterState.billingAccountId,
          meterId: customerMeterState.meterId,
        });
        const replay = await gateway.ingest(events);

        const afterReplay = await gateway.getCustomerMeterState({
          billingAccountId: customerMeterState.billingAccountId,
          meterId: customerMeterState.meterId,
        });

        assertUsageReceipts(
          replay.receipts,
          events,
          Object.fromEntries(events.map(({ eventId }) => [eventId, "duplicate"])),
          `${providerName} must acknowledge replayed usage events as duplicates`,
        );
        const beforeUpdatedAt = await assertUsageCustomerMeterState(
          beforeReplay,
          customerMeterState,
          options,
          providerName,
        );
        await assertUsageCustomerMeterState(
          afterReplay,
          customerMeterState,
          options,
          providerName,
          beforeUpdatedAt,
        );
      },
    },
    {
      name: "maps bounded partial usage batches to individual delivery receipts",
      run: async () => {
        assert.ok(
          partialBatch.events.length > 0,
          `${providerName} partial usage batch fixture must include at least one event.`,
        );
        assert.ok(
          partialBatch.events.length <= partialBatch.maxEvents,
          `${providerName} partial usage batch fixture exceeds its declared maximum of ${partialBatch.maxEvents}.`,
        );
        assert.ok(
          Object.values(partialBatch.expectedReceipts).includes("inserted") &&
            Object.values(partialBatch.expectedReceipts).includes("duplicate"),
          `${providerName} partial usage batch fixture must cover both inserted and duplicate events.`,
        );
        const gateway = await createGateway();
        await gateway.ingest(events);
        const receipt = await gateway.ingest(partialBatch.events);

        assertUsageReceipts(
          receipt.receipts,
          partialBatch.events,
          partialBatch.expectedReceipts,
          `${providerName} must map each partial batch event to its delivery receipt`,
        );
      },
    },
    {
      name: "distinguishes empty customer meter state from a populated state",
      run: async () => {
        const gateway = await createGateway();
        const empty = await gateway.getCustomerMeterState(
          options.fixtures.emptyCustomerMeterStateQuery,
        );
        assert.equal(empty, null, `${providerName} must represent an empty meter state as null.`);

        await gateway.ingest(events);
        const state = await gateway.getCustomerMeterState({
          billingAccountId: customerMeterState.billingAccountId,
          meterId: customerMeterState.meterId,
        });
        await assertUsageCustomerMeterState(state, customerMeterState, options, providerName);
      },
    },
  ];

  cases.push(
    createUsageBillingFailureConformanceCase(
      providerName,
      "classifies HTTP 429 usage delivery failures as retryable",
      true,
      options.failureScenarios.http429,
    ),
    createUsageBillingFailureConformanceCase(
      providerName,
      "classifies HTTP 5xx usage delivery failures as retryable",
      true,
      options.failureScenarios.http5xx,
    ),
    createUsageBillingFailureConformanceCase(
      providerName,
      "classifies timeout usage delivery failures as retryable",
      true,
      options.failureScenarios.timeout,
    ),
    createUsageBillingFailureConformanceCase(
      providerName,
      "classifies invalid meter usage failures as terminal",
      false,
      options.failureScenarios.invalidMeter,
    ),
    createUsageBillingFailureConformanceCase(
      providerName,
      "classifies invalid schema usage failures as terminal",
      false,
      options.failureScenarios.invalidSchema,
    ),
  );

  if (options.liveSmoke) {
    cases.push(createOptionalUsageBillingLiveSmokeCase(providerName, options.liveSmoke));
  }

  return cases;
}

function createUsageBillingFailureConformanceCase<
  TFixture extends UsageBillingRetryableFailureFixture | UsageBillingTerminalFailureFixture,
>(
  providerName: string,
  label: string,
  expectedRetryable: boolean,
  scenario: UsageBillingFailureScenario<TFixture>,
): BillingProviderConformanceCase {
  return {
    name: label,
    run: async () => {
      const gateway = await scenario.createGateway(scenario.fixture);
      const problem = await assertRejectsWithProblem(() => scenario.run(gateway, scenario.fixture));
      assert.equal(
        problem.extensions?.["retryable"],
        expectedRetryable,
        `${providerName} usage failure '${label}' must expose retryable=${expectedRetryable}.`,
      );
      assert.equal(
        problem.code,
        scenario.fixture.expectedProblemCode,
        `${providerName} usage failure '${label}' must expose its expected public Problem code.`,
      );
      assertUsageFailureFixture(problem, scenario.fixture);
      assertProblemDoesNotExpose(problem, [
        scenario.fixture.rawResponse,
        ...scenario.forbiddenValues,
      ]);
    },
  };
}

function createUnavailableUsageBillingCapabilityConformanceCase(
  providerName: string,
  options: UnavailableUsageBillingCapabilityConformanceOptions,
): BillingProviderConformanceCase {
  return {
    name: "rejects unavailable usage billing capability with the public capability Problem",
    run: async () => {
      const provider = await options.createProvider();
      const problem = await assertRejectsWithProblem(() => provider.requireCapability("usage"));

      assert.equal(
        problem.code,
        "billing/provider-capability-unavailable",
        `${providerName} must not treat unavailable usage billing as empty state or success.`,
      );
      assert.equal(problem.extensions?.["capability"], "usage");
    },
  };
}

function createOptionalUsageBillingLiveSmokeCase(
  providerName: string,
  gate: UsageBillingLiveSmokeGate,
): BillingProviderConformanceCase {
  return {
    name: "keeps real usage billing conformance opt-in and credential-gated",
    run: async () => {
      assert.ok(
        gate.requiredEnv.length > 0,
        `${providerName} real usage billing conformance must declare required environment variables.`,
      );
      const enabled = gate.isEnabled
        ? gate.isEnabled()
        : gate.requiredEnv.every((name) => (process.env[name]?.length ?? 0) > 0);
      if (!enabled) {
        return;
      }

      assert.ok(
        gate.run,
        `${providerName} real usage billing conformance is enabled but has no run hook.`,
      );
      await gate.run();
    },
  };
}

function createBillingGatewayConformanceCases<TGateway extends BillingGateway>(
  providerName: string,
  options: BillingGatewayConformanceOptions<TGateway>,
): BillingProviderConformanceCase[] {
  const createGateway = async (): Promise<TGateway> => await options.createGateway();
  const checkoutConflictCases = [
    {
      name: "rejects checkout operation key reuse for a different product",
      change: { productId: `${options.fixtures.checkout.productId}-different` },
    },
    {
      name: "rejects checkout operation key reuse for a different success URL",
      change: { successUrl: "https://example.invalid/different-success" },
    },
    {
      name: "rejects checkout operation key reuse for a different cancel URL",
      change: { cancelUrl: "https://example.invalid/different-cancel" },
    },
  ] as const;

  const cases: BillingProviderConformanceCase[] = [
    {
      name: "creates checkout sessions with stable checkout identifiers and URLs",
      run: async () => {
        const gateway = await createGateway();
        const result = await gateway.createCheckout(options.fixtures.checkout);

        assertNonEmptyString(result.checkoutId, `${providerName} checkoutId`);
        assertHttpUrl(result.checkoutUrl, `${providerName} checkoutUrl`);
        await options.assertions?.checkout?.(result, {
          gateway,
          params: options.fixtures.checkout,
          providerName,
        });
      },
    },
    {
      name: "reconciles repeated checkout operation keys to the original provider session",
      run: async () => {
        const gateway = await createGateway();
        const initialCreateCount = await options.getCheckoutCreateCount(gateway);
        const initial = await gateway.createCheckout(options.fixtures.checkout);
        const replay = await gateway.createCheckout(options.fixtures.checkout);
        const reconciled = await gateway.reconcileCheckout(options.fixtures.checkout);

        assert.deepEqual(
          replay,
          initial,
          `${providerName} must replay the original checkout for the same idempotency key`,
        );
        assert.deepEqual(
          reconciled,
          initial,
          `${providerName} must reconcile the original checkout for the same idempotency key`,
        );
        assert.equal(
          await options.getCheckoutCreateCount(gateway),
          initialCreateCount + 1,
          `${providerName} must create exactly one provider checkout for repeated operation keys`,
        );
      },
    },
    ...checkoutConflictCases.map(
      ({ name, change }): BillingProviderConformanceCase => ({
        name,
        run: async () => {
          const gateway = await createGateway();
          const initialCreateCount = await options.getCheckoutCreateCount(gateway);
          await gateway.createCheckout(options.fixtures.checkout);

          let caught: unknown;
          try {
            await gateway.createCheckout({
              ...options.fixtures.checkout,
              ...change,
            });
          } catch (error) {
            caught = error;
          }

          assert.ok(
            caught instanceof Problem,
            `${providerName} must reject checkout idempotency key reuse with conflicting input as a Croco Problem.`,
          );
          if (options.checkoutConflictProblemCode !== undefined) {
            assert.equal(
              caught.code,
              options.checkoutConflictProblemCode,
              `${providerName} must reject conflicting checkout input with its stable conflict Problem code`,
            );
          }
          assert.equal(
            await options.getCheckoutCreateCount(gateway),
            initialCreateCount + 1,
            `${providerName} must not create another provider checkout for conflicting input`,
          );
        },
      }),
    ),
    {
      name: "ensures customers before creating customer portal URLs",
      run: async () => {
        const gateway = await createGateway();
        const customerId = await gateway.ensureCustomer(
          options.fixtures.portal.billingAccountId,
          options.fixtures.portal.email,
        );
        assertNonEmptyString(customerId, `${providerName} customerId`);

        const portalUrl = await gateway.getCustomerPortalUrl(customerId);
        assertHttpUrl(portalUrl, `${providerName} customer portal URL`);
        await options.assertions?.customerPortal?.(portalUrl, {
          gateway,
          billingAccountId: options.fixtures.portal.billingAccountId,
          customerId,
          providerName,
        });
      },
    },
    {
      name: "supports deferred cancel, resume, and immediate cancel subscription lifecycle calls",
      run: async () => {
        const gateway = await createGateway();
        const { externalSubscriptionId } = options.fixtures.subscription;

        await gateway.cancelSubscription(externalSubscriptionId, false, {
          idempotencyKey: `${providerName}:conformance:cancel-period-end`,
        });
        await gateway.resumeSubscription(externalSubscriptionId, {
          idempotencyKey: `${providerName}:conformance:resume`,
        });
        await gateway.cancelSubscription(externalSubscriptionId, true, {
          idempotencyKey: `${providerName}:conformance:cancel-immediate`,
        });
        await options.assertions?.subscriptionLifecycle?.({
          gateway,
          externalSubscriptionId,
          providerName,
        });
      },
    },
  ];

  for (const scenario of options.failureScenarios ?? []) {
    cases.push({
      name: scenario.name,
      run: async () => {
        const gateway = scenario.createGateway
          ? await scenario.createGateway()
          : await createGateway();

        let caught: unknown;
        try {
          await scenario.run(gateway);
        } catch (error) {
          caught = error;
        }

        assert.ok(
          caught instanceof Problem,
          `${providerName} must surface gateway failure '${scenario.name}' as a Croco Problem.`,
        );
        await scenario.assertProblem?.(caught);
      },
    });
  }

  return cases;
}

function createBillingWebhookConformanceCases<
  TResult extends BillingWebhookResult,
  THandler extends BillingWebhookHandlerContract<TResult>,
>(
  providerName: string,
  options: BillingWebhookConformanceOptions<TResult, THandler>,
): BillingProviderConformanceCase[] {
  const createHandler = async (): Promise<THandler> => await options.createHandler();

  const cases: BillingProviderConformanceCase[] = [
    {
      name: "accepts signed subscription lifecycle webhooks with deterministic event ids",
      run: async () => {
        const handler = await createHandler();
        const fixture = options.fixtures.subscription;
        const result = await handler.handle(fixture.body, fixture.headers);

        assertSuccessfulWebhookResult(result, fixture.eventId, providerName);
        await options.assertions?.subscription?.(result, {
          handler,
          fixture,
          providerName,
        });
      },
    },
    {
      name: "accepts signed order webhooks with deterministic event ids",
      run: async () => {
        const handler = await createHandler();
        const fixture = options.fixtures.order;
        const result = await handler.handle(fixture.body, fixture.headers);

        assertSuccessfulWebhookResult(result, fixture.eventId, providerName);
        await options.assertions?.order?.(result, {
          handler,
          fixture,
          providerName,
        });
      },
    },
    {
      name: "treats duplicate webhook deliveries as idempotent successes",
      run: async () => {
        const handler = await createHandler();
        const fixture = options.fixtures.subscription;
        const firstResult = await handler.handle(fixture.body, fixture.headers);
        const secondResult = await handler.handle(fixture.body, fixture.headers);

        assertSuccessfulWebhookResult(firstResult, fixture.eventId, providerName);
        assertSuccessfulWebhookResult(secondResult, fixture.eventId, providerName);
        await options.assertions?.idempotency?.([firstResult, secondResult], {
          handler,
          fixture,
          providerName,
        });
      },
    },
    {
      name: "rejects invalid webhook signatures with Croco Problems",
      run: async () => {
        const handler = await createHandler();
        const fixture = options.fixtures.invalidSignature;
        const problem = await assertRejectsWithProblem(() =>
          handler.handle(fixture.body, fixture.headers),
        );

        await options.assertions?.invalidSignature?.(problem);
      },
    },
  ];

  const invalidPayloadFixture = options.fixtures.invalidPayload;
  if (invalidPayloadFixture) {
    cases.push({
      name: "rejects structurally invalid webhook payloads with Croco Problems",
      run: async () => {
        const handler = await createHandler();
        const problem = await assertRejectsWithProblem(() =>
          handler.handle(invalidPayloadFixture.body, invalidPayloadFixture.headers),
        );

        await options.assertions?.invalidPayload?.(problem);
      },
    });
  }

  return cases;
}

function assertSuccessfulWebhookResult(
  result: BillingWebhookResult,
  expectedEventId: string,
  providerName: string,
): void {
  assert.equal(result.success, true, `${providerName} webhook result must be successful.`);
  assert.equal(result.eventId, expectedEventId, `${providerName} webhook eventId must be stable.`);
}

async function assertRejectsWithProblem(run: () => unknown | Promise<unknown>): Promise<Problem> {
  try {
    await run();
  } catch (error) {
    assert.ok(error instanceof Problem, "Expected webhook failure to be a Croco Problem.");
    return error;
  }

  assert.fail("Expected webhook failure to reject.");
}

function assertUsageReceipts(
  receipts: UsageBillingBatchReceipt["receipts"],
  events: readonly UsageBillingEvent[],
  expected: Readonly<Record<string, UsageBillingEventReceipt["status"]>>,
  message: string,
): void {
  const eventIds = events.map(({ eventId }) => eventId);
  assert.equal(
    new Set(eventIds).size,
    eventIds.length,
    `${message}: fixture event ids must be unique.`,
  );
  assert.deepEqual(
    Object.keys(expected).sort(),
    [...eventIds].sort(),
    `${message}: expected receipts must map every input event exactly once.`,
  );
  assert.equal(receipts.length, Object.keys(expected).length, message);
  assert.equal(
    new Set(receipts.map(({ eventId }) => eventId)).size,
    receipts.length,
    `${message}: provider receipts must not repeat an event id.`,
  );
  assert.deepEqual(
    Object.fromEntries(receipts.map(({ eventId, status }) => [eventId, status])),
    expected,
    message,
  );
}

async function assertUsageCustomerMeterState(
  state: CustomerMeterState | null,
  expected: Omit<CustomerMeterState, "updatedAt">,
  options: UsageBillingGatewayConformanceOptions,
  providerName: string,
  previousUpdatedAt?: Date,
): Promise<Date> {
  assert.ok(state, `${providerName} must expose customer meter state after usage delivery.`);
  assert.deepEqual(
    {
      billingAccountId: state.billingAccountId,
      meterId: state.meterId,
      value: state.value,
    },
    expected,
    `${providerName} must return the provider-observed customer meter state`,
  );
  if (previousUpdatedAt) {
    assert.ok(
      state.updatedAt >= previousUpdatedAt,
      `${providerName} must not move customer meter state updatedAt backwards for a replayed event.`,
    );
  }
  await options.assertCustomerMeterStateUpdatedAt?.(state.updatedAt, {
    expected,
    ...(previousUpdatedAt === undefined ? {} : { previousUpdatedAt }),
    providerName,
  });
  return state.updatedAt;
}

function assertProblemDoesNotExpose(problem: Problem, forbiddenValues: readonly string[]): void {
  const publicProblem = JSON.stringify({
    code: problem.code,
    detail: problem.detail,
    extensions: problem.extensions,
    title: problem.title,
  });

  for (const value of forbiddenValues) {
    assert.equal(
      publicProblem.includes(value),
      false,
      `Usage billing Problem must not expose provider value '${value}'.`,
    );
  }
}

function assertUsageFailureFixture(
  problem: Problem,
  fixture: UsageBillingRetryableFailureFixture | UsageBillingTerminalFailureFixture,
): void {
  if (fixture.kind === "http-429" || fixture.kind === "http-5xx") {
    assert.equal(
      problem.extensions?.["upstreamStatus"],
      fixture.status,
      `Usage billing Problem must preserve the safe HTTP status for ${fixture.kind} classification.`,
    );
  }

  if (fixture.kind === "timeout") {
    assert.equal(
      problem.extensions?.["upstreamCode"],
      fixture.upstreamCode,
      "Usage billing Problem must preserve the safe timeout classification.",
    );
  }
}

function assertHttpUrl(value: string, label: string): void {
  assertNonEmptyString(value, label);
  assert.ok(
    value.startsWith("https://") || value.startsWith("http://"),
    `${label} must be an HTTP(S) URL.`,
  );
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") {
    assert.fail(`${label} must be a string.`);
  }

  assert.ok(value.length > 0, `${label} must not be empty.`);
}
