import type { EventHandler } from "@croco/events-core";
import type { InMemoryAuditLog } from "../integrations/InMemoryAuditLog";
import type { OrderPaidEvent } from "./OrderPaidEvent";

export class OrderPaidProjection implements EventHandler<OrderPaidEvent> {
  constructor(private readonly auditLog: InMemoryAuditLog) {}

  handle(event: OrderPaidEvent): void {
    this.auditLog.append({
      at: event.timestamp.toISOString(),
      eventName: event.eventName,
      message: `Order ${event.orderId} was paid by ${event.customerId}.`,
      orderId: event.orderId,
    });
  }
}
