import { DomainEvent, EventField, RegisterEvent } from "@croco/events-core";

@RegisterEvent()
export class OrderPaidEvent extends DomainEvent {
  static override eventName = "billing.order.paid";

  @EventField()
  readonly amountCents: number;

  @EventField()
  readonly customerId: string;

  @EventField()
  readonly orderId: string;

  @EventField()
  readonly paymentId: string;

  constructor(input: {
    readonly amountCents: number;
    readonly customerId: string;
    readonly orderId: string;
    readonly paymentId: string;
  }) {
    super();
    this.amountCents = input.amountCents;
    this.customerId = input.customerId;
    this.orderId = input.orderId;
    this.paymentId = input.paymentId;
  }
}
