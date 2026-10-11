import { CancellationInputProblem } from "@croco/billing-core/cancellation";
import type { CancellationDecision, ChoicePolicyEntry } from "@croco/billing-core/cancellation";
import type { RetentionOfferEdit } from "@croco/admin-core";

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new CancellationInputProblem("An object is required");
  return input as Record<string, unknown>;
}
export function parseDecision(input: unknown): CancellationDecision {
  const value = object(input);
  if (
    typeof value.decisionId !== "string" ||
    (value.kind !== "continue_cancel" &&
      value.kind !== "accept_registered_offer" &&
      value.kind !== "keep_subscription") ||
    (value.choiceId !== undefined && typeof value.choiceId !== "string") ||
    (value.reason !== undefined && typeof value.reason !== "string")
  )
    throw new CancellationInputProblem("Invalid decision");
  return {
    decisionId: value.decisionId,
    kind: value.kind,
    ...(value.choiceId === undefined ? {} : { choiceId: value.choiceId }),
    ...(value.reason === undefined ? {} : { reason: value.reason }),
  };
}
export function parsePolicyEdit(input: unknown): RetentionOfferEdit {
  const value = object(input);
  if (
    !Array.isArray(value.entries) ||
    typeof value.reason !== "string" ||
    typeof value.expectedRevision !== "number" ||
    typeof value.idempotencyKey !== "string"
  )
    throw new CancellationInputProblem("Invalid policy edit");
  const entries: ChoicePolicyEntry[] = value.entries.map((item: unknown) => {
    const entry = object(item);
    if (
      typeof entry.choiceId !== "string" ||
      typeof entry.label !== "string" ||
      typeof entry.order !== "number" ||
      typeof entry.enabled !== "boolean" ||
      !Array.isArray(entry.billingPeriods) ||
      !Array.isArray(entry.refundKinds) ||
      entry.billingPeriods.some((period) => period !== "initial" && period !== "renewal") ||
      entry.refundKinds.some((kind) => kind !== "none" && kind !== "partial" && kind !== "full")
    )
      throw new CancellationInputProblem("Invalid registered choice edit");
    return {
      choiceId: entry.choiceId,
      label: entry.label,
      order: entry.order,
      enabled: entry.enabled,
      billingPeriods: entry.billingPeriods as ("initial" | "renewal")[],
      refundKinds: entry.refundKinds as ("none" | "partial" | "full")[],
    };
  });
  return {
    entries,
    reason: value.reason,
    expectedRevision: value.expectedRevision,
    idempotencyKey: value.idempotencyKey,
  };
}
