import { describe, expect, it } from "vitest";
import { Money } from "../libs/Money";
import {
  InvalidMoneyCurrencyProblem,
  MoneyCurrencyMismatchProblem,
  MoneyDivisionByZeroProblem,
} from "../libs/problems/BillingProblems";

describe("Money", () => {
  it("should add and subtract money in the same currency", () => {
    const base = new Money(1000, "USD");
    const delta = new Money(250, "USD");

    expect(base.add(delta).toJSON()).toEqual({ amount: 1250, currency: "USD" });
    expect(base.subtract(delta).toJSON()).toEqual({ amount: 750, currency: "USD" });
  });

  it("should multiply and divide with rounded minor units", () => {
    const money = new Money(1099, "USD");

    expect(money.multiply(1.5).toJSON()).toEqual({ amount: 1649, currency: "USD" });
    expect(money.divide(3).toJSON()).toEqual({ amount: 366, currency: "USD" });
  });

  it("should compare amounts in the same currency", () => {
    const lower = new Money(500, "USD");
    const higher = new Money(1000, "USD");

    expect(lower.lt(higher)).toBe(true);
    expect(higher.gt(lower)).toBe(true);
    expect(higher.gte(lower)).toBe(true);
    expect(lower.lte(higher)).toBe(true);
    expect(new Money(1000, "USD").eq(higher)).toBe(true);
  });

  it("should format string output based on currency digits", () => {
    expect(new Money(1099, "USD").toString()).toBe("USD 10.99");
    expect(new Money(1099, "USD").toFormattedString("en-US")).toBe("$10.99");
    expect(new Money(1200, "KRW").toString()).toBe("KRW 1200");
    expect(new Money(1200, "KRW").toFormattedString("ko-KR")).toContain("₩1,200");
  });

  it("should create money from decimal amounts", () => {
    expect(Money.fromDecimal(19.99, "usd").toJSON()).toEqual({ amount: 1999, currency: "USD" });
    expect(Money.zero("eur").toJSON()).toEqual({ amount: 0, currency: "EUR" });
  });

  it("should reject currency mismatch and invalid operations", () => {
    const usd = new Money(1000, "USD");
    const eur = new Money(1000, "EUR");

    expect(() => usd.add(eur)).toThrow(MoneyCurrencyMismatchProblem);
    expect(() => usd.divide(0)).toThrow(MoneyDivisionByZeroProblem);
    expect(() => new Money(1000, "US")).toThrow(InvalidMoneyCurrencyProblem);
  });
});
