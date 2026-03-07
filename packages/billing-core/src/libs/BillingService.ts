import type { EventPublisher } from '@croco/events-core';
import type { Subscription, SubscriptionStatus } from '../types';
import type { BillingGateway, CreateCheckoutParams } from './BillingGateway';
import type { BillingStore } from './BillingStore';
import { SubscriptionCanceledEvent } from './events/SubscriptionCanceledEvent';
import {
  BillingAccountNotFoundProblem,
  BillingCheckoutCreationProblem,
  SubscriptionNotFoundProblem,
} from './problems/BillingProblems';

export type BillingServiceDependencies = {
  store: BillingStore;
  gateway: BillingGateway;
  eventPublisher?: EventPublisher;
};

/**
 * Billing service for subscription management.
 * Orchestrates store and gateway operations.
 */
export class BillingService {
  private readonly store: BillingStore;
  private readonly gateway: BillingGateway;
  private readonly eventPublisher?: EventPublisher;

  constructor(deps: BillingServiceDependencies) {
    this.store = deps.store;
    this.gateway = deps.gateway;
    this.eventPublisher = deps.eventPublisher;
  }

  /**
   * Check if a tenant has an active subscription.
   */
  async hasActiveSubscription(tenantId: string): Promise<boolean> {
    const subscription = await this.store.findSubscription(tenantId);
    if (!subscription) return false;
    return subscription.status === 'active' || subscription.status === 'trialing';
  }

  /**
   * Get subscription status for a tenant.
   */
  async getSubscriptionStatus(tenantId: string): Promise<SubscriptionStatus | null> {
    const subscription = await this.store.findSubscription(tenantId);
    return subscription?.status ?? null;
  }

  /**
   * Get full subscription details.
   */
  async getSubscription(tenantId: string): Promise<Subscription | null> {
    return this.store.findSubscription(tenantId);
  }

  /**
   * Create a checkout session for a tenant.
   */
  async createCheckout(params: CreateCheckoutParams): Promise<{ checkoutUrl: string }> {
    const account = await this.store.findAccountByTenantId(params.billingAccountId);

    if (account) {
      const result = await this.gateway.createCheckout(params);
      return { checkoutUrl: result.checkoutUrl };
    }

    return this.createCheckoutWithAccountTransaction(params);
  }

  private async createCheckoutWithAccountTransaction(params: CreateCheckoutParams): Promise<{ checkoutUrl: string }> {
    const externalCustomerId = await this.gateway.ensureCustomer(params.billingAccountId, params.email);
    const accountDraft = {
      id: params.billingAccountId,
      externalCustomerId,
      email: params.email,
      createdAt: new Date(),
    };

    try {
      const result = await this.gateway.createCheckout(params);
      await this.store.saveAccount(accountDraft);
      return { checkoutUrl: result.checkoutUrl };
    } catch (error) {
      throw this.createCheckoutError(params.billingAccountId, error);
    }
  }

  private createCheckoutError(billingAccountId: string, error: unknown): BillingCheckoutCreationProblem {
    if (error instanceof Error) {
      return new BillingCheckoutCreationProblem(
        billingAccountId,
        `Failed to create checkout for tenant ${billingAccountId}: ${error.message}`
      );
    }

    return new BillingCheckoutCreationProblem(billingAccountId);
  }

  /**
   * Cancel a subscription (at period end by default).
   */
  async cancelSubscription(tenantId: string, immediate = false): Promise<void> {
    const subscription = await this.store.findSubscription(tenantId);
    if (!subscription) {
      throw new SubscriptionNotFoundProblem(tenantId);
    }

    await this.gateway.cancelSubscription(subscription.externalSubscriptionId, immediate);

    await this.store.saveSubscription({
      ...subscription,
      cancelAtPeriodEnd: !immediate,
      status: immediate ? 'canceled' : subscription.status,
      lastSyncedAt: new Date(),
    });

    if (this.eventPublisher) {
      await this.eventPublisher.publish(
        new SubscriptionCanceledEvent(tenantId, subscription.externalSubscriptionId, !immediate)
      );
    }
  }

  /**
   * Resume a canceled subscription.
   */
  async resumeSubscription(tenantId: string): Promise<void> {
    const subscription = await this.store.findSubscription(tenantId);
    if (!subscription) {
      throw new SubscriptionNotFoundProblem(tenantId);
    }

    await this.gateway.resumeSubscription(subscription.externalSubscriptionId);

    await this.store.saveSubscription({
      ...subscription,
      cancelAtPeriodEnd: false,
      lastSyncedAt: new Date(),
    });
  }

  /**
   * Get customer portal URL.
   */
  async getCustomerPortalUrl(tenantId: string): Promise<string> {
    const account = await this.store.findAccountByTenantId(tenantId);
    if (!account) {
      throw new BillingAccountNotFoundProblem(tenantId);
    }

    return this.gateway.getCustomerPortalUrl(account.externalCustomerId);
  }
}
