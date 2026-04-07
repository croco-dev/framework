import {
  InvalidMoneyAmountProblem,
  InvalidMoneyCurrencyProblem,
  MoneyCurrencyMismatchProblem,
  MoneyDivisionByZeroProblem,
} from './problems/BillingProblems';

export type MoneyRoundingMode = 'half_up' | 'down' | 'up';

type DecimalRatio = {
  numerator: number;
  denominator: number;
};

export class Money {
  readonly amount: number;
  readonly currency: string;

  constructor(amount: number, currency: string) {
    this.amount = Money.validateAmount(amount);
    this.currency = Money.normalizeCurrency(currency);
  }

  static zero(currency: string): Money {
    return new Money(0, currency);
  }

  static fromDecimal(amount: number, currency: string, roundingMode: MoneyRoundingMode = 'half_up'): Money {
    const normalizedCurrency = Money.normalizeCurrency(currency);
    const fractionDigits = Money.getFractionDigits(normalizedCurrency);
    const scale = 10 ** fractionDigits;
    const scaledAmount = Money.applyRounding(amount * scale, roundingMode);
    return new Money(scaledAmount, normalizedCurrency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(multiplier: number, roundingMode: MoneyRoundingMode = 'half_up'): Money {
    const ratio = Money.toDecimalRatio(multiplier);
    const result = Money.applyRatio(this.amount, ratio, roundingMode);
    return new Money(result, this.currency);
  }

  divide(divisor: number, roundingMode: MoneyRoundingMode = 'half_up'): Money {
    const ratio = Money.toDecimalRatio(divisor);

    if (ratio.numerator === 0) {
      throw new MoneyDivisionByZeroProblem();
    }

    const result = Money.applyRatio(
      this.amount,
      {
        numerator: ratio.denominator,
        denominator: ratio.numerator,
      },
      roundingMode
    );

    return new Money(result, this.currency);
  }

  eq(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount === other.amount;
  }

  gt(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount > other.amount;
  }

  lt(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount < other.amount;
  }

  gte(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount >= other.amount;
  }

  lte(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount <= other.amount;
  }

  toDecimal(): number {
    const scale = 10 ** Money.getFractionDigits(this.currency);
    return this.amount / scale;
  }

  toString(): string {
    const fractionDigits = Money.getFractionDigits(this.currency);
    return `${this.currency} ${this.toDecimal().toFixed(fractionDigits)}`;
  }

  toFormattedString(locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
    }).format(this.toDecimal());
  }

  toJSON(): { amount: number; currency: string } {
    return {
      amount: this.amount,
      currency: this.currency,
    };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new MoneyCurrencyMismatchProblem(this.currency, other.currency);
    }
  }

  private static validateAmount(amount: number): number {
    if (!Number.isInteger(amount) || !Number.isSafeInteger(amount)) {
      throw new InvalidMoneyAmountProblem(amount);
    }

    return amount;
  }

  private static normalizeCurrency(currency: string): string {
    const normalizedCurrency = currency.trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      throw new InvalidMoneyCurrencyProblem(currency);
    }

    return normalizedCurrency;
  }

  private static getFractionDigits(currency: string): number {
    return (
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  }

  private static toDecimalRatio(value: number): DecimalRatio {
    if (!Number.isFinite(value)) {
      throw new InvalidMoneyAmountProblem(value);
    }

    const valueText = Money.normalizeDecimalText(value);
    const sign = valueText.startsWith('-') ? -1 : 1;
    const unsignedText = valueText.replace(/^[+-]/, '');
    const [integerPart, fractionalPart = ''] = unsignedText.split('.');
    const digits = `${integerPart}${fractionalPart}`.replace(/^0+(?=\d)/, '') || '0';
    const numerator = Money.toSafeInteger(Number(digits) * sign);
    const denominator = Money.toSafeInteger(10 ** fractionalPart.length);

    return Money.simplifyRatio({ numerator, denominator });
  }

  private static normalizeDecimalText(value: number): string {
    const text = value.toString();

    if (!/[eE]/.test(text)) {
      return text;
    }

    const [mantissaText, exponentText] = text.split(/[eE]/);
    const exponent = Number.parseInt(exponentText, 10);
    const sign = mantissaText.startsWith('-') ? '-' : '';
    const unsignedMantissa = mantissaText.replace(/^[+-]/, '');
    const [integerPart, fractionalPart = ''] = unsignedMantissa.split('.');
    const digits = `${integerPart}${fractionalPart}`.replace(/^0+(?=\d)/, '') || '0';
    const decimalIndex = integerPart.length + exponent;

    if (decimalIndex <= 0) {
      return `${sign}0.${'0'.repeat(Math.abs(decimalIndex))}${digits}`;
    }

    if (decimalIndex >= digits.length) {
      return `${sign}${digits}${'0'.repeat(decimalIndex - digits.length)}`;
    }

    return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  }

  private static simplifyRatio(ratio: DecimalRatio): DecimalRatio {
    const divisor = Money.gcd(Money.absInteger(ratio.numerator), ratio.denominator);

    return {
      numerator: ratio.numerator / divisor,
      denominator: ratio.denominator / divisor,
    };
  }

  private static applyRatio(amount: number, ratio: DecimalRatio, roundingMode: MoneyRoundingMode): number {
    const numerator = Money.toSafeInteger(amount * ratio.numerator);
    const denominator = ratio.denominator;
    const quotient = Math.trunc(numerator / denominator);
    const remainder = numerator % denominator;
    const rounded = Money.roundQuotient(quotient, remainder, denominator, roundingMode);

    return Money.toSafeInteger(rounded);
  }

  private static roundQuotient(
    quotient: number,
    remainder: number,
    denominator: number,
    roundingMode: MoneyRoundingMode
  ): number {
    if (remainder === 0) {
      return quotient;
    }

    const remainderSign = remainder > 0 ? 1 : -1;
    const absoluteRemainder = Money.absInteger(remainder);

    if (roundingMode === 'down') {
      return quotient;
    }

    if (roundingMode === 'up') {
      return quotient + remainderSign;
    }

    return absoluteRemainder * 2 >= denominator ? quotient + remainderSign : quotient;
  }

  private static applyRounding(value: number, roundingMode: MoneyRoundingMode): number {
    if (roundingMode === 'down') {
      return Math.trunc(value);
    }

    if (roundingMode === 'up') {
      return value >= 0 ? Math.ceil(value) : Math.floor(value);
    }

    return value >= 0 ? Math.round(value) : -Math.round(Math.abs(value));
  }

  private static toSafeInteger(value: number): number {
    if (!Number.isSafeInteger(value)) {
      throw new InvalidMoneyAmountProblem(value);
    }

    return value;
  }

  private static gcd(a: number, b: number): number {
    if (b === 0) {
      return a;
    }

    return Money.gcd(b, a % b);
  }

  private static absInteger(value: number): number {
    return value < 0 ? -value : value;
  }
}
