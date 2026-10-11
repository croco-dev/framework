/**
 * Canonical decimal arithmetic for referral budgets and face values.
 *
 * Browser-safe local copy of the credit ledger's canonical base-10 math
 * (at most 18 fraction digits): referral-core must stay free of the
 * credits-core barrel, which transitively pulls node-only modules into
 * browser bundles through events-core and framework-context.
 */

import { InvalidReferralProgramProblem } from "./problems";

type Decimal = {
  readonly coefficient: bigint;
  readonly scale: number;
};

const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,18}))?$/;

function normalizeDecimal(decimal: Decimal): string {
  if (decimal.coefficient === BigInt(0)) {
    return "0";
  }
  const digits = decimal.coefficient.toString();
  if (decimal.scale === 0) {
    return digits;
  }
  const padded = digits.padStart(decimal.scale + 1, "0");
  const integer = padded.slice(0, -decimal.scale);
  const fraction = padded.slice(-decimal.scale).replace(/0+$/, "");
  return `${integer}${fraction.length > 0 ? `.${fraction}` : ""}`;
}

function parseCanonical(value: string): Decimal {
  const match = DECIMAL_PATTERN.exec(value);
  if (!match) {
    throw new InvalidReferralProgramProblem(
      "use a canonical base-10 string with at most 18 fractional digits",
    );
  }
  const integer = match[1];
  const fraction = match[2] ?? "";
  return {
    coefficient: BigInt(`${integer}${fraction}`),
    scale: fraction.length,
  };
}

/** Canonicalizes a positive base-10 amount; zero and non-canonical forms fail. */
export function canonicalReferralAmount(value: string): string {
  const normalized = normalizeDecimal(parseCanonical(value));
  if (normalized === "0") {
    throw new InvalidReferralProgramProblem("referral amounts must be greater than zero");
  }
  if (normalized !== value) {
    throw new InvalidReferralProgramProblem("referral amounts must use canonical decimal form");
  }
  return normalized;
}

function align(left: Decimal, right: Decimal): readonly [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  const leftCoefficient = left.coefficient * BigInt(10) ** BigInt(scale - left.scale);
  const rightCoefficient = right.coefficient * BigInt(10) ** BigInt(scale - right.scale);
  return [leftCoefficient, rightCoefficient, scale];
}

export function addReferralAmounts(left: string, right: string): string {
  const [leftCoefficient, rightCoefficient, scale] = align(
    parseCanonical(left),
    parseCanonical(right),
  );
  return normalizeDecimal({
    coefficient: leftCoefficient + rightCoefficient,
    scale,
  });
}

export function subtractReferralAmounts(left: string, right: string): string {
  const [leftCoefficient, rightCoefficient, scale] = align(
    parseCanonical(left),
    parseCanonical(right),
  );
  const result = leftCoefficient - rightCoefficient;
  if (result < BigInt(0)) {
    throw new InvalidReferralProgramProblem(
      "referral decimal subtraction cannot produce a negative amount",
    );
  }
  return normalizeDecimal({ coefficient: result, scale });
}

export function compareReferralAmounts(left: string, right: string): number {
  const [leftCoefficient, rightCoefficient] = align(parseCanonical(left), parseCanonical(right));
  if (leftCoefficient < rightCoefficient) return -1;
  if (leftCoefficient > rightCoefficient) return 1;
  return 0;
}

export const ZERO_REFERRAL_AMOUNT = "0";
