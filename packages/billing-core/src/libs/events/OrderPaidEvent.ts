import { DomainEvent } from "@croco/events-core";
import type { OrderPaymentReason, OrderSubscriptionEvidence } from "../../types";

export class OrderPaidEvent extends DomainEvent {
  static readonly eventName = "billing.order_paid";
  static fromPayload(payload: Record<string, unknown>): OrderPaidEvent {
    return new OrderPaidEvent(
      payload.tenantId as string,
      payload.externalOrderId as string,
      payload.amount as number,
      payload.currency as string,
      payload.reason as OrderPaymentReason,
      payload.subscription as OrderSubscriptionEvidence | undefined,
    );
  }

  constructor(
    public readonly tenantId: string,
    public readonly externalOrderId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly reason: OrderPaymentReason,
    public readonly subscription?: OrderSubscriptionEvidence,
  ) {
    super();
  }
}
