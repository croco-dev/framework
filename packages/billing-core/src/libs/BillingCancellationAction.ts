import { validateCancellationSnapshot, sameCancellationIdentity } from "./cancellationValidation";
import {
  CancellationAuthorizationProblem,
  CancellationConflictProblem,
} from "./problems/CancellationProblems";
import type { BillingService } from "./BillingService";
import type { BillingStore } from "./BillingStore";
import type { BillingLifecycleCommand } from "../types";
import type {
  CancellationAction,
  CancellationAuthority,
  CancellationCommandReceipt,
  CancellationScope,
  CancellationSession,
  CancellationSnapshot,
} from "./Cancellation";

/** Binds existing billing lifecycle commands to an application's isolated billing store. Refund execution is never inferred. */
export class BillingCancellationAction implements CancellationAction {
  constructor(
    readonly kind: "cancel" | "resume",
    private readonly scope: CancellationScope,
    private readonly billing: BillingService,
    private readonly store: BillingStore,
    private readonly authority: CancellationAuthority,
  ) {}
  available(snapshot: CancellationSnapshot): boolean {
    return this.kind === "resume"
      ? snapshot.status === "cancellation_scheduled"
      : snapshot.status === "active";
  }
  async execute(input: {
    readonly session: CancellationSession;
    readonly commandId: string;
  }): Promise<CancellationCommandReceipt> {
    this.assertScope(input.session);
    const account = await this.store.findAccountByTenantId(input.session.tenantId);
    const current = account ? await this.store.findSubscription(account.id) : null;
    if (current?.id !== input.session.subscriptionRef) throw new CancellationConflictProblem();
    const command =
      this.kind === "cancel"
        ? await this.billing.cancelSubscription({
            tenantId: this.scope.tenantId,
            idempotencyKey: input.commandId,
          })
        : await this.billing.resumeSubscription({
            tenantId: this.scope.tenantId,
            idempotencyKey: input.commandId,
          });
    return this.receipt(command, input.commandId);
  }
  async lookup(input: {
    readonly session: CancellationSession;
    readonly commandId: string;
  }): Promise<CancellationCommandReceipt> {
    this.assertScope(input.session);
    const command = await this.store.findLifecycleCommand(input.commandId);
    if (!command) {
      const fresh = await this.authority.snapshot(input.session);
      validateCancellationSnapshot(input.session, fresh, new Date(), input.session.snapshot);
      return this.authority.admit(input.session, fresh, () => this.execute(input));
    }
    if (
      command.tenantId !== input.session.tenantId ||
      command.subscription.id !== input.session.subscriptionRef
    )
      throw new CancellationAuthorizationProblem();
    // Reconcile the existing durable command using its original provider idempotency key.
    const resolved =
      command.state !== "completed"
        ? await this.billing.reconcileLifecycleCommand(input.commandId)
        : command;
    const receipt = this.receipt(resolved, input.commandId);
    if (this.kind === "cancel" && receipt.providerOutcome === "confirmed") {
      const snapshot = await this.authority.snapshot(input.session);
      if (!sameCancellationIdentity(input.session, snapshot))
        throw new CancellationAuthorizationProblem();
      if (snapshot.status === "ended") return { ...receipt, effect: "ended" };
    }
    return receipt;
  }
  private assertScope(session: CancellationSession) {
    if (
      this.scope.appId !== session.appId ||
      this.scope.environment !== session.environment ||
      this.scope.tenantId !== session.tenantId
    )
      throw new CancellationAuthorizationProblem();
  }
  private receipt(command: BillingLifecycleCommand, id: string): CancellationCommandReceipt {
    const confirmed = command.state !== "pending_provider";
    return {
      commandId: id,
      providerOutcome: confirmed ? "confirmed" : command.lastFailure ? "indeterminate" : "pending",
      effect: confirmed ? (this.kind === "cancel" ? "cancellation_scheduled" : "resumed") : "none",
      refundOutcome: "not_requested",
    };
  }
}
