import "reflect-metadata";
import { createTestingHarness, type CrocoTestingApp } from "@croco/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGoldenPathRuntime, type GoldenPathRuntime } from "../app/bootstrap";

describe("SaaS billing golden path", () => {
  let runtime!: GoldenPathRuntime;
  let testing!: CrocoTestingApp;

  beforeEach(async () => {
    runtime = await createGoldenPathRuntime();
    testing = createTestingHarness(runtime.app);
  });

  afterEach(async () => {
    await runtime.dispose();
  });

  it("isolates simultaneously active application providers and event projections", async () => {
    const other = await createGoldenPathRuntime();
    try {
      const otherTesting = createTestingHarness(other.app);
      const [first, second] = await Promise.all([
        testing.post("/api/checkouts", {
          json: { customerId: "first", paymentToken: "tok_live", planId: "starter", seats: 1 },
        }),
        otherTesting.post("/api/checkouts", {
          json: { customerId: "second", paymentToken: "tok_live", planId: "growth", seats: 2 },
        }),
      ]);
      expect([first.status, second.status]).toEqual([200, 200]);
      expect(runtime.repository.list()).toMatchObject([{ id: "ord_0001", customerId: "first" }]);
      expect(other.repository.list()).toMatchObject([{ id: "ord_0001", customerId: "second" }]);
      expect(runtime.auditLog.list()).toMatchObject([
        { message: "Order ord_0001 was paid by first." },
      ]);
      expect(other.auditLog.list()).toMatchObject([
        { message: "Order ord_0001 was paid by second." },
      ]);
    } finally {
      await other.dispose();
    }
    expect((await testing.get("/api/orders/ord_0001")).status).toBe(200);
  });

  it("retains its application scope when the local Node server receives a request", async () => {
    const server = await runtime.applicationRuntime.run(() => runtime.app.listen(0));
    try {
      const address = server.address();
      expect(address).not.toBeNull();
      if (address === null || typeof address === "string")
        throw new TypeError("Expected TCP address");
      const response = await fetch(`http://127.0.0.1:${address.port}/api/orders/missing`);
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: "golden-path/order-not-found" });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
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
