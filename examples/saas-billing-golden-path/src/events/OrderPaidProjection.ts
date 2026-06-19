import { Container } from "@croco/framework-context";
import type { EventHandler } from "@croco/events-core";
import { AUDIT_LOG_TOKEN, type InMemoryAuditLog } from "../integrations/InMemoryAuditLog";
import type { OrderPaidEvent } from "./OrderPaidEvent";

export class OrderPaidProjection implements EventHandler<OrderPaidEvent> {
  private readonly auditLog = Container.get<InMemoryAuditLog>(AUDIT_LOG_TOKEN);

  handle(event: OrderPaidEvent): void {
    this.auditLog.append({
      at: event.timestamp.toISOString(),
      eventName: event.eventName,
      message: `Order ${event.orderId} was paid by ${event.customerId}.`,
      orderId: event.orderId,
    });
  }
}
