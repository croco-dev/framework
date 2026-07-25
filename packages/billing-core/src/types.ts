import type { Money } from "./libs/Money";

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "revoked" | "trialing";

export type BillingAccount = {
  id: string;
  tenantId: string;
  externalCustomerId: string;
  email: string;
  createdAt: Date;
};

export type Subscription = {
  id: string;
  billingAccountId: string;
  externalSubscriptionId: string;
  planId: string;
  readonly planVersionRef: PlanVersionRef;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  lastSyncedAt: Date;
};

export type LegacySubscription = Omit<Subscription, "planVersionRef">;

export type Order = {
  id: string;
  billingAccountId: string;
  externalOrderId: string;
  amount: number;
  currency: string;
  reason: "subscription_cycle" | "subscription_update" | "one_time";
  paidAt: Date;
};

export type ProcessedWebhook = {
  eventId: string;
  eventType: string;
  processedAt: Date;
};

export type PlanInterval = "month" | "year";

export type Plan = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: PlanInterval;
  intervalCount: number;
};

export type PlanVersionRef = string & {
  readonly __brand: unique symbol;
};

export type ProviderPlanBinding = {
  readonly provider: string;
  readonly productId: string;
  readonly priceIds: readonly string[];
};

export type PlanRatingDefinition =
  | {
      readonly mode: "provider";
      readonly provider: string;
    }
  | {
      readonly mode: "croco";
    };

export type PlanVersionDefinition = {
  readonly ref: PlanVersionRef;
  readonly planId: string;
  readonly versionId: string;
  readonly effectiveAt: string;
  readonly name: string;
  readonly amount: number;
  readonly currency: string;
  readonly interval: PlanInterval;
  readonly intervalCount: number;
  readonly rating: PlanRatingDefinition;
  readonly providerBindings: readonly ProviderPlanBinding[];
};

export type ProviderPlanLookup = {
  readonly provider: string;
  readonly productId: string;
  readonly priceIds: readonly string[];
};

export type InvoiceLineItemType = "subscription" | "proration" | "credit" | "one_time";

export type InvoiceLineItem = {
  id: string;
  description: string;
  type: InvoiceLineItemType;
  quantity: number;
  unitPrice: Money;
  total: Money;
  periodStart?: Date;
  periodEnd?: Date;
};

export type InvoiceStatus = "draft" | "open" | "paid" | "void";

export type Invoice = {
  id: string;
  billingAccountId: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  subtotal: Money;
  total: Money;
  status: InvoiceStatus;
  issuedAt: Date;
  dueAt?: Date;
  paidAt?: Date;
  externalInvoiceId?: string;
};
