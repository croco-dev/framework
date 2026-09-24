import { Body, Controller, Get, Param, Post } from "@croco/protocols-rest";
import type { CheckoutService } from "../domain/CheckoutService";
import type { CheckoutRequest } from "../domain/types";
import type { InMemoryAuditLog } from "../integrations/InMemoryAuditLog";

@Controller("/api")
export class BillingController {
  constructor(
    private readonly auditLog: InMemoryAuditLog,
    private readonly checkoutService: CheckoutService,
  ) {}

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
