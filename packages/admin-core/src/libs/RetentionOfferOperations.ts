import type {
  CancellationScope,
  CancellationSession,
  CancellationStore,
  CancellationService,
  ChoicePolicy,
  ChoicePolicyEntry,
  RegisteredCancellationChoice,
} from "@croco/billing-core";

export type RetentionOfferEdit = Readonly<{
  entries: readonly ChoicePolicyEntry[];
  reason: string;
  expectedRevision: number;
  idempotencyKey: string;
}>;
export type RetentionOfferReport = Readonly<{
  policyVersion: number;
  subscriptionAgeDays: number;
  billingPeriod: "initial" | "renewal";
  refund: "none" | "partial" | "full";
  amount: string;
  currency: string;
  sessions: number;
  displayed: number;
  accepted: number;
  kept: number;
  cancelled: number;
  scheduled: number;
  ended: number;
  refundsConfirmed: number;
  pending: number;
  indeterminate: number;
}>;
export type RetentionOfferView = Readonly<{
  policy: ChoicePolicy;
  registration: readonly RegisteredCancellationChoice[];
  reports: readonly RetentionOfferReport[];
}>;
export type RetentionOfferConsoleState =
  | Readonly<{ kind: "loading" | "empty" }>
  | Readonly<{ kind: "denied" | "error"; code: string }>
  | Readonly<{ kind: "ready" | "partial"; view: RetentionOfferView }>;

export function summarizeRetentionOffers(
  sessions: readonly CancellationSession[],
): readonly RetentionOfferReport[] {
  const groups = new Map<string, RetentionOfferReport>();
  for (const session of sessions) {
    const { billingPeriod, quote } = session.snapshot;
    const subscriptionAgeDays = Math.floor(
      (Date.parse(session.createdAt) - Date.parse(session.snapshot.subscriptionStartedAt)) /
        86_400_000,
    );
    const key = JSON.stringify([
      subscriptionAgeDays,
      session.policyVersion,
      billingPeriod,
      quote.refund,
      quote.amount,
      quote.currency,
    ]);
    const prior = groups.get(key);
    const receipt = session.commandReceipt;
    const count = (value: boolean) => (value ? 1 : 0);
    groups.set(key, {
      policyVersion: session.policyVersion,
      subscriptionAgeDays,
      billingPeriod,
      refund: quote.refund,
      amount: quote.amount,
      currency: quote.currency,
      sessions: (prior?.sessions ?? 0) + 1,
      displayed: (prior?.displayed ?? 0) + count(!!session.displayedAt),
      accepted:
        (prior?.accepted ?? 0) + count(session.decision?.kind === "accept_registered_offer"),
      kept: (prior?.kept ?? 0) + count(session.decision?.kind === "keep_subscription"),
      cancelled: (prior?.cancelled ?? 0) + count(session.decision?.kind === "continue_cancel"),
      scheduled:
        (prior?.scheduled ?? 0) +
        count(
          receipt?.providerOutcome === "confirmed" && receipt.effect === "cancellation_scheduled",
        ),
      ended:
        (prior?.ended ?? 0) +
        count(receipt?.providerOutcome === "confirmed" && receipt.effect === "ended"),
      refundsConfirmed:
        (prior?.refundsConfirmed ?? 0) + count(receipt?.refundOutcome === "confirmed"),
      pending: (prior?.pending ?? 0) + count(receipt?.providerOutcome === "pending"),
      indeterminate:
        (prior?.indeterminate ?? 0) + count(receipt?.providerOutcome === "indeterminate"),
    });
  }
  return [...groups.values()];
}

/** The actor is resolved from authenticated server context, never supplied in browser edits. */
export class RetentionOfferOperations {
  constructor(
    private readonly options: Readonly<{
      service: Pick<CancellationService, "listSessions" | "updatePolicy">;
      store: Pick<CancellationStore, "getPolicy">;
      registration: readonly RegisteredCancellationChoice[];
      actor(): Promise<string>;
      now(): Date;
    }>,
  ) {}

  async load(scope: CancellationScope): Promise<RetentionOfferView> {
    const sessions = await this.options.service.listSessions(scope, await this.options.actor());
    const policy = await this.options.store.getPolicy(scope);
    return {
      policy: policy ?? { ...scope, version: 0, entries: [] },
      registration: this.options.registration,
      reports: summarizeRetentionOffers(sessions),
    };
  }

  async save(scope: CancellationScope, edit: RetentionOfferEdit): Promise<ChoicePolicy> {
    return this.options.service.updatePolicy(scope, edit.entries, {
      actor: await this.options.actor(),
      reason: edit.reason,
      expectedRevision: edit.expectedRevision,
      idempotencyKey: edit.idempotencyKey,
      at: this.options.now().toISOString(),
    });
  }
}
