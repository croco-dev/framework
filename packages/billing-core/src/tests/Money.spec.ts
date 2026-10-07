import { describe, expect, it } from "vitest";
import { Money } from "../libs/Money";
import {
  InvalidMoneyAmountProblem,
  InvalidMoneyCurrencyProblem,
  MoneyCurrencyMismatchProblem,
  MoneyDivisionByZeroProblem,
} from "../libs/problems/BillingProblems";
import type { MoneyRoundingMode } from "../libs/Money";

function roundRational(
  numerator: number | bigint,
  denominator: number | bigint,
  roundingMode: MoneyRoundingMode,
): number {
  const n = BigInt(numerator);
  const d = BigInt(denominator);
  const negative = n < 0n !== d < 0n;
  const absoluteNumerator = n < 0n ? -n : n;
  const absoluteDenominator = d < 0n ? -d : d;
  const quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  const increment =
    roundingMode === "up"
      ? remainder > 0n
      : roundingMode === "half_up" && remainder * 2n >= absoluteDenominator;
  const magnitude = quotient + (increment ? 1n : 0n);
  return Number(negative ? -magnitude : magnitude);
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
      expect(new Money(amount, "USD").divide(divisor, "half_up").amount).toBe(expected.half_up);
      expect(new Money(amount, "USD").divide(divisor, "down").amount).toBe(expected.down);
      expect(new Money(amount, "USD").divide(divisor, "up").amount).toBe(expected.up);
    },
  );

  it("should preserve division signs and rounding against an integer-rational oracle", () => {
    const roundingModes: MoneyRoundingMode[] = ["half_up", "down", "up"];
    const decimalDivisors = [
      { value: 1 / 3, numerator: 3333333333333333n, denominator: 10000000000000000n },
      { value: -1 / 3, numerator: -3333333333333333n, denominator: 10000000000000000n },
      { value: 20 / 31, numerator: 6451612903225806n, denominator: 10000000000000000n },
      { value: -20 / 31, numerator: -6451612903225806n, denominator: 10000000000000000n },
      { value: 0.1 + 0.2, numerator: 30000000000000004n, denominator: 100000000000000000n },
      { value: -0.1 - 0.2, numerator: -30000000000000004n, denominator: 100000000000000000n },
      { value: 0.123456789, numerator: 123456789n, denominator: 1000000000n },
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

          expect(actual).toBe(expected);
        }
      }

      for (const divisor of decimalDivisors) {
        for (const roundingMode of roundingModes) {
          const expected = roundRational(
            BigInt(amount) * BigInt(divisor.denominator),
            divisor.numerator,
            roundingMode,
          );
          const actual = new Money(amount, "USD").divide(divisor.value, roundingMode).amount;

          expect(actual).toBe(expected);
        }
      }
    }
  });

  it("should preserve multiplication signs and rounding against an integer-rational oracle", () => {
    const roundingModes: MoneyRoundingMode[] = ["half_up", "down", "up"];
    const multipliers = [
      { value: 1 / 3, numerator: 3333333333333333n, denominator: 10000000000000000n },
      { value: -1 / 3, numerator: -3333333333333333n, denominator: 10000000000000000n },
      { value: 20 / 31, numerator: 6451612903225806n, denominator: 10000000000000000n },
      { value: -20 / 31, numerator: -6451612903225806n, denominator: 10000000000000000n },
      { value: 0.1 + 0.2, numerator: 30000000000000004n, denominator: 100000000000000000n },
      { value: -0.1 - 0.2, numerator: -30000000000000004n, denominator: 100000000000000000n },
      { value: 0.123456789, numerator: 123456789n, denominator: 1000000000n },
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
            BigInt(amount) * BigInt(multiplier.numerator),
            multiplier.denominator,
            roundingMode,
          );
          const actual = new Money(amount, "USD").multiply(multiplier.value, roundingMode).amount;

          expect(actual).toBe(expected);
        }
      }
    }
  });

  it.each([
    { amount: 2900, rate: 20 / 31, multiplied: 1871, divided: 4495 },
    { amount: 2900, rate: 1 / 3, multiplied: 967, divided: 8700 },
    { amount: 2900, rate: 0.1 + 0.2, multiplied: 870, divided: 9667 },
    { amount: 123_456_789, rate: 0.123456789, multiplied: 15_241_579, divided: 1_000_000_000 },
  ])(
    "should round long decimal ratios without rejecting intermediates: $rate",
    ({ amount, rate, multiplied, divided }) => {
      expect(new Money(amount, "USD").multiply(rate).amount).toBe(multiplied);
      expect(new Money(amount, "USD").divide(rate).amount).toBe(divided);
    },
  );

  it.each(["half_up", "down", "up"] as const)(
    "should validate only the final amount with %s rounding",
    (mode) => {
      const maximum = new Money(Number.MAX_SAFE_INTEGER, "USD");
      expect(maximum.multiply(1, mode).amount).toBe(Number.MAX_SAFE_INTEGER);
      expect(maximum.divide(1, mode).amount).toBe(Number.MAX_SAFE_INTEGER);
      expect(() => maximum.multiply(2, mode)).toThrow(InvalidMoneyAmountProblem);
      expect(() => maximum.divide(0.5, mode)).toThrow(InvalidMoneyAmountProblem);
      expect(new Money(1, "USD").divide(Number.MAX_VALUE, mode).amount).toBe(mode === "up" ? 1 : 0);
      expect(new Money(1, "USD").multiply(Number.MIN_VALUE, mode).amount).toBe(
        mode === "up" ? 1 : 0,
      );
      expect(new Money(0, "USD").multiply(Number.MAX_VALUE, mode).amount).toBe(0);
      expect(new Money(0, "USD").divide(Number.MIN_VALUE, mode).amount).toBe(0);
    },
  );

  it.each([Number.NaN, Infinity, -Infinity])("should reject non-finite rates: %s", (rate) => {
    expect(() => new Money(1, "USD").multiply(rate)).toThrow(InvalidMoneyAmountProblem);
    expect(() => new Money(1, "USD").divide(rate)).toThrow(InvalidMoneyAmountProblem);
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
    expect(Money.fromDecimal(0.3, "USD").amount).toBe(30);
    expect(Money.zero("eur").toJSON()).toEqual({ amount: 0, currency: "EUR" });
  });

  it("should round exact decimal values to minor units", () => {
    expect(Money.fromDecimal(1.005, "USD").amount).toBe(101);
    expect(Money.fromDecimal(2.675, "USD").amount).toBe(268);
    expect(Money.fromDecimal(-1.005, "USD").amount).toBe(-101);
  });

  it("should preserve valid amounts whose decimal ratios exceed safe integer intermediates", () => {
    expect(Money.fromDecimal(0.1 + 0.2, "USD").amount).toBe(30);
    expect(Money.fromDecimal(1 / 3, "USD").amount).toBe(33);
    expect(Money.fromDecimal(1e-16, "USD").amount).toBe(0);
    expect(Money.fromDecimal(1000000000000.01, "USD").amount).toBe(100000000000001);
    expect(Money.fromDecimal(-0.1 - 0.2, "USD").amount).toBe(-30);
    expect(Money.fromDecimal(-1 / 3, "USD").amount).toBe(-33);
  });

  it("should apply decimal rounding modes symmetrically", () => {
    expect(Money.fromDecimal(1.005, "USD", "down").amount).toBe(100);
    expect(Money.fromDecimal(1.005, "USD", "up").amount).toBe(101);
    expect(Money.fromDecimal(-1.005, "USD", "down").amount).toBe(-100);
    expect(Money.fromDecimal(-1.005, "USD", "up").amount).toBe(-101);
  });

  it("should reject non-finite or unrepresentable decimal amounts", () => {
    expect(() => Money.fromDecimal(Number.NaN, "USD")).toThrow(InvalidMoneyAmountProblem);
    expect(() => Money.fromDecimal(Number.POSITIVE_INFINITY, "USD")).toThrow(
      InvalidMoneyAmountProblem,
    );
    expect(() => Money.fromDecimal(Number.MAX_SAFE_INTEGER, "USD")).toThrow(
      InvalidMoneyAmountProblem,
    );
  });

  it("should reject currency mismatch and invalid operations", () => {
    const usd = new Money(1000, "USD");
    const eur = new Money(1000, "EUR");

    expect(() => usd.add(eur)).toThrow(MoneyCurrencyMismatchProblem);
    expect(() => usd.divide(0)).toThrow(MoneyDivisionByZeroProblem);
    expect(() => new Money(1000, "US")).toThrow(InvalidMoneyCurrencyProblem);
  });
});
