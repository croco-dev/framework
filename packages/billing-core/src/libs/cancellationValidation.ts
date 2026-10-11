import {
  CancellationAuthorizationProblem,
  CancellationConflictProblem,
  CancellationInputProblem,
  CancellationUnavailableProblem,
} from "./problems/CancellationProblems";
import type {
  CancellationScope,
  CancellationIdentity,
  CancellationSnapshot,
  CancellationSession,
  CancellationDecision,
} from "./Cancellation";
export function validateCancellationScope(scope: CancellationScope): void {
  if (
    ![scope.appId, scope.environment, scope.tenantId].every(
      (value) => typeof value === "string" && value.trim().length > 0,
    )
  )
    throw new CancellationInputProblem("Application, environment, and tenant are required");
}
export function sameCancellationIdentity(
  a: CancellationIdentity,
  b: CancellationIdentity,
): boolean {
  return (
    a.appId === b.appId &&
    a.environment === b.environment &&
    a.tenantId === b.tenantId &&
    a.subject === b.subject &&
    a.subscriptionRef === b.subscriptionRef
  );
}
export function validateCancellationSnapshot(
  identity: CancellationIdentity,
  snapshot: CancellationSnapshot,
  now: Date,
  pinned?: CancellationSnapshot,
): void {
  validateCancellationScope(identity);
  if (!sameCancellationIdentity(identity, snapshot)) throw new CancellationAuthorizationProblem();
  if (
    !Number.isFinite(Date.parse(snapshot.subscriptionStartedAt)) ||
    Date.parse(snapshot.subscriptionStartedAt) > now.getTime() ||
    !/^(0|[1-9]\d*)(\.\d+)?$/.test(snapshot.quote.amount) ||
    !/^[A-Z]{3}$/.test(snapshot.quote.currency) ||
    !["none", "partial", "full"].includes(snapshot.quote.refund) ||
    !["active", "cancellation_scheduled", "ended"].includes(snapshot.status) ||
    !["initial", "renewal"].includes(snapshot.billingPeriod)
  )
    throw new CancellationInputProblem("Invalid authoritative subscription or quote values");
  if (
    !snapshot.revision ||
    !snapshot.quote.ref ||
    !Number.isFinite(Date.parse(snapshot.quote.expiresAt)) ||
    Date.parse(snapshot.quote.expiresAt) <= now.getTime() ||
    (pinned &&
      (pinned.revision !== snapshot.revision ||
        pinned.quote.ref !== snapshot.quote.ref ||
        pinned.quote.amount !== snapshot.quote.amount ||
        pinned.quote.currency !== snapshot.quote.currency ||
        pinned.quote.refund !== snapshot.quote.refund ||
        pinned.quote.expiresAt !== snapshot.quote.expiresAt))
  )
    throw new CancellationConflictProblem(snapshot);
}
export function validateCancellationDecision(
  session: CancellationSession,
  decision: CancellationDecision,
  now = new Date(),
): void {
  if (decision.reason !== undefined && decision.reason.length > 500)
    throw new CancellationInputProblem("Cancellation reason exceeds 500 characters");
  if (
    !decision.decisionId.trim() ||
    !["continue_cancel", "accept_registered_offer", "keep_subscription"].includes(decision.kind)
  )
    throw new CancellationInputProblem("A valid decision and decision id are required");
  validateCancellationSnapshot(session, session.snapshot, now);
  if (
    decision.kind === "keep_subscription" &&
    (!session.keepAvailable || session.snapshot.status === "ended")
  )
    throw new CancellationUnavailableProblem();
  if (decision.kind === "accept_registered_offer") {
    const choice = session.choices.find((entry) => entry.id === decision.choiceId);
    if (!choice?.available || choice.action === "cancel")
      throw new CancellationUnavailableProblem();
  } else if (
    decision.kind === "continue_cancel" &&
    !session.choices.some((choice) => choice.action === "cancel" && choice.available)
  )
    throw new CancellationUnavailableProblem();
  else if (decision.choiceId !== undefined)
    throw new CancellationInputProblem("Only an offer decision accepts a choice id");
}
