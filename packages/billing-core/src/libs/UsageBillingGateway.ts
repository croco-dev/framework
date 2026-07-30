export type UsageBillingDimensionValue = string | number | boolean;

export type UsageBillingEvent = {
  readonly billingAccountId: string;
  readonly dimensions?: Readonly<Record<string, UsageBillingDimensionValue>>;
  readonly eventId: string;
  readonly meterId: string;
  readonly occurredAt: Date;
  readonly value: number;
};

export type InsertedUsageBillingEventReceipt = {
  readonly eventId: string;
  readonly status: "inserted";
};

export type DuplicateUsageBillingEventReceipt = {
  readonly eventId: string;
  readonly status: "duplicate";
};

export type UsageBillingEventReceipt =
  | InsertedUsageBillingEventReceipt
  | DuplicateUsageBillingEventReceipt;

export type UsageBillingBatchReceipt = {
  readonly receipts: readonly UsageBillingEventReceipt[];
};

export type CustomerMeterStateQuery = {
  readonly billingAccountId: string;
  readonly meterId: string;
};

export type CustomerMeterState = {
  readonly billingAccountId: string;
  readonly meterId: string;
  readonly updatedAt: Date;
  readonly value: number;
};

/**
 * Provider-neutral usage billing capability.
 *
 * Duplicate events are successful acknowledgements and must be returned with a `duplicate` receipt.
 */
export interface UsageBillingGateway {
  ingest(events: readonly UsageBillingEvent[]): Promise<UsageBillingBatchReceipt>;
  getCustomerMeterState(query: CustomerMeterStateQuery): Promise<CustomerMeterState | null>;
}
