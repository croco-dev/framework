import { describe, expect, it } from "vitest";
import { z } from "zod";
import { RequestValidationProblem, validateRequest } from "../index";

const createOrderBody = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
});

describe("protocols-rest behavioral evidence", () => {
  it("validates and returns a public REST request payload", () => {
    expect(validateRequest(createOrderBody, { sku: "sku-1", quantity: 2 }, "body")).toEqual({
      sku: "sku-1",
      quantity: 2,
    });
  });

  it("rejects an invalid public REST request payload with a typed Problem", () => {
    expect(() => validateRequest(createOrderBody, { sku: "", quantity: 0 }, "body")).toThrow(
      RequestValidationProblem,
    );
  });
});
