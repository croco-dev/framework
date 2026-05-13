import type { EventPublisher } from "@croco/events-core";
import { Trace } from "@croco/telemetry-api";
import type { Subscription, SubscriptionStatus } from "../types";
import type { BillingGateway, CreateCheckoutParams } from "./BillingGateway";
import type { BillingStore } from "./BillingStore";
import { SubscriptionCanceledEvent } from "./events/SubscriptionCanceledEvent";
import {
  BillingAccountNotFoundProblem,
  BillingCheckoutCreationProblem,
  SubscriptionNotFoundProblem,
} from "./problems/BillingProblems";

export type BillingServiceDependencies = {
  store: BillingStore;
  gateway: BillingGateway;
  eventPublisher?: EventPublisher;
};

export type CreateBillingCheckoutParams = Omit<CreateCheckoutParams, "billingAccountId"> & {
  tenantId: string;
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
    const subscription = await this.findSubscriptionByTenantId(tenantId);
    if (!subscription) return false;
    return subscription.status === "active" || subscription.status === "trialing";
  }

  /**
   * Get subscription status for a tenant.
   */
  async getSubscriptionStatus(tenantId: string): Promise<SubscriptionStatus | null> {
    const subscription = await this.findSubscriptionByTenantId(tenantId);
    return subscription?.status ?? null;
  }

  /**
   * Get full subscription details.
   */
  async getSubscription(tenantId: string): Promise<Subscription | null> {
    return this.findSubscriptionByTenantId(tenantId);
  }

  /**
   * Create a checkout session for a tenant.
   */
  @Trace({ name: "billing.checkout.create" })
  async createCheckout(params: CreateBillingCheckoutParams): Promise<{ checkoutUrl: string }> {
    const account = await this.store.findAccountByTenantId(params.tenantId);

    if (account) {
      const result = await this.gateway.createCheckout(
        this.toGatewayCheckoutParams(params, account.id),
      );
      return { checkoutUrl: result.checkoutUrl };
    }

    return this.createCheckoutWithAccountTransaction(params);
  }

  private async createCheckoutWithAccountTransaction(
    params: CreateBillingCheckoutParams,
  ): Promise<{ checkoutUrl: string }> {
    const billingAccountId = params.tenantId;
    const externalCustomerId = await this.gateway.ensureCustomer(billingAccountId, params.email);
    const accountDraft = {
      id: billingAccountId,
      tenantId: params.tenantId,
      externalCustomerId,
      email: params.email,
      createdAt: new Date(),
    };

    try {
      await this.store.saveAccount(accountDraft);
      const result = await this.gateway.createCheckout(
        this.toGatewayCheckoutParams(params, billingAccountId),
      );
      return { checkoutUrl: result.checkoutUrl };
    } catch (error) {
      throw this.createCheckoutError(params.tenantId, error);
    }
  }

  private toGatewayCheckoutParams(
    params: CreateBillingCheckoutParams,
    billingAccountId: string,
  ): CreateCheckoutParams {
    return {
      billingAccountId,
      email: params.email,
      productId: params.productId,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
    };
  }

  private createCheckoutError(
    billingAccountId: string,
    error: unknown,
  ): BillingCheckoutCreationProblem {
    if (error instanceof Error) {
      return new BillingCheckoutCreationProblem(
        billingAccountId,
        `Failed to create checkout for tenant ${billingAccountId}: ${error.message}`,
      );
    }

    return new BillingCheckoutCreationProblem(billingAccountId);
  }

  /**
   * Cancel a subscription (at period end by default).
   */
  @Trace({ name: "billing.subscription.cancel" })
  async cancelSubscription(tenantId: string, immediate = false): Promise<void> {
    const subscription = await this.findSubscriptionByTenantId(tenantId);
    if (!subscription) {
      throw new SubscriptionNotFoundProblem(tenantId);
    }

    await this.gateway.cancelSubscription(subscription.externalSubscriptionId, immediate);

    if (immediate) {
      await this.cleanupCanceledSubscription(subscription);
    } else {
      await this.store.saveSubscription({
        ...subscription,
        cancelAtPeriodEnd: true,
        status: subscription.status,
        lastSyncedAt: new Date(),
      });
    }

    if (this.eventPublisher) {
      await this.eventPublisher.publishNow(
        new SubscriptionCanceledEvent(tenantId, subscription.externalSubscriptionId, !immediate),
      );
    }
  }

  /**
   * Resume a canceled subscription.
   */
  @Trace({ name: "billing.subscription.resume" })
  async resumeSubscription(tenantId: string): Promise<void> {
    const subscription = await this.findSubscriptionByTenantId(tenantId);
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
  @Trace({ name: "billing.portal.get" })
  async getCustomerPortalUrl(tenantId: string): Promise<string> {
    const account = await this.store.findAccountByTenantId(tenantId);
    if (!account) {
      throw new BillingAccountNotFoundProblem(tenantId);
    }

    return this.gateway.getCustomerPortalUrl(account.externalCustomerId);
  }

  private async findSubscriptionByTenantId(tenantId: string): Promise<Subscription | null> {
    const account = await this.store.findAccountByTenantId(tenantId);
    if (!account) {
      return null;
    }

    return this.store.findSubscription(account.id);
  }

  private async cleanupCanceledSubscription(subscription: Subscription): Promise<void> {
    const orders = await this.store.findOrdersByAccount(subscription.billingAccountId);

    if (orders.length > 0) {
      await this.store.saveSubscription({
        ...subscription,
        cancelAtPeriodEnd: false,
        status: "canceled",
        lastSyncedAt: new Date(),
      });
      return;
    }

    await this.store.deleteSubscription(subscription.billingAccountId);
    await this.store.deleteAccount(subscription.billingAccountId);
  }
}
