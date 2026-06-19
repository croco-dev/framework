import { Container } from "@croco/framework-context";
import { Body, Controller, Get, Param, Post } from "@croco/protocols-rest";
import { CheckoutService } from "../domain/CheckoutService";
import type { CheckoutRequest } from "../domain/types";
import { AUDIT_LOG_TOKEN, type InMemoryAuditLog } from "../integrations/InMemoryAuditLog";

@Controller("/api")
export class BillingController {
  private readonly auditLog = Container.get<InMemoryAuditLog>(AUDIT_LOG_TOKEN);
  private readonly checkoutService = Container.get(CheckoutService);

  @Post("/checkouts")
  checkout(@Body() body: CheckoutRequest) {
    return this.checkoutService.checkout(body);
  }

  @Get("/orders/:id")
  getOrder(@Param("id") id: string) {
    return this.checkoutService.getOrder(id);
  }

  @Get("/backoffice/audit")
  listAuditTrail() {
    return {
      entries: this.auditLog.list(),
    };
  }
}
