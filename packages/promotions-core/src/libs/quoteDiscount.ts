import { InvalidOfferPolicyProblem, OfferCurrencyMismatchProblem } from "./problems";
import type { DiscountQuote, QuoteDiscountInput } from "./types";

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

function normalizeCurrency(value: string, field: string): string {
  const normalized = value.trim().toUpperCase();
  if (!CURRENCY_PATTERN.test(normalized)) {
    throw new InvalidOfferPolicyProblem(`${field} must be an ISO 4217 currency code`);
  }
  return normalized;
}

function assertMinorUnits(value: number, field: string): number {
  if (!Number.isInteger(value) || !Number.isSafeInteger(value)) {
    throw new InvalidOfferPolicyProblem(`${field} must be a safe integer minor unit value`);
  }
  return value === 0 ? 0 : value;
}

/**
 * Pure discount quote over whole minor units. Mixed currencies fail instead
 * of guessing a conversion, and an unsupported provider is reported as
 * `supported: false` rather than a fabricated grant.
 */
export function quoteDiscount(input: QuoteDiscountInput): DiscountQuote {
  const benefit = input.benefit;
  if (
    !Number.isInteger(benefit.percentBps) ||
    benefit.percentBps < 1 ||
    benefit.percentBps > 10000
  ) {
    throw new InvalidOfferPolicyProblem(
      "benefit.percentBps must be an integer between 1 and 10000",
    );
  }
  const faceAmount = assertMinorUnits(benefit.maxDiscount.amount, "benefit.maxDiscount.amount");
  const faceCurrency = normalizeCurrency(
    benefit.maxDiscount.currency,
    "benefit.maxDiscount.currency",
  );
  const currency = normalizeCurrency(benefit.currency, "benefit.currency");
  if (faceCurrency !== currency) {
    throw new InvalidOfferPolicyProblem("benefit.maxDiscount currency must equal benefit.currency");
  }
  const chargeAmount = assertMinorUnits(input.charge.amount, "charge.amount");
  const chargeCurrency = normalizeCurrency(input.charge.currency, "charge.currency");
  if (chargeCurrency !== currency) {
    throw new OfferCurrencyMismatchProblem(currency, chargeCurrency);
  }
  const computed = (BigInt(chargeAmount) * BigInt(benefit.percentBps)) / BigInt(10000);
  const capped = computed > BigInt(faceAmount) ? BigInt(faceAmount) : computed;
  const discount = Number(capped);
  const supported = benefit.supportedProviders.includes(input.provider);
  return {
    supported,
    discount: { amount: discount, currency },
    face: { amount: faceAmount, currency },
    provider: input.provider,
    currency,
  };
}
