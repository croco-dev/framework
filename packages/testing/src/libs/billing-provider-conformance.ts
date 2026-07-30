import * as assert from "node:assert/strict";
import {
  BILLING_PROVIDER_CAPABILITIES,
  type BillingGateway,
  type BillingProvider,
  type BillingProviderCapability,
  type CheckoutResult,
  type CreateCheckoutParams,
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
  readonly webhook?: BillingWebhookConformanceOptions<TResult, THandler>;
};

export type BillingProviderCapabilityConformanceOptions = {
  readonly createProvider: () => BillingProvider | Promise<BillingProvider>;
  readonly required: readonly BillingProviderCapability[];
};

export type BillingProviderConformanceSuite = {
  readonly cases: readonly BillingProviderConformanceCase[];
};

export function createBillingProviderConformanceSuite<
  TGateway extends BillingGateway = BillingGateway,
  TResult extends BillingWebhookResult = BillingWebhookResult,
  THandler extends BillingWebhookHandlerContract<TResult> = BillingWebhookHandlerContract<TResult>,
>(
  options: BillingProviderConformanceOptions<TGateway, TResult, THandler>,
): BillingProviderConformanceSuite {
  const cases: BillingProviderConformanceCase[] = [];

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

  if (options.webhook) {
    cases.push(
      ...createBillingWebhookConformanceCases<TResult, THandler>(
        options.providerName,
        options.webhook,
      ),
    );
  }

  return { cases };
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

async function assertRejectsWithProblem(run: () => Promise<unknown>): Promise<Problem> {
  try {
    await run();
  } catch (error) {
    assert.ok(error instanceof Problem, "Expected webhook failure to be a Croco Problem.");
    return error;
  }

  assert.fail("Expected webhook failure to reject.");
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
