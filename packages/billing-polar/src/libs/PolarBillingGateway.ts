import type { BillingGateway, CheckoutResult, CreateCheckoutParams } from "@croco/billing-core";
import type { ILogger } from "@croco/framework-context";
import { Component, Inject, LOGGER_TOKEN } from "@croco/framework-context";
import { Polar } from "@polar-sh/sdk";
import type { PolarConfig } from "../types";
import { normalizePolarBillingError, validatePolarConfig } from "./problems/PolarBillingProblems";

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

type PolarLookupError = Error & {
  error?: string;
};

@Component()
export class PolarBillingGateway implements BillingGateway {
  private readonly client: Polar;
  private readonly organizationId?: string;

  constructor(
    config: PolarConfig,
    @Inject(LOGGER_TOKEN) private readonly logger: ILogger,
  ) {
    const validConfig = validatePolarConfig(config);

    this.client = new Polar({
      accessToken: validConfig.accessToken,
      server: validConfig.environment,
    });
    this.organizationId = validConfig.organizationId;
  }

  async ensureCustomer(billingAccountId: string, email: string): Promise<string> {
    try {
      const existing = await this.client.customers.getExternal(
        {
          externalId: billingAccountId,
        },
        {
          retries: POLAR_RETRY_CONFIG,
          retryCodes: POLAR_RETRY_CODES,
        },
      );

      if (existing) {
        return existing.id;
      }
    } catch (error) {
      if (!this.isCustomerNotFoundError(error)) {
        throw normalizePolarBillingError(error, "ensureCustomer.lookup");
      }

      this.logger.info("Customer not found, creating new customer", {
        billingAccountId,
      });
    }

    let created: { id: string };
    try {
      created = await this.client.customers.create({
        externalId: billingAccountId,
        email,
        organizationId: this.organizationId,
      });
    } catch (error) {
      throw normalizePolarBillingError(error, "ensureCustomer.create");
    }

    return created.id;
  }

  private isCustomerNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const polarError = error as PolarLookupError;

    return polarError.name === "ResourceNotFound" || polarError.error === "ResourceNotFound";
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const customerId = await this.ensureCustomer(params.billingAccountId, params.email);

    let checkout: { id: string; url: string };
    try {
      checkout = await this.client.checkouts.create({
        products: [params.productId],
        customerId,
        successUrl: params.successUrl,
        ...(params.cancelUrl && { cancelUrl: params.cancelUrl }),
      });
    } catch (error) {
      throw normalizePolarBillingError(error, "createCheckout");
    }

    return {
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
    };
  }

  async cancelSubscription(externalSubscriptionId: string, immediate = false): Promise<void> {
    try {
      if (immediate) {
        await this.client.subscriptions.revoke({
          id: externalSubscriptionId,
        });
      } else {
        await this.client.subscriptions.update({
          id: externalSubscriptionId,
          subscriptionUpdate: {
            cancelAtPeriodEnd: true,
          },
        });
      }
    } catch (error) {
      throw normalizePolarBillingError(error, "cancelSubscription");
    }
  }

  async resumeSubscription(externalSubscriptionId: string): Promise<void> {
    try {
      await this.client.subscriptions.update({
        id: externalSubscriptionId,
        subscriptionUpdate: {
          cancelAtPeriodEnd: false,
        },
      });
    } catch (error) {
      throw normalizePolarBillingError(error, "resumeSubscription");
    }
  }

  async getCustomerPortalUrl(externalCustomerId: string): Promise<string> {
    let session: { customerPortalUrl: string };
    try {
      session = await this.client.customerSessions.create({
        customerId: externalCustomerId,
      });
    } catch (error) {
      throw normalizePolarBillingError(error, "getCustomerPortalUrl");
    }

    return session.customerPortalUrl;
  }
}
