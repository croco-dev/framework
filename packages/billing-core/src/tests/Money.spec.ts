import { describe, expect, it } from "vitest";
import { Money } from "../libs/Money";
import {
  InvalidMoneyCurrencyProblem,
  MoneyCurrencyMismatchProblem,
  MoneyDivisionByZeroProblem,
} from "../libs/problems/BillingProblems";
import type { MoneyRoundingMode } from "../libs/Money";

function roundRational(
  numerator: number,
  denominator: number,
  roundingMode: MoneyRoundingMode,
): number {
  const denominatorSign = denominator < 0 ? -1 : 1;
  const normalizedNumerator = numerator * denominatorSign;
  const normalizedDenominator = denominator * denominatorSign;
  const quotient = Math.trunc(normalizedNumerator / normalizedDenominator);
  const remainder = normalizedNumerator % normalizedDenominator;

  if (remainder === 0 || roundingMode === "down") {
    return quotient;
  }

  const direction = remainder > 0 ? 1 : -1;

  if (roundingMode === "up") {
    return quotient + direction;
  }

  const absoluteRemainder = remainder < 0 ? -remainder : remainder;
  return absoluteRemainder * 2 >= normalizedDenominator ? quotient + direction : quotient;
}

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

  it.each([
    { amount: 4, divisor: -2, expected: { half_up: -2, down: -2, up: -2 } },
    { amount: 1, divisor: -3, expected: { half_up: 0, down: 0, up: -1 } },
    { amount: 1, divisor: -2, expected: { half_up: -1, down: 0, up: -1 } },
    { amount: 2, divisor: -3, expected: { half_up: -1, down: 0, up: -1 } },
  ])(
    "should round exact, below-half, half, and above-half negative quotients",
    ({ amount, divisor, expected }) => {
      expect(new Money(amount, "USD").divide(divisor, "half_up").amount === expected.half_up).toBe(
        true,
      );
      expect(new Money(amount, "USD").divide(divisor, "down").amount === expected.down).toBe(true);
      expect(new Money(amount, "USD").divide(divisor, "up").amount === expected.up).toBe(true);
    },
  );

  it("should preserve division signs and rounding against an integer-rational oracle", () => {
    const roundingModes: MoneyRoundingMode[] = ["half_up", "down", "up"];
    const decimalDivisors = [
      { value: -2.5, numerator: -5, denominator: 2 },
      { value: -1.5, numerator: -3, denominator: 2 },
      { value: -0.5, numerator: -1, denominator: 2 },
      { value: 0.5, numerator: 1, denominator: 2 },
      { value: 1.5, numerator: 3, denominator: 2 },
      { value: 2.5, numerator: 5, denominator: 2 },
    ];

    for (let amount = -13; amount <= 13; amount += 1) {
      for (let divisor = -7; divisor <= 7; divisor += 1) {
        if (divisor === 0) {
          continue;
        }

        for (const roundingMode of roundingModes) {
          const expected = roundRational(amount, divisor, roundingMode);
          const actual = new Money(amount, "USD").divide(divisor, roundingMode).amount;

          expect(actual === expected).toBe(true);
        }
      }

      for (const divisor of decimalDivisors) {
        for (const roundingMode of roundingModes) {
          const expected = roundRational(
            amount * divisor.denominator,
            divisor.numerator,
            roundingMode,
          );
          const actual = new Money(amount, "USD").divide(divisor.value, roundingMode).amount;

          expect(actual === expected).toBe(true);
        }
      }
    }
  });

  it("should preserve multiplication signs and rounding against an integer-rational oracle", () => {
    const roundingModes: MoneyRoundingMode[] = ["half_up", "down", "up"];
    const multipliers = [
      { value: -2.5, numerator: -5, denominator: 2 },
      { value: -0.5, numerator: -1, denominator: 2 },
      { value: 0.5, numerator: 1, denominator: 2 },
      { value: 1.5, numerator: 3, denominator: 2 },
      { value: 2.5, numerator: 5, denominator: 2 },
    ];

    for (let amount = -13; amount <= 13; amount += 1) {
      for (const multiplier of multipliers) {
        for (const roundingMode of roundingModes) {
          const expected = roundRational(
            amount * multiplier.numerator,
            multiplier.denominator,
            roundingMode,
          );
          const actual = new Money(amount, "USD").multiply(multiplier.value, roundingMode).amount;

          expect(actual === expected).toBe(true);
        }
      }
    }
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
