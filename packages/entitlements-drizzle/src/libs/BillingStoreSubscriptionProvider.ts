import type { BillingStore } from '@croco/billing-core';
import { SubscriptionProvider } from '@croco/entitlements-core';
import { Component, Inject, Token } from '@croco/framework-context';

export const BILLING_STORE_TOKEN = new Token<BillingStore>('BILLING_STORE_TOKEN');

@Component()
export class BillingStoreSubscriptionProvider extends SubscriptionProvider {
  constructor(@Inject(BILLING_STORE_TOKEN) private readonly billingStore: BillingStore) {
    super();
  }

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
