import { Money } from "@croco/billing-core";
import { OutcomeLedgerNormalizer, OutcomeProblem } from "@croco/metrics-core";
import type { BillingAccount, Order } from "@croco/billing-core";
import type { CreditAccount, CreditTransaction } from "@croco/credits-core";
import type { EngagementDispatch } from "@croco/engagement-core";
import type { MoneyEvent, OutcomeScope } from "@croco/metrics-core";

export type OutcomeSourceBinding = {
  readonly scope: OutcomeScope;
  readonly source: string;
  readonly subject: string;
  readonly observedAt: string;
};

function sourceBinding(binding: OutcomeSourceBinding): OutcomeSourceBinding {
  return {
    scope: {
      app: binding.scope.app,
      environment: binding.scope.environment,
      tenant: binding.scope.tenant,
    },
    source: binding.source,
    subject: binding.subject,
    observedAt: binding.observedAt,
  };
}

function validate(event: MoneyEvent): MoneyEvent {
  if (!event.subject?.trim()) throw new OutcomeProblem("source_subject_required");
  const normalized = new OutcomeLedgerNormalizer().normalize([event], {
    scope: event.scope,
    cutoff: { effectiveAt: event.occurredAt, knownAt: event.observedAt },
  });
  return normalized.events[0];
}

function timestamp(value: Date): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new OutcomeProblem("source_timestamp_invalid");
  }
  return value.toISOString();
}

export function billingOrderOutcome(
  order: Order,
  account: BillingAccount,
  binding: OutcomeSourceBinding,
): MoneyEvent {
  if (order.billingAccountId !== account.id || account.tenantId !== binding.scope.tenant) {
    throw new OutcomeProblem("billing_account_scope_mismatch");
  }
  const amount = new Money(order.amount, order.currency);
  return validate({
    ...sourceBinding(binding),
    eventId: order.externalOrderId,
    kind: "payment",
    amountMinor: String(amount.amount),
    currency: amount.currency,
    occurredAt: timestamp(order.paidAt),
    valuationKind: "cash",
  });
}

/** Billing has no refund projection. Supply a settled source row, linked to its payment. */
export function settledRefundOutcome(event: MoneyEvent): MoneyEvent {
  if (event.kind !== "refund" || !event.relatedPaymentId) {
    throw new OutcomeProblem("settled_refund_reference_required");
  }
  return validate(event);
}

export type CreditGrantValuation = {
  readonly amountMinor: string;
  readonly currency: string;
  readonly valuationRef: string;
};

export type CreditGrantOutcome = {
  readonly event: MoneyEvent;
  readonly creditUnits: string;
  readonly valuationRef: string;
};

export function creditGrantOutcome(
  transaction: CreditTransaction,
  account: CreditAccount,
  binding: OutcomeSourceBinding,
  valuation: CreditGrantValuation,
): CreditGrantOutcome {
  if (
    transaction.kind !== "grant" ||
    transaction.accountId !== account.id ||
    account.tenantId !== binding.scope.tenant ||
    !valuation.valuationRef.trim()
  ) {
    throw new OutcomeProblem("credit_grant_binding_invalid");
  }
  return {
    event: validate({
      ...sourceBinding(binding),
      eventId: transaction.id,
      kind: "noncash_grant",
      amountMinor: valuation.amountMinor,
      currency: valuation.currency,
      occurredAt: timestamp(transaction.occurredAt),
      valuationKind: "face_value",
    }),
    creditUnits: transaction.amount,
    valuationRef: valuation.valuationRef,
  };
}

export type SettledContactCostReceipt = {
  readonly id: string;
  readonly dispatchId: string;
  readonly amountMinor: string;
  readonly currency: string;
  readonly incurredAt: string;
  readonly observedAt: string;
};

export type ContactCostOutcome =
  | { readonly status: "missing"; readonly source: string; readonly subject: string }
  | { readonly status: "settled"; readonly event: MoneyEvent };

export function engagementContactCostOutcome(
  dispatch: EngagementDispatch,
  binding: OutcomeSourceBinding,
  receipt?: SettledContactCostReceipt,
): ContactCostOutcome {
  if (dispatch.tenantId !== binding.scope.tenant || dispatch.recipientId !== binding.subject) {
    throw new OutcomeProblem("contact_cost_scope_mismatch");
  }
  if (!receipt) return { status: "missing", source: binding.source, subject: binding.subject };
  if (receipt.dispatchId !== dispatch.id) throw new OutcomeProblem("contact_cost_receipt_mismatch");
  return {
    status: "settled",
    event: validate({
      ...sourceBinding(binding),
      eventId: receipt.id,
      kind: "direct_contact_cost",
      amountMinor: receipt.amountMinor,
      currency: receipt.currency,
      occurredAt: receipt.incurredAt,
      observedAt: receipt.observedAt,
      valuationKind: "cash",
    }),
  };
}
