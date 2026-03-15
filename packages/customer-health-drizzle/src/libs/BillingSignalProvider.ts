import type { HealthSignal, SignalCategory } from '@croco/customer-health-core';
import { SignalProvider } from '@croco/customer-health-core';
import { Component, Inject, Token } from '@croco/framework-context';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

export type SubscriptionData = {
  tenantId: string;
  status: SubscriptionStatus;
  planId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

export interface SubscriptionStorage {
  getSubscription(tenantId: string): Promise<SubscriptionData | null>;
}

const SUBSCRIPTION_STORAGE_TOKEN = new Token<SubscriptionStorage>('SUBSCRIPTION_STORAGE_TOKEN');

const STATUS_SCORE_MAP: Record<SubscriptionStatus, number> = {
  active: 100,
  trialing: 80,
  past_due: 30,
  canceled: 0,
} as const;

@Component()
export class BillingSignalProvider extends SignalProvider {
  readonly category: SignalCategory = 'business';

  constructor(@Inject(SUBSCRIPTION_STORAGE_TOKEN) private readonly subscriptionStorage: SubscriptionStorage) {
    super();
  }

  async collect(tenantId: string): Promise<HealthSignal[]> {
    const subscription = await this.subscriptionStorage.getSubscription(tenantId);
    const now = new Date();

    if (!subscription) {
      return [
        {
          category: 'business',
          name: 'subscription_status',
          value: 0,
          weight: 1.0,
          rawValue: { status: null, hasSubscription: false },
          collectedAt: now,
        },
      ];
    }

    const statusScore = STATUS_SCORE_MAP[subscription.status];

    const signals: HealthSignal[] = [
      {
        category: 'business',
        name: 'subscription_status',
        value: statusScore,
        weight: 0.7,
        rawValue: {
          status: subscription.status,
          planId: subscription.planId,
        },
        collectedAt: now,
      },
    ];

    if (subscription.cancelAtPeriodEnd) {
      signals.push({
        category: 'business',
        name: 'cancellation_scheduled',
        value: 50,
        weight: 0.3,
        rawValue: {
          cancelAtPeriodEnd: true,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
        collectedAt: now,
      });
    }

    return signals;
  }
}
