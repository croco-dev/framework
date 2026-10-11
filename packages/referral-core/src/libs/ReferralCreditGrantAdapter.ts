import type { CreditAccountId, CreditLedgerService, CreditTransaction } from "@croco/credits-core";
import { creditAmount } from "@croco/credits-core";
import { canonicalReferralAmount } from "./amounts";
import { ReferralBenefitFailedProblem } from "./problems";
import type {
  ReferralAttribution,
  ReferralBenefit,
  ReferralBenefitIntent,
  ReferralFulfillmentPort,
  ReferralProgramDefinition,
  ReferralSubject,
} from "./types";

const HISTORY_CHECK_LIMIT = 100;

export type ReferralCreditAccountResolver = (input: {
  readonly side: "referrer" | "recipient";
  readonly subject: ReferralSubject;
  readonly benefit: Extract<ReferralBenefit, { readonly kind: "trial-credits" }>;
}) => Promise<CreditAccountId> | CreditAccountId;

/**
 * First-party fulfillment adapter that grants referral credits through the
 * existing credit ledger. The mapped account is validated on every grant: it
 * must exist and belong to the benefit subject tenant, so one tenant can
 * never fund another. Ledger validation failures reject the side; anything
 * thrown by the ledger call itself is reported as `unknown` because the grant
 * may have committed (for example, event publication can fail after commit).
 *
 * Node-side entry point: imports credits-core (which pulls node:crypto and
 * events-core), so browser bundles must not import this module. Import from
 * `@croco/referral-core/credit-grant` on the server only.
 */
export class FirstPartyReferralCreditGrantAdapter implements ReferralFulfillmentPort {
  private readonly ledger: CreditLedgerService;
  private readonly resolveAccount: ReferralCreditAccountResolver;
  private readonly sourcePrefix: string;

  constructor(options: {
    readonly ledger: CreditLedgerService;
    readonly resolveAccount: ReferralCreditAccountResolver;
    readonly sourcePrefix?: string;
  }) {
    this.ledger = options.ledger;
    this.resolveAccount = options.resolveAccount;
    this.sourcePrefix = options.sourcePrefix ?? "referral:";
  }

  async fulfill(input: {
    readonly idempotencyKey: string;
    readonly intent: {
      readonly side: "referrer" | "recipient";
      readonly subject: ReferralSubject;
      readonly benefit: ReferralBenefit;
    };
    readonly attribution: ReferralAttribution;
    readonly program: ReferralProgramDefinition;
    readonly subject: ReferralSubject;
  }): Promise<
    | { readonly outcome: "granted"; readonly grantRef: string }
    | { readonly outcome: "unknown"; readonly reason: string }
    | { readonly outcome: "failed"; readonly reason: string }
    | { readonly outcome: "skipped"; readonly reason: string }
  > {
    const benefit = input.intent.benefit;
    if (benefit.kind !== "trial-credits") {
      return { outcome: "skipped", reason: "program tracks progress without a benefit" };
    }
    let amount: string;
    try {
      amount = canonicalReferralAmount(benefit.creditAmount);
    } catch (error) {
      return {
        outcome: "failed",
        reason: error instanceof Error ? error.message : "invalid benefit amount",
      };
    }
    const accountId = await this.resolveAccount({
      side: input.intent.side,
      subject: input.subject,
      benefit,
    });
    const account = await this.ledger.getAccount(accountId);
    if (!account) {
      return { outcome: "failed", reason: `mapped credit account '${accountId}' was not found` };
    }
    if (account.tenantId !== input.subject.tenantId) {
      return {
        outcome: "failed",
        reason: `mapped credit account '${accountId}' belongs to another tenant`,
      };
    }
    try {
      const result = await this.ledger.grantCredits({
        idempotencyKey: input.idempotencyKey,
        accountId,
        amount: creditAmount(amount),
        reference: { type: "referral-benefit", id: input.attribution.id },
        source: `${this.sourcePrefix}${input.program.id}/v${input.program.version}:${input.intent.side}`,
        expiresAt: benefit.expiresAt ? new Date(benefit.expiresAt.getTime()) : undefined,
      });
      const grantRef = result.transactions[0]?.id ?? input.attribution.id;
      return { outcome: "granted", grantRef };
    } catch (error) {
      return {
        outcome: "unknown",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async check(input: {
    readonly idempotencyKey: string;
    readonly intent: ReferralBenefitIntent;
    readonly subject: ReferralSubject;
  }): Promise<{ readonly grantRef: string } | null> {
    const benefit = input.intent.benefit;
    if (benefit.kind !== "trial-credits") return null;
    const accountId = await Promise.resolve(
      this.resolveAccount({ side: input.intent.side, subject: input.subject, benefit }),
    ).catch(() => null);
    if (!accountId) return null;
    const page = await this.ledger.getHistory(accountId, { limit: HISTORY_CHECK_LIMIT });
    const grant = page.transactions.find(
      (transaction: CreditTransaction) =>
        transaction.idempotencyKey === input.idempotencyKey && transaction.kind === "grant",
    );
    return grant ? { grantRef: grant.id } : null;
  }

  /**
   * Compensating fulfillment reversal exposed on the fulfillment port. The
   * original grant stays on the ledger for audit; this posts a separate debit
   * entry keyed by the return idempotency key. Ledger rejections surface as
   * `{ error }` so the service can fail the return without moving value.
   */
  async reverse(input: {
    readonly returnIdempotencyKey: string;
    readonly intent: ReferralBenefitIntent;
    readonly subject: ReferralSubject;
    readonly attributionId: string;
    readonly policy: string;
    readonly reason: string;
  }): Promise<{ readonly returnRef: string } | { readonly error: string }> {
    try {
      return await this.reverseGrant(input);
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Explicit benefit return through a new compensating ledger adjustment. The
   * original grant stays on the ledger for audit; this posts a separate debit
   * entry keyed by the return idempotency key, so the receipt is explicit and
   * no other subject's confirmed benefit is touched implicitly.
   */
  async reverseGrant(input: {
    readonly returnIdempotencyKey: string;
    readonly intent: ReferralBenefitIntent;
    readonly subject: ReferralSubject;
    readonly attributionId: string;
    readonly policy: string;
    readonly reason: string;
  }): Promise<{ readonly returnRef: string }> {
    const benefit = input.intent.benefit;
    if (benefit.kind !== "trial-credits") {
      throw new InvalidReferralBenefitReturnProblem("only trial-credit benefits can be returned");
    }
    let amount: string;
    try {
      amount = canonicalReferralAmount(benefit.creditAmount);
    } catch (error) {
      throw new InvalidReferralBenefitReturnProblem(
        error instanceof Error ? error.message : "invalid benefit amount",
        { cause: error instanceof Error ? error : undefined },
      );
    }
    const accountId = await this.resolveAccount({
      side: input.intent.side,
      subject: input.subject,
      benefit,
    });
    const account = await this.ledger.getAccount(accountId);
    if (!account) {
      throw new InvalidReferralBenefitReturnProblem(
        `mapped credit account '${accountId}' was not found`,
      );
    }
    if (account.tenantId !== input.subject.tenantId) {
      throw new InvalidReferralBenefitReturnProblem(
        `mapped credit account '${accountId}' belongs to another tenant`,
      );
    }
    const page = await this.ledger.getHistory(accountId, { limit: HISTORY_CHECK_LIMIT });
    const grant = page.transactions.find(
      (transaction: CreditTransaction) =>
        transaction.idempotencyKey === input.intent.idempotencyKey && transaction.kind === "grant",
    );
    if (!grant) {
      throw new InvalidReferralBenefitReturnProblem(
        `no confirmed grant found for '${input.intent.idempotencyKey}'`,
      );
    }
    try {
      const result = await this.ledger.adjustCredits({
        idempotencyKey: input.returnIdempotencyKey,
        accountId,
        amount: creditAmount(amount),
        direction: "debit",
        source: `referral-return:${input.policy}:${input.attributionId}:${input.intent.side}`,
        reference: { type: "referral-benefit-return", id: input.attributionId },
      });
      const returnRef = result.transactions[0]?.id ?? input.returnIdempotencyKey;
      return { returnRef };
    } catch (error) {
      throw new InvalidReferralBenefitReturnProblem(
        error instanceof Error ? error.message : String(error),
        { cause: error instanceof Error ? error : undefined },
      );
    }
  }
}

/** Reports a benefit return rejected before any ledger movement. */
export class InvalidReferralBenefitReturnProblem extends ReferralBenefitFailedProblem {
  constructor(reason: string, options?: { readonly cause?: Error }) {
    super("benefit-return", "return", reason, options);
    this.name = "InvalidReferralBenefitReturnProblem";
  }
}
