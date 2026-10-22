import { ProblemFactory } from "@croco/problems-core";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createOperation, defineOperation } from "../index";

type Authority = { tenantId: string; canPurchase: boolean };
const authority: Authority = { tenantId: "tenant_verified", canPurchase: true };

function contract() {
  return defineOperation({
    id: "checkout.start",
    kind: "command",
    input: z
      .object({
        productId: z.string().min(3),
        quantity: z.string().transform(Number).pipe(z.number().positive()),
      })
      .strict(),
    output: z.object({ tenantId: z.string(), total: z.number() }),
    authorize(context: Authority) {
      if (!context.canPurchase) throw ProblemFactory.forbidden("checkout/denied");
    },
    policy(input, _context) {
      if (input.quantity > 4) throw ProblemFactory.conflict("checkout/quantity-limit");
    },
  });
}

describe("Operation", () => {
  it("passes parsed domain input and separate verified authority, then projects the output", async () => {
    const handler = vi.fn((input: { productId: string; quantity: number }, context: Authority) => ({
      tenantId: context.tenantId,
      total: input.quantity * 17,
      secret: "server-only",
    }));
    const operation = createOperation(contract(), handler);
    await expect(
      operation.invoke({ productId: "product_7", quantity: "3" }, authority),
    ).resolves.toEqual({ tenantId: "tenant_verified", total: 51 });
    expect(handler).toHaveBeenCalledWith({ productId: "product_7", quantity: 3 }, authority);
  });

  it("denies before reading invalid or potentially expensive input", async () => {
    const read = vi.fn(() => ({ quantity: "broken" }));
    const handler = vi.fn();
    const operation = createOperation(contract(), handler);
    await expect(
      operation.dispatch({ ...authority, canPurchase: false }, read),
    ).rejects.toMatchObject({ code: "checkout/denied" });
    expect(read).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects validation and policy failures before the handler", async () => {
    const handler = vi.fn();
    const operation = createOperation(contract(), handler);
    await expect(
      operation.dispatch(authority, () => ({
        productId: "product_7",
        quantity: "2",
        tenantId: "attacker",
      })),
    ).rejects.toMatchObject({ code: "protocols-core/operation-input-invalid" });
    await expect(
      operation.invoke({ productId: "product_7", quantity: "5" }, authority),
    ).rejects.toMatchObject({ code: "checkout/quantity-limit" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects invalid handler output without exposing returned secrets", async () => {
    const operation = createOperation(contract(), () => ({
      tenantId: "secret-token",
      total: Number.NaN,
    }));
    const failure = await operation
      .invoke({ productId: "product_7", quantity: "1" }, authority)
      .catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: "protocols-core/operation-output-invalid", status: 500 });
    expect(JSON.stringify(failure)).not.toContain("secret-token");
  });

  it("rejects boolean authorization and policy results instead of treating false as success", async () => {
    const handler = vi.fn();
    const original = contract();
    // @ts-expect-error Exercise an invalid JavaScript caller as well as the typed boundary.
    const denied = createOperation({ ...original, authorize: () => false }, handler);
    await expect(
      denied.invoke({ productId: "product_7", quantity: "1" }, authority),
    ).rejects.toMatchObject({ code: "protocols-core/invalid-operation-authorization" });
    // @ts-expect-error Exercise an invalid JavaScript caller as well as the typed boundary.
    const policy = createOperation({ ...original, policy: () => false }, handler);
    await expect(
      policy.invoke({ productId: "product_7", quantity: "1" }, authority),
    ).rejects.toMatchObject({ code: "protocols-core/invalid-operation-policy" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("isolates concurrent authority and snapshots the authored definition", async () => {
    const definition = { ...contract() };
    const operation = createOperation(definition, async (_input, context) => {
      await Promise.resolve();
      return { tenantId: context.tenantId, total: 17 };
    });
    definition.authorize = () => {
      throw ProblemFactory.forbidden("changed");
    };
    const input = { productId: "product_7", quantity: "1" };
    await expect(
      Promise.all([
        operation.invoke(input, authority),
        operation.invoke(input, { ...authority, tenantId: "tenant_second" }),
      ]),
    ).resolves.toEqual([
      { tenantId: "tenant_verified", total: 17 },
      { tenantId: "tenant_second", total: 17 },
    ]);
  });
});
