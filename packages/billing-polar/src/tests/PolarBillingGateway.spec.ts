import { createHash } from "node:crypto";
import { BillingCheckoutInProgressProblem, defineBillingProvider } from "@croco/billing-core";
import type { ILogger } from "@croco/framework-context";
import { defineMeter } from "@croco/metering-core";
import { createBillingProviderConformanceSuite } from "@croco/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolarBillingGateway } from "../libs/PolarBillingGateway";
import { POLAR_BILLING_PROVIDER_PROFILE } from "../libs/PolarBillingProviderProfile";
import { bindPolarUsageMeter, PolarUsageBillingGateway } from "../libs/PolarUsageBillingGateway";
import {
  PolarCustomerNotFoundProblem,
  PolarCheckoutIdempotencyConflictProblem,
  PolarMissingConfigProblem,
  PolarRetryableUpstreamProblem,
  PolarSubscriptionNotFoundProblem,
  PolarValidationProblem,
} from "../libs/problems/PolarBillingProblems";
import type { PolarConfig } from "../types";

const mockGetExternal = vi.fn();
const mockCreateCustomer = vi.fn();
const mockCreateCheckout = vi.fn();
const mockListCheckouts = vi.fn();
const mockRevokeSubscription = vi.fn();
const mockUpdateSubscription = vi.fn();
const mockGetSubscription = vi.fn();
const mockCreateCustomerSession = vi.fn();

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => mockLogger),
} as unknown as ILogger;

vi.mock("@polar-sh/sdk", () => {
  class Polar {
    readonly customers = {
      getExternal: mockGetExternal,
      create: mockCreateCustomer,
    };

    readonly checkouts = {
      create: mockCreateCheckout,
      list: mockListCheckouts,
    };

    readonly subscriptions = {
      get: mockGetSubscription,
      revoke: mockRevokeSubscription,
      update: mockUpdateSubscription,
    };

    readonly customerSessions = {
      create: mockCreateCustomerSession,
    };

    constructor(_options: unknown) {}
  }

  return { Polar };
});

const baseConfig: PolarConfig = {
  accessToken: "polar-token",
  environment: "sandbox",
  webhookSecret: "webhook-secret",
  organizationId: "org-123",
};

const usageMeter = defineMeter({
  key: "billing-polar.conformance",
  aggregation: "COUNT",
  unit: "event",
  billing: "required",
});

const POLAR_RETRY_CONFIG = {
  strategy: "backoff" as const,
  retryConnectionErrors: true,
  backoff: {
    initialInterval: 500,
    maxInterval: 5_000,
    exponent: 1.5,
    maxElapsedTime: 15_000,
  },
};

const POLAR_RETRY_CODES = ["429", "500", "502", "503", "504"];

function createGateway(config: PolarConfig = baseConfig): PolarBillingGateway {
  return new PolarBillingGateway(config, mockLogger);
}

function createUsageGateway(config: PolarConfig = baseConfig): PolarUsageBillingGateway {
  return new PolarUsageBillingGateway(config, [
    bindPolarUsageMeter({
      meter: usageMeter,
      eventName: "billing_polar_conformance",
      providerMeterId: "polar-meter-conformance",
    }),
  ]);
}

function createNotFoundError(): Error {
  return Object.assign(new Error("Customer not found"), {
    name: "ResourceNotFound",
    error: "ResourceNotFound",
    status: 404,
  });
}

function createTransientLookupError(): Error {
  return Object.assign(new Error("Rate limit exceeded"), {
    name: "ConnectionError",
    status: 429,
  });
}

function createUnexpected404Error(): Error {
  return Object.assign(new Error("Gateway timeout disguised as 404"), {
    name: "UnexpectedClientError",
    status: 404,
  });
}

function createValidationError(): Error {
  return Object.assign(new Error("Product is invalid"), {
    name: "SDKValidationError",
    status: 422,
  });
}

function setupSuccessfulGatewayBackend(): void {
  const checkouts: {
    id: string;
    url: string;
    metadata: Record<string, string>;
  }[] = [];
  mockGetExternal.mockResolvedValue({ id: "cust-existing" });
  mockCreateCustomer.mockResolvedValue({ id: "cust-created" });
  mockListCheckouts.mockImplementation(() => createCheckoutPages(checkouts));
  mockCreateCheckout.mockImplementation(async (params) => {
    const checkout = {
      id: "checkout-conformance",
      url: "https://checkout.polar.sh/checkout-conformance",
      metadata: params.metadata,
    };
    checkouts.push(checkout);
    return checkout;
  });
  mockCreateCustomerSession.mockResolvedValue({
    customerPortalUrl: "https://polar.sh/portal/session-conformance",
  });
  mockRevokeSubscription.mockResolvedValue(undefined);
  mockUpdateSubscription.mockResolvedValue(undefined);
  mockGetSubscription.mockResolvedValue({
    status: "active",
    cancelAtPeriodEnd: false,
  });
}

function createCheckoutPages(
  items: readonly {
    id: string;
    url: string;
    metadata: Record<string, string>;
  }[],
  ...additionalPages: ReadonlyArray<
    readonly {
      id: string;
      url: string;
      metadata: Record<string, string>;
    }[]
  >
) {
  const pages = [items, ...additionalPages];
  const totalCount = pages.reduce((count, page) => count + page.length, 0);

  return {
    async *[Symbol.asyncIterator]() {
      for (const page of pages) {
        yield {
          result: {
            items: page,
            pagination: {
              totalCount,
              maxPage: pages.length,
            },
          },
        };
      }
    },
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("PolarBillingGateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListCheckouts.mockReset();
    mockListCheckouts.mockResolvedValue(createCheckoutPages([]));
  });

  describe("billing provider conformance", () => {
    it.each(
      createBillingProviderConformanceSuite({
        providerName: "billing-polar",
        capabilities: {
          createProvider: () =>
            defineBillingProvider(POLAR_BILLING_PROVIDER_PROFILE, {
              checkout: createGateway(),
              usage: createUsageGateway(),
            }),
          required: ["checkout", "usage"],
        },
        gateway: {
          createGateway: () => {
            setupSuccessfulGatewayBackend();
            return createGateway();
          },
          getCheckoutCreateCount: () => mockCreateCheckout.mock.calls.length,
          checkoutConflictProblemCode: "billing-polar/checkout-idempotency-conflict",
          fixtures: {
            checkout: {
              billingAccountId: "account-conformance",
              email: "billing@example.com",
              productId: "prod-conformance",
              successUrl: "https://example.com/success",
              cancelUrl: "https://example.com/cancel",
              idempotencyKey: "checkout-conformance",
            },
            portal: {
              billingAccountId: "account-conformance",
              email: "billing@example.com",
            },
            subscription: {
              externalSubscriptionId: "sub-conformance",
            },
          },
          assertions: {
            subscriptionLifecycle: () => {
              expect(mockUpdateSubscription).toHaveBeenNthCalledWith(
                1,
                {
                  id: "sub-conformance",
                  subscriptionUpdate: {
                    cancelAtPeriodEnd: true,
                  },
                },
                {
                  headers: {
                    "Idempotency-Key": "billing-polar:conformance:cancel-period-end",
                  },
                },
              );
              expect(mockUpdateSubscription).toHaveBeenNthCalledWith(
                2,
                {
                  id: "sub-conformance",
                  subscriptionUpdate: {
                    cancelAtPeriodEnd: false,
                  },
                },
                {
                  headers: {
                    "Idempotency-Key": "billing-polar:conformance:resume",
                  },
                },
              );
              expect(mockRevokeSubscription).toHaveBeenCalledWith(
                { id: "sub-conformance" },
                {
                  headers: {
                    "Idempotency-Key": "billing-polar:conformance:cancel-immediate",
                  },
                },
              );
            },
          },
          failureScenarios: [
            {
              name: "keeps ambiguous upstream checkout failures in progress",
              createGateway: () => {
                setupSuccessfulGatewayBackend();
                mockCreateCheckout.mockRejectedValueOnce(
                  Object.assign(new Error("Polar unavailable"), {
                    name: "ConnectionError",
                  }),
                );
                return createGateway();
              },
              run: (gateway) =>
                gateway.createCheckout({
                  billingAccountId: "account-conformance",
                  email: "billing@example.com",
                  productId: "prod-conformance",
                  successUrl: "https://example.com/success",
                  idempotencyKey: "checkout-conformance-failure",
                }),
              assertProblem: (problem) => {
                expect(problem).toBeInstanceOf(BillingCheckoutInProgressProblem);
                expect(problem.code).toBe("billing/checkout-in-progress");
              },
            },
          ],
        },
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  describe("ensureCustomer", () => {
    it("should return existing customer id when lookup succeeds", async () => {
      const gateway = createGateway();

      mockGetExternal.mockResolvedValue({ id: "cust-existing" });

      const result = await gateway.ensureCustomer("account-1", "test@example.com");

      expect(result).toBe("cust-existing");
      expect(mockGetExternal).toHaveBeenCalledWith(
        { externalId: "account-1" },
        {
          retries: POLAR_RETRY_CONFIG,
          retryCodes: POLAR_RETRY_CODES,
        },
      );
      expect(mockCreateCustomer).not.toHaveBeenCalled();
    });

    it("should create a customer when lookup returns ResourceNotFound", async () => {
      const gateway = createGateway();

      mockGetExternal.mockRejectedValue(createNotFoundError());
      mockCreateCustomer.mockResolvedValue({ id: "cust-created" });

      const result = await gateway.ensureCustomer("account-1", "test@example.com");

      expect(result).toBe("cust-created");
      expect(mockCreateCustomer).toHaveBeenCalledWith({
        externalId: "account-1",
        email: "test@example.com",
        organizationId: "org-123",
      });
    });

    it("should log warning when customer not found error is caught", async () => {
      const gateway = createGateway();

      const notFoundError = createNotFoundError();
      mockGetExternal.mockRejectedValue(notFoundError);
      mockCreateCustomer.mockResolvedValue({ id: "cust-created" });

      await gateway.ensureCustomer("account-1", "test@example.com");

      expect(mockLogger.info).toHaveBeenCalledWith("Customer not found, creating new customer", {
        billingAccountId: "account-1",
      });
    });

    it("should propagate transient lookup failures instead of creating a duplicate customer", async () => {
      const gateway = createGateway();

      const error = createTransientLookupError();
      mockGetExternal.mockRejectedValue(error);

      await expect(gateway.ensureCustomer("account-1", "test@example.com")).rejects.toBeInstanceOf(
        PolarRetryableUpstreamProblem,
      );
      await expect(gateway.ensureCustomer("account-1", "test@example.com")).rejects.toMatchObject({
        code: "billing-polar/retryable-upstream",
        extensions: expect.objectContaining({
          operation: "ensureCustomer.lookup",
          status: 429,
        }),
      });
      expect(mockCreateCustomer).not.toHaveBeenCalled();
    });

    it("should not create a customer for non-ResourceNotFound 404 lookup errors", async () => {
      const gateway = createGateway();

      const error = createUnexpected404Error();
      mockGetExternal.mockRejectedValue(error);

      await expect(gateway.ensureCustomer("account-1", "test@example.com")).rejects.toBeInstanceOf(
        PolarCustomerNotFoundProblem,
      );
      expect(mockCreateCustomer).not.toHaveBeenCalled();
    });
  });

  describe("createCheckout", () => {
    it("should create checkout after ensuring a customer exists", async () => {
      const gateway = createGateway();

      mockGetExternal.mockResolvedValue({ id: "cust-existing" });
      mockListCheckouts.mockResolvedValue(createCheckoutPages([]));
      mockCreateCheckout.mockResolvedValue({
        id: "checkout-1",
        url: "https://checkout.polar.sh/checkout-1",
      });

      const result = await gateway.createCheckout({
        billingAccountId: "account-1",
        email: "test@example.com",
        productId: "prod-1",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        idempotencyKey: "checkout-account-1",
      });

      expect(result).toEqual({
        checkoutId: "checkout-1",
        checkoutUrl: "https://checkout.polar.sh/checkout-1",
      });
      expect(mockCreateCheckout).toHaveBeenCalledWith({
        products: ["prod-1"],
        customerId: "cust-existing",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        metadata: {
          croco_checkout_operation: sha256("checkout-account-1"),
          croco_checkout_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      });
    });

    it("should reconcile an ambiguous create response to the existing provider checkout", async () => {
      const gateway = createGateway();
      const operationKey = sha256("checkout-ambiguous");

      mockGetExternal.mockResolvedValue({ id: "cust-existing" });
      mockListCheckouts.mockResolvedValueOnce(createCheckoutPages([])).mockResolvedValueOnce(
        createCheckoutPages([
          {
            id: "checkout-existing",
            url: "https://checkout.polar.sh/checkout-existing",
            metadata: {
              croco_checkout_operation: operationKey,
              croco_checkout_fingerprint: sha256(
                '{"billingAccountId":"account-1","cancelUrl":null,"email":"test@example.com","productId":"prod-1","successUrl":"https://example.com/success"}',
              ),
            },
          },
        ]),
      );
      mockCreateCheckout.mockRejectedValue(
        Object.assign(new Error("connection closed after acceptance"), {
          name: "ConnectionError",
        }),
      );

      await expect(
        gateway.createCheckout({
          billingAccountId: "account-1",
          email: "test@example.com",
          productId: "prod-1",
          successUrl: "https://example.com/success",
          idempotencyKey: "checkout-ambiguous",
        }),
      ).resolves.toEqual({
        checkoutId: "checkout-existing",
        checkoutUrl: "https://checkout.polar.sh/checkout-existing",
      });
      expect(mockCreateCheckout).toHaveBeenCalledTimes(1);
    });

    it("should not create again while an ambiguously accepted checkout is temporarily invisible", async () => {
      const gateway = createGateway();
      const operationKey = sha256("checkout-delayed");
      const emptyPage = createCheckoutPages([]);
      const existingPage = createCheckoutPages([
        {
          id: "checkout-delayed",
          url: "https://checkout.polar.sh/checkout-delayed",
          metadata: {
            croco_checkout_operation: operationKey,
            croco_checkout_fingerprint: sha256(
              '{"billingAccountId":"account-1","cancelUrl":null,"email":"test@example.com","productId":"prod-1","successUrl":"https://example.com/success"}',
            ),
          },
        },
      ]);

      mockGetExternal.mockResolvedValue({ id: "cust-existing" });
      let checkoutVisible = false;
      mockListCheckouts.mockImplementation(async () =>
        checkoutVisible ? existingPage : emptyPage,
      );
      mockCreateCheckout.mockRejectedValue(
        Object.assign(new Error("connection closed after acceptance"), {
          name: "ConnectionError",
        }),
      );
      const params = {
        billingAccountId: "account-1",
        email: "test@example.com",
        productId: "prod-1",
        successUrl: "https://example.com/success",
        idempotencyKey: "checkout-delayed",
      };

      await expect(gateway.createCheckout(params)).rejects.toThrow(
        BillingCheckoutInProgressProblem,
      );
      checkoutVisible = true;
      const retryGateway = createGateway();
      await expect(retryGateway.createCheckout(params)).resolves.toEqual({
        checkoutId: "checkout-delayed",
        checkoutUrl: "https://checkout.polar.sh/checkout-delayed",
      });
      expect(mockCreateCheckout).toHaveBeenCalledTimes(1);
    });

    it("should replay a checkout found by its provider operation metadata", async () => {
      const gateway = createGateway();
      const operationKey = sha256("checkout-replay");

      mockGetExternal.mockResolvedValue({ id: "cust-existing" });
      mockListCheckouts.mockResolvedValue(
        createCheckoutPages([
          {
            id: "checkout-existing",
            url: "https://checkout.polar.sh/checkout-existing",
            metadata: {
              croco_checkout_operation: operationKey,
              croco_checkout_fingerprint: sha256(
                '{"billingAccountId":"account-1","cancelUrl":null,"email":"test@example.com","productId":"prod-1","successUrl":"https://example.com/success"}',
              ),
            },
          },
        ]),
      );

      await expect(
        gateway.createCheckout({
          billingAccountId: "account-1",
          email: "test@example.com",
          productId: "prod-1",
          successUrl: "https://example.com/success",
          idempotencyKey: "checkout-replay",
        }),
      ).resolves.toEqual({
        checkoutId: "checkout-existing",
        checkoutUrl: "https://checkout.polar.sh/checkout-existing",
      });
      expect(mockCreateCheckout).not.toHaveBeenCalled();
    });

    it("should reconcile a checkout found on a later provider page", async () => {
      const gateway = createGateway();
      const operationKey = sha256("checkout-paginated");
      const fingerprint = sha256(
        '{"billingAccountId":"account-1","cancelUrl":null,"email":"test@example.com","productId":"prod-1","successUrl":"https://example.com/success"}',
      );
      mockGetExternal.mockResolvedValue({ id: "cust-existing" });
      mockListCheckouts.mockResolvedValue(
        createCheckoutPages(
          [
            {
              id: "checkout-unrelated",
              url: "https://checkout.polar.sh/checkout-unrelated",
              metadata: {},
            },
          ],
          [
            {
              id: "checkout-paginated",
              url: "https://checkout.polar.sh/checkout-paginated",
              metadata: {
                croco_checkout_operation: operationKey,
                croco_checkout_fingerprint: fingerprint,
              },
            },
          ],
        ),
      );

      await expect(
        gateway.reconcileCheckout({
          billingAccountId: "account-1",
          email: "test@example.com",
          productId: "prod-1",
          successUrl: "https://example.com/success",
          idempotencyKey: "checkout-paginated",
        }),
      ).resolves.toEqual({
        checkoutId: "checkout-paginated",
        checkoutUrl: "https://checkout.polar.sh/checkout-paginated",
      });
      expect(mockCreateCheckout).not.toHaveBeenCalled();
    });

    it("should normalize validation failures from checkout creation", async () => {
      const gateway = createGateway();

      mockGetExternal.mockResolvedValue({ id: "cust-existing" });
      mockCreateCheckout.mockRejectedValue(createValidationError());

      await expect(
        gateway.createCheckout({
          billingAccountId: "account-1",
          email: "test@example.com",
          productId: "prod-1",
          successUrl: "https://example.com/success",
          idempotencyKey: "checkout-validation",
        }),
      ).rejects.toBeInstanceOf(PolarValidationProblem);
    });
  });

  describe("cancelSubscription", () => {
    it("should revoke immediately when immediate is true", async () => {
      const gateway = createGateway();

      await gateway.cancelSubscription("sub-1", true, { idempotencyKey: "cancel-immediate-1" });

      expect(mockRevokeSubscription).toHaveBeenCalledWith(
        { id: "sub-1" },
        { headers: { "Idempotency-Key": "cancel-immediate-1" } },
      );
      expect(mockUpdateSubscription).not.toHaveBeenCalled();
    });

    it("should mark cancelAtPeriodEnd when immediate is false", async () => {
      const gateway = createGateway();

      await gateway.cancelSubscription("sub-1", false, { idempotencyKey: "cancel-period-end-1" });

      expect(mockUpdateSubscription).toHaveBeenCalledWith(
        {
          id: "sub-1",
          subscriptionUpdate: {
            cancelAtPeriodEnd: true,
          },
        },
        { headers: { "Idempotency-Key": "cancel-period-end-1" } },
      );
      expect(mockRevokeSubscription).not.toHaveBeenCalled();
    });

    it("should normalize subscription not-found failures", async () => {
      const gateway = createGateway();

      mockRevokeSubscription.mockRejectedValue(createNotFoundError());

      await expect(
        gateway.cancelSubscription("sub-missing", true, {
          idempotencyKey: "cancel-missing-1",
        }),
      ).rejects.toBeInstanceOf(PolarSubscriptionNotFoundProblem);
    });

    it("should treat an already-applied immediate cancellation retry as success", async () => {
      const gateway = createGateway();
      mockRevokeSubscription.mockRejectedValueOnce(
        Object.assign(new Error("already canceled"), {
          name: "AlreadyCanceledSubscription",
          error: "AlreadyCanceledSubscription",
        }),
      );
      mockGetSubscription.mockResolvedValue({
        status: "canceled",
        cancelAtPeriodEnd: false,
      });

      await expect(
        gateway.cancelSubscription("sub-1", true, {
          idempotencyKey: "cancel-immediate-retry-1",
        }),
      ).resolves.toBeUndefined();
      expect(mockGetSubscription).toHaveBeenCalledWith({ id: "sub-1" });
    });

    it("should not hide an already-canceled response when the requested target is absent", async () => {
      const gateway = createGateway();
      mockUpdateSubscription.mockRejectedValueOnce(
        Object.assign(new Error("already canceled"), {
          name: "AlreadyCanceledSubscription",
          error: "AlreadyCanceledSubscription",
        }),
      );
      mockGetSubscription.mockResolvedValue({
        status: "canceled",
        cancelAtPeriodEnd: false,
      });

      await expect(
        gateway.cancelSubscription("sub-1", false, {
          idempotencyKey: "cancel-period-end-mismatch-1",
        }),
      ).rejects.toMatchObject({
        code: "billing-polar/terminal-upstream",
      });
    });
  });

  describe("resumeSubscription", () => {
    it("should resume a subscription by clearing cancelAtPeriodEnd", async () => {
      const gateway = createGateway();

      await gateway.resumeSubscription("sub-1", { idempotencyKey: "resume-1" });

      expect(mockUpdateSubscription).toHaveBeenCalledWith(
        {
          id: "sub-1",
          subscriptionUpdate: {
            cancelAtPeriodEnd: false,
          },
        },
        { headers: { "Idempotency-Key": "resume-1" } },
      );
    });
  });

  describe("getCustomerPortalUrl", () => {
    it("should return the customer portal url", async () => {
      const gateway = createGateway();

      mockCreateCustomerSession.mockResolvedValue({
        customerPortalUrl: "https://polar.sh/portal/session-1",
      });

      const result = await gateway.getCustomerPortalUrl("cust-1");

      expect(result).toBe("https://polar.sh/portal/session-1");
      expect(mockCreateCustomerSession).toHaveBeenCalledWith({ customerId: "cust-1" });
    });
  });

  describe("configuration", () => {
    it("should fail fast when required Polar config is missing", () => {
      expect(() =>
        createGateway({
          accessToken: "",
          environment: "sandbox",
          webhookSecret: "webhook-secret",
        }),
      ).toThrow(PolarMissingConfigProblem);

      expect(() =>
        createGateway({
          accessToken: "polar-token",
          environment: "sandbox",
          webhookSecret: "",
        }),
      ).toThrow(PolarMissingConfigProblem);
    });
  });
});
