import type { HealthSignal, SignalCategory } from '@croco/customer-health-core';
import { SignalProvider } from '@croco/customer-health-core';
import { Component, Inject, Token } from '@croco/framework-context';

/**
 * 구독 상태 값입니다.
 */
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

/**
 * 건강 점수 계산에 필요한 구독 데이터 구조입니다.
 */
export type SubscriptionData = {
  tenantId: string;
  status: SubscriptionStatus;
  planId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
};

/**
 * 구독 데이터를 제공하는 저장소 인터페이스입니다.
 */
export interface SubscriptionStorage {
  getSubscription(tenantId: string): Promise<SubscriptionData | null>;
}

/**
 * 구독 저장소 주입에 사용하는 토큰입니다.
 */
export const SUBSCRIPTION_STORAGE_TOKEN = new Token<SubscriptionStorage>('SUBSCRIPTION_STORAGE_TOKEN');

const STATUS_SCORE_MAP: Record<SubscriptionStatus, number> = {
  active: 100,
  trialing: 80,
  past_due: 30,
  canceled: 0,
} as const;

/**
 * 구독 상태를 business 카테고리 신호로 변환하는 구현체입니다.
 */
@Component()
export class BillingSignalProvider extends SignalProvider {
  readonly category: SignalCategory = 'business';

  /**
   * 구독 저장소를 받아 신호 제공자를 초기화합니다.
   */
  constructor(@Inject(SUBSCRIPTION_STORAGE_TOKEN) private readonly subscriptionStorage: SubscriptionStorage) {
    super();
  }

  /**
   * 테넌트의 구독 상태를 기반으로 비즈니스 신호를 수집합니다.
   */
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
