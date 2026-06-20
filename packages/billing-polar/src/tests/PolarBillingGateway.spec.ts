import type { ILogger } from "@croco/framework-context";
import { createBillingProviderConformanceSuite } from "@croco/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolarBillingGateway } from "../libs/PolarBillingGateway";
import {
  PolarCustomerNotFoundProblem,
  PolarMissingConfigProblem,
  PolarRetryableUpstreamProblem,
  PolarSubscriptionNotFoundProblem,
  PolarValidationProblem,
} from "../libs/problems/PolarBillingProblems";
import type { PolarConfig } from "../types";

const mockGetExternal = vi.fn();
const mockCreateCustomer = vi.fn();
const mockCreateCheckout = vi.fn();
const mockRevokeSubscription = vi.fn();
const mockUpdateSubscription = vi.fn();
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
    };

    readonly subscriptions = {
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
  mockGetExternal.mockResolvedValue({ id: "cust-existing" });
  mockCreateCustomer.mockResolvedValue({ id: "cust-created" });
  mockCreateCheckout.mockResolvedValue({
    id: "checkout-conformance",
    url: "https://checkout.polar.sh/checkout-conformance",
  });
  mockCreateCustomerSession.mockResolvedValue({
    customerPortalUrl: "https://polar.sh/portal/session-conformance",
  });
  mockRevokeSubscription.mockResolvedValue(undefined);
  mockUpdateSubscription.mockResolvedValue(undefined);
}

describe("PolarBillingGateway", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("billing provider conformance", () => {
    it.each(
      createBillingProviderConformanceSuite({
        providerName: "billing-polar",
        gateway: {
          createGateway: () => {
            setupSuccessfulGatewayBackend();
            return createGateway();
          },
          fixtures: {
            checkout: {
              billingAccountId: "account-conformance",
              email: "billing@example.com",
              productId: "prod-conformance",
              successUrl: "https://example.com/success",
              cancelUrl: "https://example.com/cancel",
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
              expect(mockUpdateSubscription).toHaveBeenNthCalledWith(1, {
                id: "sub-conformance",
                subscriptionUpdate: {
                  cancelAtPeriodEnd: true,
                },
              });
              expect(mockUpdateSubscription).toHaveBeenNthCalledWith(2, {
                id: "sub-conformance",
                subscriptionUpdate: {
                  cancelAtPeriodEnd: false,
                },
              });
              expect(mockRevokeSubscription).toHaveBeenCalledWith({ id: "sub-conformance" });
            },
          },
          failureScenarios: [
            {
              name: "surfaces retryable upstream checkout failures as Croco Problems",
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
                }),
              assertProblem: (problem) => {
                expect(problem).toBeInstanceOf(PolarRetryableUpstreamProblem);
                expect(problem.code).toBe("billing-polar/retryable-upstream");
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
      });
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
        }),
      ).rejects.toBeInstanceOf(PolarValidationProblem);
    });
  });

  describe("cancelSubscription", () => {
    it("should revoke immediately when immediate is true", async () => {
      const gateway = createGateway();

      await gateway.cancelSubscription("sub-1", true);

      expect(mockRevokeSubscription).toHaveBeenCalledWith({ id: "sub-1" });
      expect(mockUpdateSubscription).not.toHaveBeenCalled();
    });

    it("should mark cancelAtPeriodEnd when immediate is false", async () => {
      const gateway = createGateway();

      await gateway.cancelSubscription("sub-1", false);

      expect(mockUpdateSubscription).toHaveBeenCalledWith({
        id: "sub-1",
        subscriptionUpdate: {
          cancelAtPeriodEnd: true,
        },
      });
      expect(mockRevokeSubscription).not.toHaveBeenCalled();
    });

    it("should normalize subscription not-found failures", async () => {
      const gateway = createGateway();

      mockRevokeSubscription.mockRejectedValue(createNotFoundError());

      await expect(gateway.cancelSubscription("sub-missing", true)).rejects.toBeInstanceOf(
        PolarSubscriptionNotFoundProblem,
      );
    });
  });

  describe("resumeSubscription", () => {
    it("should resume a subscription by clearing cancelAtPeriodEnd", async () => {
      const gateway = createGateway();

      await gateway.resumeSubscription("sub-1");

      expect(mockUpdateSubscription).toHaveBeenCalledWith({
        id: "sub-1",
        subscriptionUpdate: {
          cancelAtPeriodEnd: false,
        },
      });
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
