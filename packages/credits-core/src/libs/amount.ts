import { InvalidCreditAmountProblem } from "./problems";
import type { CreditAmount, CreditSignedAmount } from "./types";

type Decimal = {
  readonly coefficient: bigint;
  readonly scale: number;
};

const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,18}))?$/;
const SIGNED_DECIMAL_PATTERN = /^(-?)(0|[1-9]\d*)(?:\.(\d{1,18}))?$/;

function normalizeDecimal(decimal: Decimal): string {
  if (decimal.coefficient === BigInt(0)) {
    return "0";
  }

  const negative = decimal.coefficient < BigInt(0);
  const digits = (negative ? -decimal.coefficient : decimal.coefficient).toString();
  if (decimal.scale === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }

  const padded = digits.padStart(decimal.scale + 1, "0");
  const integer = padded.slice(0, -decimal.scale);
  const fraction = padded.slice(-decimal.scale).replace(/0+$/, "");
  return `${negative ? "-" : ""}${integer}${fraction.length > 0 ? `.${fraction}` : ""}`;
}

function parse(value: string, signed: boolean): Decimal {
  const match = (signed ? SIGNED_DECIMAL_PATTERN : DECIMAL_PATTERN).exec(value);
  if (!match) {
    throw new InvalidCreditAmountProblem(
      "use a canonical base-10 string with at most 18 fractional digits",
    );
  }

  const sign = signed && match[1] === "-" ? BigInt(-1) : BigInt(1);
  const integerIndex = signed ? 2 : 1;
  const fractionIndex = signed ? 3 : 2;
  const integer = match[integerIndex];
  const fraction = match[fractionIndex] ?? "";
  return {
    coefficient: sign * BigInt(`${integer}${fraction}`),
    scale: fraction.length,
  };
}

function align(left: Decimal, right: Decimal): readonly [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  const leftCoefficient = left.coefficient * BigInt(10) ** BigInt(scale - left.scale);
  const rightCoefficient = right.coefficient * BigInt(10) ** BigInt(scale - right.scale);
  return [leftCoefficient, rightCoefficient, scale];
}

export const ZERO_CREDIT_AMOUNT = "0" as CreditAmount;
export const ZERO_CREDIT_SIGNED_AMOUNT = "0" as CreditSignedAmount;

export function creditAmount(value: string | bigint): CreditAmount {
  if (typeof value !== "string" && typeof value !== "bigint") {
    throw new InvalidCreditAmountProblem(
      "use a string or bigint so binary floating-point values cannot enter the ledger",
    );
  }
  const normalized = normalizeDecimal(parse(value.toString(), false));
  if (normalized === "0") {
    throw new InvalidCreditAmountProblem("command amounts must be greater than zero");
  }
  return normalized as CreditAmount;
}

export function assertPositiveCreditAmount(value: CreditAmount): void {
  if (typeof value !== "string") {
    throw new InvalidCreditAmountProblem("stored command amounts must be canonical strings");
  }
  const normalized = normalizeDecimal(parse(value, false));
  if (normalized !== value) {
    throw new InvalidCreditAmountProblem("stored command amounts must use canonical decimal form");
  }
  if (normalized === "0") {
    throw new InvalidCreditAmountProblem("command amounts must be greater than zero");
  }
}

export function addCreditAmounts(left: CreditAmount, right: CreditAmount): CreditAmount {
  const [leftCoefficient, rightCoefficient, scale] = align(parse(left, false), parse(right, false));
  return normalizeDecimal({
    coefficient: leftCoefficient + rightCoefficient,
    scale,
  }) as CreditAmount;
}

export function subtractCreditAmounts(left: CreditAmount, right: CreditAmount): CreditAmount {
  const [leftCoefficient, rightCoefficient, scale] = align(parse(left, false), parse(right, false));
  const result = leftCoefficient - rightCoefficient;
  if (result < BigInt(0)) {
    throw new InvalidCreditAmountProblem("decimal subtraction cannot produce a negative amount");
  }
  return normalizeDecimal({ coefficient: result, scale }) as CreditAmount;
}

export function compareCreditAmounts(left: CreditAmount, right: CreditAmount): number {
  const [leftCoefficient, rightCoefficient] = align(parse(left, false), parse(right, false));
  if (leftCoefficient < rightCoefficient) return -1;
  if (leftCoefficient > rightCoefficient) return 1;
  return 0;
}

export function addSignedCreditAmounts(
  left: CreditSignedAmount,
  right: CreditSignedAmount,
): CreditSignedAmount {
  const [leftCoefficient, rightCoefficient, scale] = align(parse(left, true), parse(right, true));
  return normalizeDecimal({
    coefficient: leftCoefficient + rightCoefficient,
    scale,
  }) as CreditSignedAmount;
}

export function toSignedCreditAmount(
  amount: CreditAmount,
  direction: "credit" | "debit",
): CreditSignedAmount {
  return `${direction === "debit" ? "-" : ""}${amount}` as CreditSignedAmount;
}
