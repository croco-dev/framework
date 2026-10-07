import { hashCheckoutValue } from "./BillingService";
import {
  CancellationAuthorizationProblem,
  CancellationConflictProblem,
  CancellationInputProblem,
  CancellationUnavailableProblem,
} from "./problems/CancellationProblems";
import type {
  CancellationAction,
  CancellationAuthority,
  CancellationChoice,
  CancellationDecision,
  CancellationIdentity,
  CancellationScope,
  CancellationSession,
  CancellationStore,
  ChoicePolicyAudit,
  ChoicePolicyEntry,
  RegisteredCancellationChoice,
} from "./Cancellation";

import {
  validateCancellationScope,
  validateCancellationSnapshot,
  validateCancellationDecision,
  sameCancellationIdentity,
} from "./cancellationValidation";
export {
  validateCancellationScope,
  validateCancellationSnapshot,
  validateCancellationDecision,
} from "./cancellationValidation";
export type CancellationServiceDependencies = {
  readonly store: CancellationStore;
  readonly authority: CancellationAuthority;
  readonly choices: readonly RegisteredCancellationChoice[];
  readonly actions: readonly CancellationAction[];
  readonly clock?: () => Date;
};
export class CancellationService {
  private readonly clock: () => Date;
  constructor(private readonly dependencies: CancellationServiceDependencies) {
    this.clock = dependencies.clock ?? (() => new Date());
    if (
      dependencies.choices.some((choice) => choice.id === "cancel" || choice.action === "cancel") ||
      new Set(dependencies.choices.map((choice) => choice.id)).size !==
        dependencies.choices.length ||
      new Set(dependencies.actions.map((action) => action.kind)).size !==
        dependencies.actions.length
    )
      throw new CancellationInputProblem("Duplicate action or choice registration");
  }
  async createSession(identity: CancellationIdentity, id: string): Promise<CancellationSession> {
    await this.authorize(identity);
    if (!id.trim()) throw new CancellationInputProblem("A session id is required");
    const snapshot = await this.dependencies.authority.snapshot(identity);
    validateCancellationSnapshot(identity, snapshot, this.clock());
    const policy = await this.dependencies.store.getPolicy(identity);
    const choices: CancellationChoice[] = [...(policy?.entries ?? [])]
      .sort((a, b) => a.order - b.order)
      .filter(
        (entry) =>
          entry.enabled &&
          entry.billingPeriods.includes(snapshot.billingPeriod) &&
          entry.refundKinds.includes(snapshot.quote.refund),
      )
      .map((entry) => {
        const registered = this.dependencies.choices.find((choice) => choice.id === entry.choiceId);
        if (!registered) throw new CancellationUnavailableProblem();
        return {
          ...registered,
          label: entry.label,
          available:
            this.dependencies.actions
              .find((action) => action.kind === registered.action)
              ?.available(snapshot) ?? false,
        };
      });
    choices.unshift({
      id: "cancel",
      action: "cancel",
      label: "Cancel subscription",
      consequence:
        "Cancellation is scheduled for the end of the billing period. No refund is implied.",
      available:
        this.dependencies.actions.find((action) => action.kind === "cancel")?.available(snapshot) ??
        false,
    });
    const session: CancellationSession = {
      ...identity,
      id,
      revision: 0,
      subscriptionRevision: snapshot.revision,
      quoteRef: snapshot.quote.ref,
      policyVersion: policy?.version ?? 0,
      snapshot,
      choices,
      keepAvailable:
        snapshot.status === "active" ||
        (snapshot.status === "cancellation_scheduled" &&
          (this.dependencies.actions
            .find((action) => action.kind === "resume")
            ?.available(snapshot) ??
            false)),
      state: "open",
      createdAt: this.clock().toISOString(),
      evidence: [{ kind: "intent", at: this.clock().toISOString() }],
    };
    await this.dependencies.store.createSession(session);
    return session;
  }
  async markDisplayed(identity: CancellationIdentity, id: string): Promise<CancellationSession> {
    const session = await this.session(identity, id);
    if (session.displayedAt) return session;
    return this.save(
      {
        ...session,
        revision: session.revision + 1,
        displayedAt: this.clock().toISOString(),
        evidence: [...session.evidence, { kind: "displayed", at: this.clock().toISOString() }],
      },
      session.revision,
    );
  }
  async decide(
    identity: CancellationIdentity,
    id: string,
    decision: CancellationDecision,
  ): Promise<CancellationSession> {
    const session = await this.session(identity, id);
    if (session.decision) {
      if (
        session.decision.decisionId !== decision.decisionId ||
        session.decision.kind !== decision.kind ||
        session.decision.choiceId !== decision.choiceId ||
        session.decision.reason !== decision.reason
      )
        throw new CancellationConflictProblem();
      return this.reconcile(identity, id);
    }
    const fresh = await this.dependencies.authority.snapshot(identity);
    validateCancellationSnapshot(identity, fresh, this.clock(), session.snapshot);
    validateCancellationDecision(session, decision, this.clock());
    const action = this.action(session, decision);
    if (action && !action.available(fresh)) throw new CancellationUnavailableProblem();
    return this.dependencies.authority.admit(identity, fresh, async () => {
      const commandId = `cancellation:${hashCheckoutValue(JSON.stringify([identity.appId, identity.environment, identity.tenantId, id]))}`;
      const reserved = await this.save(
        {
          ...session,
          revision: session.revision + 1,
          state: "decided",
          decision,
          evidence: [
            ...session.evidence,
            { kind: "decision", at: this.clock().toISOString(), decisionId: decision.decisionId },
            ...(action
              ? [
                  {
                    kind: "command" as const,
                    at: this.clock().toISOString(),
                    commandReceipt: {
                      commandId,
                      providerOutcome: "pending" as const,
                      effect: "none" as const,
                      refundOutcome: "not_requested" as const,
                    },
                  },
                ]
              : []),
          ],
          ...(action
            ? {
                commandReceipt: {
                  commandId,
                  providerOutcome: "pending" as const,
                  effect: "none" as const,
                  refundOutcome: "not_requested" as const,
                },
              }
            : {}),
        },
        session.revision,
      );
      if (!action) return reserved;
      const receipt = await action.execute({
        session: reserved,
        commandId,
        choiceId: decision.choiceId,
      });
      if (receipt.commandId !== commandId)
        throw new CancellationInputProblem("Action returned a different command identity");
      return this.save(
        {
          ...reserved,
          revision: reserved.revision + 1,
          commandReceipt: receipt,
          evidence: [
            ...reserved.evidence,
            { kind: "provider", at: this.clock().toISOString(), commandReceipt: receipt },
          ],
        },
        reserved.revision,
      );
    });
  }
  async reconcile(identity: CancellationIdentity, id: string): Promise<CancellationSession> {
    const session = await this.session(identity, id);
    if (!session.decision || !session.commandReceipt) return session;
    const action = this.action(session, session.decision);
    if (!action) return session;
    const receipt = await action.lookup({ session, commandId: session.commandReceipt.commandId });
    if (receipt.commandId !== session.commandReceipt.commandId)
      throw new CancellationInputProblem("Action returned a different command identity");
    if (
      receipt.providerOutcome === session.commandReceipt.providerOutcome &&
      receipt.effect === session.commandReceipt.effect &&
      receipt.refundOutcome === session.commandReceipt.refundOutcome
    )
      return session;
    return this.save(
      {
        ...session,
        revision: session.revision + 1,
        commandReceipt: receipt,
        evidence: [
          ...session.evidence,
          { kind: "provider", at: this.clock().toISOString(), commandReceipt: receipt },
        ],
      },
      session.revision,
    );
  }
  async updatePolicy(
    scope: CancellationScope,
    entries: readonly ChoicePolicyEntry[],
    audit: ChoicePolicyAudit,
  ) {
    validateCancellationScope(scope);
    if (
      !audit.actor.trim() ||
      !audit.reason.trim() ||
      !audit.idempotencyKey.trim() ||
      !Number.isInteger(audit.expectedRevision) ||
      audit.expectedRevision < 0
    )
      throw new CancellationInputProblem(
        "Policy actor, reason, idempotency key and revision are required",
      );
    await this.dependencies.authority.authorizePolicy(scope, audit.actor);
    if (
      new Set(entries.map((entry) => entry.choiceId)).size !== entries.length ||
      entries.some(
        (entry) =>
          !entry.label.trim() ||
          !Number.isFinite(entry.order) ||
          !this.dependencies.choices.some((choice) => choice.id === entry.choiceId),
      )
    )
      throw new CancellationInputProblem(
        "Policy must reference distinct registered choices with labels and ordering",
      );
    return this.dependencies.store.savePolicy(
      { ...scope, entries, version: audit.expectedRevision + 1 },
      { ...audit, at: this.clock().toISOString() },
    );
  }
  async listSessions(scope: CancellationScope, actor: string) {
    validateCancellationScope(scope);
    await this.dependencies.authority.authorizePolicy(scope, actor);
    return this.dependencies.store.listSessions(scope);
  }
  private async authorize(identity: CancellationIdentity) {
    validateCancellationScope(identity);
    if (!identity.subject.trim() || !identity.subscriptionRef.trim())
      throw new CancellationAuthorizationProblem();
    await this.dependencies.authority.authorize(identity);
  }
  private async session(identity: CancellationIdentity, id: string) {
    await this.authorize(identity);
    const session = await this.dependencies.store.getSession(identity, id);
    if (!session || !sameCancellationIdentity(identity, session))
      throw new CancellationAuthorizationProblem();
    return session;
  }
  private action(session: CancellationSession, decision: CancellationDecision) {
    if (decision.kind === "keep_subscription" && session.snapshot.status === "active")
      return undefined;
    const kind =
      decision.kind === "continue_cancel"
        ? "cancel"
        : decision.kind === "keep_subscription"
          ? "resume"
          : session.choices.find((choice) => choice.id === decision.choiceId)?.action;
    const action = this.dependencies.actions.find((entry) => entry.kind === kind);
    if (!action) throw new CancellationUnavailableProblem();
    return action;
  }
  private async save(session: CancellationSession, revision: number) {
    if (!(await this.dependencies.store.saveSession(session, revision)))
      throw new CancellationConflictProblem();
    return session;
  }
}
