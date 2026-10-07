/** Every cancellation resource is isolated by application, environment, and tenant. */
export type CancellationScope = {
  readonly appId: string;
  readonly environment: string;
  readonly tenantId: string;
};
export type CancellationIdentity = CancellationScope & {
  readonly subject: string;
  readonly subscriptionRef: string;
};
/** Values originate in the application/provider quote source; Croco performs no monetary calculation. */
export type CancellationQuote = {
  readonly ref: string;
  readonly expiresAt: string;
  readonly refund: "none" | "partial" | "full";
  /** Non-negative decimal major currency units supplied by the authoritative quote source. */
  readonly amount: string;
  readonly currency: string;
};
export type CancellationSnapshot = CancellationIdentity & {
  readonly revision: string;
  readonly subscriptionStartedAt: string;
  readonly billingPeriod: "initial" | "renewal";
  readonly status: "active" | "cancellation_scheduled" | "ended";
  readonly quote: CancellationQuote;
};
export type CancellationActionKind = "cancel" | "resume" | "change-plan";
export type RegisteredCancellationChoice = {
  readonly id: string;
  readonly action: CancellationActionKind;
  readonly label: string;
  readonly consequence: string;
};
export type ChoicePolicyEntry = {
  readonly choiceId: string;
  readonly label: string;
  readonly order: number;
  readonly enabled: boolean;
  readonly billingPeriods: readonly ("initial" | "renewal")[];
  readonly refundKinds: readonly ("none" | "partial" | "full")[];
};
export type ChoicePolicy = CancellationScope & {
  readonly version: number;
  readonly entries: readonly ChoicePolicyEntry[];
};
export type CancellationChoice = RegisteredCancellationChoice & { readonly available: boolean };
export type CancellationDecision = {
  readonly decisionId: string;
  readonly kind: "continue_cancel" | "accept_registered_offer" | "keep_subscription";
  readonly choiceId?: string;
  readonly reason?: string;
};
export type CancellationCommandReceipt = {
  readonly commandId: string;
  readonly providerOutcome: "pending" | "confirmed" | "failed" | "indeterminate";
  readonly effect: "none" | "cancellation_scheduled" | "ended" | "resumed" | "plan_changed";
  readonly refundOutcome: "not_requested" | "pending" | "confirmed" | "failed" | "indeterminate";
};
export type CancellationEvidence = {
  readonly kind: "intent" | "displayed" | "decision" | "command" | "provider";
  readonly at: string;
  readonly decisionId?: string;
  readonly commandReceipt?: CancellationCommandReceipt;
};
export type CancellationSession = CancellationIdentity & {
  readonly id: string;
  readonly revision: number;
  readonly subscriptionRevision: string;
  readonly quoteRef: string;
  readonly policyVersion: number;
  readonly snapshot: CancellationSnapshot;
  readonly choices: readonly CancellationChoice[];
  readonly keepAvailable: boolean;
  readonly state: "open" | "decided";
  readonly createdAt: string;
  readonly evidence: readonly CancellationEvidence[];
  readonly displayedAt?: string;
  readonly decision?: CancellationDecision;
  readonly commandReceipt?: CancellationCommandReceipt;
};
export type ChoicePolicyAudit = {
  readonly actor: string;
  readonly reason: string;
  readonly idempotencyKey: string;
  readonly expectedRevision: number;
  readonly at: string;
};
/** Implementations atomically compare revisions and persist the complete session, including decision and command reservation. A missing resource is never a global lookup. */
export interface CancellationStore {
  createSession(session: CancellationSession): Promise<void>;
  getSession(scope: CancellationScope, id: string): Promise<CancellationSession | undefined>;
  saveSession(session: CancellationSession, expectedRevision: number): Promise<boolean>;
  getPolicy(scope: CancellationScope): Promise<ChoicePolicy | undefined>;
  /** Atomically deduplicates audit idempotency keys, verifies expectedRevision, and stores policy plus audit. Conflicting key reuse throws. */
  savePolicy(policy: ChoicePolicy, audit: ChoicePolicyAudit): Promise<ChoicePolicy>;
  listSessions(scope: CancellationScope): Promise<readonly CancellationSession[]>;
}
export interface CancellationAuthority {
  /** Authenticate the subject and verify ownership using server credentials, never caller assertions. */
  authorize(identity: CancellationIdentity): Promise<void>;
  authorizePolicy(scope: CancellationScope, actor: string): Promise<void>;
  snapshot(identity: CancellationIdentity): Promise<CancellationSnapshot>;
  /** Serialize admission against application subscription/quote changes, revalidate pinned state, then execute the callback. */
  admit<T>(
    identity: CancellationIdentity,
    snapshot: CancellationSnapshot,
    operation: () => Promise<T>,
  ): Promise<T>;
}
export interface CancellationAction {
  readonly kind: CancellationActionKind;
  available(snapshot: CancellationSnapshot): boolean;
  execute(input: {
    readonly session: CancellationSession;
    readonly commandId: string;
    readonly choiceId?: string;
  }): Promise<CancellationCommandReceipt>;
  /** Reconcile the same logical command and idempotency key. Never allocate a new command identity. */
  lookup(input: {
    readonly session: CancellationSession;
    readonly commandId: string;
  }): Promise<CancellationCommandReceipt>;
}
