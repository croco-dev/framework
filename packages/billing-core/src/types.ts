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
