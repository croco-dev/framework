export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'revoked' | 'trialing';

export type BillingAccount = {
  id: string;
  externalCustomerId: string;
  email: string;
  createdAt: Date;
};

export type Subscription = {
  id: string;
  billingAccountId: string;
  externalSubscriptionId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  lastSyncedAt: Date;
};

export type Order = {
  id: string;
  billingAccountId: string;
  externalOrderId: string;
  amount: number;
  currency: string;
  reason: 'subscription_cycle' | 'subscription_update' | 'one_time';
  paidAt: Date;
};

export type ProcessedWebhook = {
  eventId: string;
  eventType: string;
  processedAt: Date;
};
