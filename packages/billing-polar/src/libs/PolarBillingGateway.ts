import type { BillingGateway, CheckoutResult, CreateCheckoutParams } from '@croco/billing-core';
import { Component, type ILogger, Inject, LOGGER_TOKEN } from '@croco/framework-context';
import { Polar } from '@polar-sh/sdk';
import type { PolarConfig } from '../types';

const POLAR_RETRY_CONFIG = {
  strategy: 'backoff' as const,
  retryConnectionErrors: true,
  backoff: {
    initialInterval: 500,
    maxInterval: 5_000,
    exponent: 1.5,
    maxElapsedTime: 15_000,
  },
};

const POLAR_RETRY_CODES = ['429', '500', '502', '503', '504'];

type PolarLookupError = Error & {
  error?: string;
};

/**
 * Polar implementation of BillingGateway.
 */
@Component()
export class PolarBillingGateway implements BillingGateway {
  private readonly client: Polar;
  private readonly organizationId?: string;

  constructor(
    config: PolarConfig,
    @Inject(LOGGER_TOKEN) private readonly logger: ILogger
  ) {
    this.client = new Polar({
      accessToken: config.accessToken,
      server: config.environment,
    });
    this.organizationId = config.organizationId;
  }

  /**
   * Ensure a customer exists in Polar. Creates if not found.
   * Uses externalId to link with our tenantId.
   */
  async ensureCustomer(billingAccountId: string, email: string): Promise<string> {
    try {
      const existing = await this.client.customers.getExternal(
        {
          externalId: billingAccountId,
        },
        {
          retries: POLAR_RETRY_CONFIG,
          retryCodes: POLAR_RETRY_CODES,
        }
      );

      if (existing) {
        return existing.id;
      }
    } catch (error) {
      if (!this.isCustomerNotFoundError(error)) {
        throw error;
      }

      this.logger.info('Customer not found, creating new customer', {
        billingAccountId,
      });
    }

    const created = await this.client.customers.create({
      externalId: billingAccountId,
      email,
      organizationId: this.organizationId,
    });

    return created.id;
  }

  private isCustomerNotFoundError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const polarError = error as PolarLookupError;

    return polarError.name === 'ResourceNotFound' || polarError.error === 'ResourceNotFound';
  }

  /**
   * Create a checkout session for purchasing a product/subscription.
   */
  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const customerId = await this.ensureCustomer(params.billingAccountId, params.email);

    const checkout = await this.client.checkouts.create({
      products: [params.productId],
      customerId,
      successUrl: params.successUrl,
      ...(params.cancelUrl && { cancelUrl: params.cancelUrl }),
    });

    return {
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
    };
  }

  /**
   * Cancel a subscription.
   * @param immediate - If true, cancel immediately. Otherwise, cancel at period end.
   */
  async cancelSubscription(externalSubscriptionId: string, immediate = false): Promise<void> {
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
  }

  /**
   * Resume a subscription that was scheduled for cancellation.
   */
  async resumeSubscription(externalSubscriptionId: string): Promise<void> {
    await this.client.subscriptions.update({
      id: externalSubscriptionId,
      subscriptionUpdate: {
        cancelAtPeriodEnd: false,
      },
    });
  }

  /**
   * Get a URL for the customer portal where users can manage their subscription.
   */
  async getCustomerPortalUrl(externalCustomerId: string): Promise<string> {
    const session = await this.client.customerSessions.create({
      customerId: externalCustomerId,
    });

    return session.customerPortalUrl;
  }
}
