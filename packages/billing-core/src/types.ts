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
  readonly planId: string;
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

export type ProviderPriceBinding = {
  readonly provider: string;
  readonly productId: string;
  readonly priceId?: string;
};

export type PlanRatingDefinition =
  | {
      readonly mode: "provider-rated";
    }
  | {
      readonly mode: "croco-rated";
    };

/**
 * JSON-serializable, immutable definition of one published plan version.
 * ISO timestamps are used instead of Date values so definitions can be persisted and generated.
 */
export type PlanVersionDefinition = {
  readonly ref: PlanVersionRef;
  readonly planId: string;
  readonly version: string;
  readonly effectiveAt: string;
  readonly publishedAt: string;
  readonly plan: Readonly<Plan>;
  readonly rating: PlanRatingDefinition;
  readonly providerBindings: readonly ProviderPriceBinding[];
};

export type ProviderPlanMapping = {
  provider: string;
  productId: string;
  priceIds?: readonly string[];
};

export type SubscriptionPlanVersionMigration = {
  externalSubscriptionId: string;
  planId: string;
  planVersionRef: PlanVersionRef;
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
