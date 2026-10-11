import type { CreditAccountId, CreditLedgerService } from "@croco/credits-core";
import { creditAmount } from "@croco/credits-core";
import { canonicalOfferAmount } from "./amounts";
import type {
  OfferClaim,
  OfferFulfillmentPort,
  OfferQuote,
  OfferSubject,
  RegisteredOfferPolicy,
} from "./types";

const HISTORY_CHECK_LIMIT = 100;

export type CreditGrantAccountResolver = (input: {
  readonly subject: OfferSubject;
  readonly benefit: Extract<OfferClaim["benefit"], { readonly kind: "trial-credits" }>;
}) => Promise<CreditAccountId> | CreditAccountId;

/**
 * First-party fulfillment adapter that grants trial credits through the
 * existing credit ledger. The mapped account is validated on every grant: it
 * must exist and belong to the claim tenant, so one tenant can never fund
 * another. Ledger validation failures reject the claim; anything thrown by
 * the ledger call itself is reported as `unknown` because the grant may have
 * committed (for example, event publication can fail after commit).
 *
 * Node-side entry point: imports credits-core (which pulls node:crypto and
 * events-core), so browser bundles must not import this module. Import from
 * `@croco/promotions-core/credit-grant` on the server only.
 */
export class FirstPartyCreditGrantAdapter implements OfferFulfillmentPort {
  private readonly ledger: CreditLedgerService;
  private readonly resolveAccount: CreditGrantAccountResolver;
  private readonly sourcePrefix: string;

  constructor(options: {
    readonly ledger: CreditLedgerService;
    readonly resolveAccount: CreditGrantAccountResolver;
    readonly sourcePrefix?: string;
  }) {
    this.ledger = options.ledger;
    this.resolveAccount = options.resolveAccount;
    this.sourcePrefix = options.sourcePrefix ?? "promotion:";
  }

  async fulfill(input: {
    readonly idempotencyKey: string;
    readonly claim: OfferClaim;
    readonly quote: OfferQuote;
    readonly policy: RegisteredOfferPolicy;
    readonly subject: OfferSubject;
  }): Promise<
    | { readonly outcome: "granted"; readonly grantRef: string }
    | { readonly outcome: "unknown"; readonly reason: string }
    | { readonly outcome: "failed"; readonly reason: string }
  > {
    const benefit = input.claim.benefit;
    if (benefit.kind !== "trial-credits") {
      return { outcome: "failed", reason: "discount benefits complete without ledger movement" };
    }
    let amount: string;
    try {
      amount = canonicalOfferAmount(benefit.creditAmount);
    } catch (error) {
      return {
        outcome: "failed",
        reason: error instanceof Error ? error.message : "invalid benefit amount",
      };
    }
    const accountId = await this.resolveAccount({ subject: input.subject, benefit });
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
        reference: { type: "promotion-claim", id: input.claim.id },
        source: `${this.sourcePrefix}${input.policy.id}/v${input.policy.version}`,
        expiresAt: benefit.expiresAt ? new Date(benefit.expiresAt.getTime()) : undefined,
      });
      const grantRef = result.transactions[0]?.id ?? input.claim.id;
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
    readonly claim: OfferClaim;
    readonly subject: OfferSubject;
  }): Promise<{ readonly grantRef: string } | null> {
    const benefit = input.claim.benefit;
    if (benefit.kind !== "trial-credits") return null;
    const accountId = await Promise.resolve(
      this.resolveAccount({ subject: input.subject, benefit }),
    ).catch(() => null);
    if (!accountId) return null;
    const page = await this.ledger.getHistory(accountId, { limit: HISTORY_CHECK_LIMIT });
    const grant = page.transactions.find(
      (transaction) =>
        transaction.idempotencyKey === input.idempotencyKey && transaction.kind === "grant",
    );
    return grant ? { grantRef: grant.id } : null;
  }
}
