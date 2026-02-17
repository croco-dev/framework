import type { BillingStore, Subscription } from '@croco/billing-core';
import type { EventPublisher } from '@croco/events-core';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/dist/esm/webhooks.js';
import type { PolarConfig, WebhookHandlerResult } from '../types';
import { PolarEventMapper } from './PolarEventMapper';

export type WebhookDependencies = {
  store: BillingStore;
  eventPublisher: EventPublisher;
};

/**
 * Handles incoming Polar webhooks with signature verification and idempotency.
 */
export class PolarWebhookHandler {
  private readonly store: BillingStore;
  private readonly eventPublisher: EventPublisher;
  private readonly eventMapper: PolarEventMapper;
  private readonly webhookSecret: string;
  private readonly inFlightEvents = new Map<string, Promise<WebhookHandlerResult>>();

  constructor(config: PolarConfig, deps: WebhookDependencies) {
    this.webhookSecret = config.webhookSecret;
    this.store = deps.store;
    this.eventPublisher = deps.eventPublisher;
    this.eventMapper = new PolarEventMapper();
  }

  /**
   * Handle an incoming webhook request.
   * @param body - Raw request body (Buffer or string)
   * @param headers - Request headers
   */
  async handle(body: Buffer | string, headers: Record<string, string>): Promise<WebhookHandlerResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let event: any;
    try {
      event = validateEvent(body, headers, this.webhookSecret);
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        return {
          success: false,
          error: `Webhook verification failed: ${error.message}`,
        };
      }
      return {
        success: false,
        error: `Webhook verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventId = (event as any).id ?? headers['webhook-id'];
    const eventType = (event as any).type;

    if (!eventId || !eventType) {
      return { success: false, error: 'Missing event ID or type' };
    }

    if (await this.store.isWebhookProcessed(eventId)) {
      return { success: true, eventId };
    }

    const inFlightEvent = this.inFlightEvents.get(eventId);
    if (inFlightEvent) {
      return inFlightEvent;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processingEvent = this.processEventAtomically(eventId, eventType, (event as any).data);
    this.inFlightEvents.set(eventId, processingEvent);

    try {
      return await processingEvent;
    } finally {
      this.inFlightEvents.delete(eventId);
    }
  }

  private async processEventAtomically(
    eventId: string,
    eventType: string,
    data: unknown
  ): Promise<WebhookHandlerResult> {
    try {
      await this.processEvent(eventType, data);
      await this.store.markWebhookProcessed({
        eventId,
        eventType,
        processedAt: new Date(),
      });

      return { success: true, eventId };
    } catch (error) {
      return {
        success: false,
        eventId,
        error: `Event processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async processEvent(eventType: string, data: unknown): Promise<void> {
    if (eventType.startsWith('subscription.')) {
      await this.handleSubscriptionEvent(eventType, data);
    } else if (eventType.startsWith('order.')) {
      await this.handleOrderEvent(eventType, data);
    }
  }

  private async handleSubscriptionEvent(eventType: string, data: unknown): Promise<void> {
    const subscriptionData = data as {
      id: string;
      customer: { externalId: string | null; metadata: Record<string, unknown> };
      product: { id: string };
      status: string;
      currentPeriodEnd: Date | string | null;
      cancelAtPeriodEnd: boolean;
    };

    const tenantId = subscriptionData.customer.externalId || (subscriptionData.customer.metadata?.tenantId as string);

    if (!tenantId) {
      throw new Error('Customer externalId (tenantId) not found in webhook payload');
    }

    const previousSubscription = await this.store.findSubscription(tenantId);
    const previousPlanId = previousSubscription?.planId;

    if (!subscriptionData.currentPeriodEnd) {
      throw new Error('currentPeriodEnd is required');
    }

    const subscription: Subscription = {
      id: subscriptionData.id,
      billingAccountId: tenantId,
      externalSubscriptionId: subscriptionData.id,
      planId: subscriptionData.product.id,
      status: this.mapStatus(subscriptionData.status),
      currentPeriodEnd: new Date(subscriptionData.currentPeriodEnd),
      cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
      lastSyncedAt: new Date(),
    };
    await this.store.saveSubscription(subscription);

    const domainEvents = this.eventMapper.mapSubscriptionEvent(
      eventType,
      tenantId,
      {
        id: subscriptionData.id,
        productId: subscriptionData.product.id,
        status: subscriptionData.status,
        cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd,
      },
      previousPlanId
    );

    for (const event of domainEvents) {
      await this.eventPublisher.publish(event);
    }
  }

  private async handleOrderEvent(eventType: string, data: unknown): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orderData = data as any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customer = (orderData as any).customer;
    const tenantId = customer.externalId || customer.metadata?.tenantId;

    if (!tenantId) {
      throw new Error('Customer externalId (tenantId) not found');
    }

    await this.store.saveOrder({
      id: orderData.id,
      billingAccountId: tenantId,
      externalOrderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      reason: 'subscription_cycle',
      // Using createdAt as paidAt proxy if paidAt missing
      paidAt: new Date(orderData.createdAt || new Date()),
    });

    const domainEvents = this.eventMapper.mapOrderEvent(eventType, tenantId, {
      id: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
    });

    for (const event of domainEvents) {
      await this.eventPublisher.publish(event);
    }
  }

  private mapStatus(polarStatus: string): 'active' | 'past_due' | 'canceled' | 'revoked' | 'trialing' {
    switch (polarStatus) {
      case 'active':
        return 'active';
      case 'past_due':
        return 'past_due';
      case 'canceled':
        return 'canceled';
      case 'revoked':
        return 'revoked';
      case 'trialing':
        return 'trialing';
      default:
        throw new Error(`Unknown Polar status: ${polarStatus}`);
    }
  }
}
