import "reflect-metadata";
import { createTestingHarness, type CrocoTestingApp } from "@croco/testing";
import { TxManagerRegistry } from "@croco/tx-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGoldenPathRuntime, type GoldenPathRuntime } from "../app/bootstrap";

describe("SaaS billing golden path", () => {
  let runtime!: GoldenPathRuntime;
  let testing!: CrocoTestingApp;

  beforeEach(async () => {
    runtime = await createGoldenPathRuntime();
    testing = createTestingHarness(runtime.app);
  });

  afterEach(() => {
    runtime.eventBusConfig.clear();
    TxManagerRegistry.clear();
  });

  it("checks out an order, retries transient payment failure, and records the after-commit audit event", async () => {
    const response = await testing.post("/api/checkouts", {
      json: {
        customerId: "cus_acme",
        paymentToken: "retry_once",
        planId: "growth",
        seats: 3,
      },
    });

    expect(response.status).toBe(200);
    const body = await testing.readJson<{
      transaction: {
        status: "committed";
        value: {
          amountCents: number;
          customerId: string;
          id: string;
          paymentId: string;
          planId: string;
          seats: number;
          status: string;
        };
        afterCommit: {
          status: "succeeded";
          hookCount: number;
        };
      };
      paymentAttempts: number;
    }>(response);

    expect(body).toMatchObject({
      transaction: {
        status: "committed",
        value: {
          amountCents: 23700,
          customerId: "cus_acme",
          id: "ord_0001",
          paymentId: "pay_ord_0001_2",
          planId: "growth",
          seats: 3,
          status: "paid",
        },
        afterCommit: {
          status: "succeeded",
          hookCount: 1,
        },
      },
      paymentAttempts: 2,
    });
    expect(runtime.paymentGateway.getAttemptCount("ord_0001")).toBe(2);
    expect(runtime.repository.list()).toHaveLength(1);

    const orderResponse = await testing.get("/api/orders/ord_0001");
    expect(orderResponse.status).toBe(200);
    await expect(testing.readJson(orderResponse)).resolves.toMatchObject({
      id: "ord_0001",
      status: "paid",
    });

    const auditResponse = await testing.get("/api/backoffice/audit");
    expect(auditResponse.status).toBe(200);
    await expect(testing.readJson(auditResponse)).resolves.toMatchObject({
      entries: [
        {
          eventName: "billing.order.paid",
          message: "Order ord_0001 was paid by cus_acme.",
          orderId: "ord_0001",
        },
      ],
    });
  });

  it("returns a validation Problem before payment or persistence when checkout input is invalid", async () => {
    const response = await testing.post("/api/checkouts", {
      json: {
        customerId: "cus_acme",
        paymentToken: "tok_live",
        planId: "starter",
        seats: 0,
      },
    });

    expect(response.status).toBe(422);
    await testing.assertProblem(response, {
      code: "golden-path/checkout-validation",
      detailIncludes: "seats must be an integer between 1 and 100",
      status: 422,
    });
    expect(runtime.repository.list()).toHaveLength(0);
    expect(runtime.auditLog.list()).toHaveLength(0);
  });

  it("does not retry terminal payment Problems and does not persist the order", async () => {
    const response = await testing.post("/api/checkouts", {
      json: {
        customerId: "cus_acme",
        paymentToken: "card_declined",
        planId: "starter",
        seats: 1,
      },
    });

    expect(response.status).toBe(422);
    await testing.assertProblem(response, {
      code: "golden-path/payment-declined",
      detailIncludes: "Payment was declined by the gateway.",
      status: 422,
    });
    expect(runtime.paymentGateway.getAttemptCount("ord_0001")).toBe(1);
    expect(runtime.repository.list()).toHaveLength(0);
    expect(runtime.auditLog.list()).toHaveLength(0);
  });

  it("returns a not-found Problem for unknown orders", async () => {
    const response = await testing.get("/api/orders/missing");

    expect(response.status).toBe(404);
    await testing.assertProblem(response, {
      code: "golden-path/order-not-found",
      detailIncludes: "Order 'missing' was not found.",
      status: 404,
    });
  });
});
