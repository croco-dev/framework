import { describe, expect, it } from "vitest";
import { OfferCurrencyMismatchProblem, quoteDiscount } from "../index";

const benefit = {
  kind: "discount-quote" as const,
  percentBps: 1000,
  maxDiscount: { amount: 500, currency: "USD" },
  currency: "USD",
  supportedProviders: ["polar"] as readonly string[],
};

describe("quoteDiscount", () => {
  it("computes the percentage discount as pure minor-unit math", () => {
    const quote = quoteDiscount({
      benefit,
      charge: { amount: 4000, currency: "USD" },
      provider: "polar",
    });
    expect(quote.supported).toBe(true);
    expect(quote.discount).toEqual({ amount: 400, currency: "USD" });
  });

  it("caps the discount at the registered face value", () => {
    const quote = quoteDiscount({
      benefit,
      charge: { amount: 100000, currency: "USD" },
      provider: "polar",
    });
    expect(quote.discount).toEqual({ amount: 500, currency: "USD" });
    expect(quote.face).toEqual({ amount: 500, currency: "USD" });
  });

  it("reports unsupported providers without fabricating fulfillment", () => {
    const quote = quoteDiscount({
      benefit,
      charge: { amount: 4000, currency: "USD" },
      provider: "stripe",
    });
    expect(quote.supported).toBe(false);
    expect(quote.discount).toEqual({ amount: 400, currency: "USD" });
  });

  it("rejects mixed currencies without guessing a conversion", () => {
    expect(() =>
      quoteDiscount({
        benefit,
        charge: { amount: 10000, currency: "EUR" },
        provider: "polar",
      }),
    ).toThrow(OfferCurrencyMismatchProblem);
  });
});
