import type { BillingStore } from '@croco/billing-core';
import { SubscriptionProvider } from '@croco/entitlements-core';
import { Component, Inject, Token } from '@croco/framework-context';

/**
 * 빌링 스토어 주입에 사용하는 DI 토큰입니다.
 */
export const BILLING_STORE_TOKEN = new Token<BillingStore>('BILLING_STORE_TOKEN');

/**
 * 빌링 계정과 구독 정보를 이용해 현재 플랜 ID를 조회하는 구현체입니다.
 */
@Component()
export class BillingStoreSubscriptionProvider extends SubscriptionProvider {
  /**
   * 빌링 스토어를 받아 구독 제공자를 초기화합니다.
   */
  constructor(@Inject(BILLING_STORE_TOKEN) private readonly billingStore: BillingStore) {
    super();
  }

  /**
   * 테넌트의 현재 구독 플랜 ID를 반환합니다.
   */
  async getCurrentPlanId(tenantId: string): Promise<string | null> {
    const billingAccount = await this.billingStore.findAccountByTenantId(tenantId);
    if (!billingAccount) {
      return null;
    }

    const subscription = await this.billingStore.findSubscription(billingAccount.id);
    if (!subscription) {
      return null;
    }

    return subscription.planId;
  }
}
