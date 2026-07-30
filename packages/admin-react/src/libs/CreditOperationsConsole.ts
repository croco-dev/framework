import { createElement, Fragment, type ChangeEvent, type ReactElement } from "react";

import {
  filterCreditOperationsTransactions,
  resolveCreditOperationsReference,
} from "@croco/admin-core";
import type {
  CreditOperationsAction,
  CreditOperationsFilter,
  CreditOperationsReadyState,
  CreditOperationsReservation,
  CreditOperationsSnapshot,
  CreditOperationsState,
  CreditOperationsTransaction,
} from "@croco/admin-core";

export type CreditOperationsConsoleProps = {
  readonly state: CreditOperationsState;
  readonly filter?: CreditOperationsFilter;
  readonly selectedTransactionId?: string;
  readonly selectedReservationId?: string;
  readonly onFilterChange?: (filter: CreditOperationsFilter) => void;
  readonly onSelectTransaction?: (transactionId: string) => void;
  readonly onSelectReservation?: (reservationId: string) => void;
  readonly onAction?: (action: CreditOperationsAction) => void;
  readonly onRefresh?: () => void;
};

export function CreditOperationsConsole({
  filter,
  onAction,
  onFilterChange,
  onRefresh,
  onSelectReservation,
  onSelectTransaction,
  selectedReservationId,
  selectedTransactionId,
  state,
}: CreditOperationsConsoleProps): ReactElement {
  if (state.kind === "loading") {
    return createElement(
      "section",
      { "aria-busy": true, "aria-label": "Tenant credit operations", "data-state": "loading" },
      createElement("h1", null, "Tenant credits"),
      createElement("p", null, "Loading credit balance and ledger history."),
    );
  }
  if (state.kind === "empty") {
    return createElement(
      "section",
      { "aria-label": "Tenant credit operations", "data-state": "empty" },
      createElement("h1", null, "Tenant credits"),
      createElement("p", null, state.message ?? "No credit account is configured for this tenant."),
    );
  }
  if (state.kind === "permission-denied") {
    return createProblemState(
      "permission-denied",
      state.problem.title ?? "Credit permission denied",
      state.problem.detail ?? `Required: ${state.requiredPermissions.join(", ")}`,
      onRefresh,
    );
  }
  if (state.kind === "problem") {
    return createElement(
      "section",
      {
        "aria-label": "Tenant credit operations",
        "data-problem-code": state.problem.code,
        "data-state": "problem",
        role: "alert",
      },
      createElement("h1", null, state.problem.title ?? "Credit ledger unavailable"),
      createElement("p", null, state.problem.detail ?? state.problem.code),
      onRefresh
        ? createElement("button", { onClick: onRefresh, type: "button" }, "Retry credit history")
        : null,
      state.partial
        ? createReadyConsole({
            filter,
            onFilterChange,
            onRefresh,
            onSelectReservation,
            onSelectTransaction,
            selectedReservationId,
            selectedTransactionId,
            state: { ...state.partial, actions: [] },
          })
        : null,
    );
  }
  if (state.kind === "stale") {
    return createElement(
      "section",
      { "aria-label": "Tenant credit operations", "data-state": "stale" },
      createElement("h1", null, "Tenant credits"),
      createElement(
        "div",
        { role: "alert" },
        createElement("p", null, state.problem.detail ?? state.problem.code),
        createElement(
          "p",
          null,
          `Expected ledger position ${state.expectedPosition}; current position ${state.actualPosition}.`,
        ),
        onRefresh
          ? createElement("button", { onClick: onRefresh, type: "button" }, "Refresh ledger")
          : null,
      ),
      createSnapshot(
        state.snapshot,
        [],
        filter,
        onFilterChange,
        selectedTransactionId,
        selectedReservationId,
        onSelectTransaction,
        onSelectReservation,
      ),
    );
  }
  return createReadyConsole({
    filter,
    onAction,
    onFilterChange,
    onRefresh,
    onSelectReservation,
    onSelectTransaction,
    selectedReservationId,
    selectedTransactionId,
    state,
  });
}

function createReadyConsole({
  filter,
  onAction,
  onFilterChange,
  onRefresh,
  onSelectReservation,
  onSelectTransaction,
  selectedReservationId,
  selectedTransactionId,
  state,
}: Omit<CreditOperationsConsoleProps, "state"> & {
  readonly state: CreditOperationsReadyState;
}): ReactElement {
  return createElement(
    "section",
    {
      "aria-label": "Tenant credit operations",
      "data-account-id": state.snapshot.accountId,
      "data-ledger-position": state.snapshot.balance.ledgerPosition,
      "data-state": "ready",
    },
    createElement("h1", null, "Tenant credits"),
    createElement(
      "p",
      null,
      `Append-only ledger at position ${state.snapshot.balance.ledgerPosition}.`,
    ),
    onRefresh
      ? createElement("button", { onClick: onRefresh, type: "button" }, "Refresh ledger")
      : null,
    createSnapshot(
      state.snapshot,
      state.grantedPermissions,
      filter,
      onFilterChange,
      selectedTransactionId,
      selectedReservationId,
      onSelectTransaction,
      onSelectReservation,
    ),
    createActions(state.actions, onAction),
  );
}

function createSnapshot(
  snapshot: CreditOperationsSnapshot,
  grantedPermissions: readonly string[],
  filter: CreditOperationsFilter | undefined,
  onFilterChange: CreditOperationsConsoleProps["onFilterChange"],
  selectedTransactionId: string | undefined,
  selectedReservationId: string | undefined,
  onSelectTransaction: CreditOperationsConsoleProps["onSelectTransaction"],
  onSelectReservation: CreditOperationsConsoleProps["onSelectReservation"],
): ReactElement {
  const visibleTransactions = filter
    ? filterCreditOperationsTransactions(snapshot.transactions, filter, grantedPermissions)
    : snapshot.transactions;
  const visibleReservations =
    filter?.reservationStatus === undefined
      ? snapshot.reservations
      : snapshot.reservations.filter(
          (reservation) => reservation.status === filter.reservationStatus,
        );
  const selectedTransaction =
    visibleTransactions.find((transaction) => transaction.id === selectedTransactionId) ??
    visibleTransactions[0];
  const selectedReservation =
    visibleReservations.find((reservation) => reservation.id === selectedReservationId) ??
    visibleReservations[0];

  return createElement(
    Fragment,
    null,
    createBalanceSummary(snapshot),
    createFilterControls(filter ?? {}, onFilterChange),
    snapshot.history.kind === "partial"
      ? createElement(
          "p",
          { "data-history": "partial", role: "status" },
          `Partial history from position ${snapshot.history.earliestPosition}: ${snapshot.history.reason}`,
        )
      : createElement("p", { "data-history": "complete" }, "Complete ledger history is shown."),
    createGrantLots(snapshot, grantedPermissions),
    createTransactions(
      visibleTransactions,
      grantedPermissions,
      selectedTransaction?.id,
      onSelectTransaction,
    ),
    selectedTransaction
      ? createTransactionDetail(selectedTransaction, snapshot, grantedPermissions)
      : null,
    createReservations(visibleReservations, selectedReservation?.id, onSelectReservation),
    selectedReservation ? createReservationDetail(selectedReservation, snapshot) : null,
  );
}

function createBalanceSummary(snapshot: CreditOperationsSnapshot): ReactElement {
  const balance = snapshot.balance;
  return createElement(
    "section",
    { "aria-label": "Credit balance summary" },
    createElement("h2", null, "Balance"),
    createElement(
      "dl",
      null,
      createMetric("Available", balance.available),
      createMetric("Reserved", balance.reserved),
      createMetric("Consumed", balance.consumed),
      createMetric("Expired", balance.expired),
      createMetric(`Expiring by ${balance.expiringSoonBefore.toISOString()}`, balance.expiringSoon),
      createMetric("Lifetime granted", balance.lifetimeGranted),
      createMetric("Net adjusted", balance.netAdjusted),
    ),
  );
}

function createMetric(label: string, value: string): ReactElement {
  return createElement(
    Fragment,
    { key: label },
    createElement("dt", null, label),
    createElement("dd", null, value),
  );
}

function createFilterControls(
  filter: CreditOperationsFilter,
  onFilterChange: CreditOperationsConsoleProps["onFilterChange"],
): ReactElement {
  return createElement(
    "fieldset",
    { "aria-label": "Credit ledger filters" },
    createElement("legend", null, "Filters"),
    createElement(
      "label",
      null,
      "Transaction kind",
      createElement(
        "select",
        {
          onChange: (event: ChangeEvent<HTMLSelectElement>) =>
            onFilterChange?.({
              ...filter,
              kinds: event.currentTarget.value
                ? [event.currentTarget.value as CreditOperationsTransaction["kind"]]
                : undefined,
            }),
          value: filter.kinds?.[0] ?? "",
        },
        createElement("option", { value: "" }, "All kinds"),
        ["grant", "reserve", "commit", "release", "consume", "expire", "refund", "adjustment"].map(
          (kind) => createElement("option", { key: kind, value: kind }, kind),
        ),
      ),
    ),
    createTextFilter("Meter", filter.meterKey, (value) =>
      onFilterChange?.({ ...filter, meterKey: value || undefined }),
    ),
    createTextFilter("Semantic reference", filter.semanticReference, (value) =>
      onFilterChange?.({ ...filter, semanticReference: value || undefined }),
    ),
    createDateFilter("From", filter.from, (value) => onFilterChange?.({ ...filter, from: value })),
    createDateFilter("To", filter.to, (value) => onFilterChange?.({ ...filter, to: value })),
    createElement(
      "label",
      null,
      "Reservation status",
      createElement(
        "select",
        {
          onChange: (event: ChangeEvent<HTMLSelectElement>) =>
            onFilterChange?.({
              ...filter,
              reservationStatus:
                (event.currentTarget.value as CreditOperationsReservation["status"]) || undefined,
            }),
          value: filter.reservationStatus ?? "",
        },
        createElement("option", { value: "" }, "All statuses"),
        createElement("option", { value: "active" }, "active"),
        createElement("option", { value: "committed" }, "committed"),
        createElement("option", { value: "released" }, "released"),
      ),
    ),
  );
}

function createDateFilter(
  label: string,
  value: Date | undefined,
  onChange: (value: Date | undefined) => void,
): ReactElement {
  return createElement(
    "label",
    null,
    label,
    createElement("input", {
      onChange: (event: ChangeEvent<HTMLInputElement>) =>
        onChange(
          event.currentTarget.value === undefined || event.currentTarget.value === ""
            ? undefined
            : new Date(event.currentTarget.value),
        ),
      type: "datetime-local",
      value: value === undefined ? "" : formatLocalDateTime(value),
    }),
  );
}

function formatLocalDateTime(value: Date): string {
  const localTime = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

function createTextFilter(
  label: string,
  value: string | undefined,
  onChange: (value: string) => void,
): ReactElement {
  return createElement(
    "label",
    null,
    label,
    createElement("input", {
      onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.currentTarget.value),
      type: "search",
      value: value ?? "",
    }),
  );
}

function createGrantLots(
  snapshot: CreditOperationsSnapshot,
  grantedPermissions: readonly string[],
): ReactElement {
  return createElement(
    "section",
    { "aria-label": "Credit grant lots" },
    createElement("h2", null, "Grant lots"),
    snapshot.grantLots.length === 0
      ? createElement("p", null, "No grant lots are visible.")
      : createElement(
          "ul",
          null,
          snapshot.grantLots.map((lot) =>
            createElement(
              "li",
              { "data-grant-id": lot.transactionId, key: lot.transactionId },
              `${lot.transactionId}: ${lot.remaining} of ${lot.amount} ${lot.status}`,
              lot.expiresAt ? ` · expires ${lot.expiresAt.toISOString()}` : " · no expiry",
              lot.meterKeys.length > 0 ? ` · meters ${lot.meterKeys.join(", ")}` : "",
              lot.source
                ? ` · source ${
                    resolveCreditOperationsReference(lot.source, grantedPermissions) ??
                    "Permission required"
                  }`
                : "",
            ),
          ),
        ),
  );
}

function createTransactions(
  transactions: readonly CreditOperationsTransaction[],
  grantedPermissions: readonly string[],
  selectedTransactionId: string | undefined,
  onSelectTransaction: CreditOperationsConsoleProps["onSelectTransaction"],
): ReactElement {
  return createElement(
    "section",
    { "aria-label": "Credit transaction timeline" },
    createElement("h2", null, "Transactions"),
    transactions.length === 0
      ? createElement("p", null, "No transactions match the current filters.")
      : createElement(
          "ol",
          null,
          transactions.map((transaction) =>
            createElement(
              "li",
              { key: transaction.id },
              createElement(
                "button",
                {
                  "aria-current": transaction.id === selectedTransactionId ? "true" : undefined,
                  onClick: () => onSelectTransaction?.(transaction.id),
                  type: "button",
                },
                `#${transaction.position} ${transaction.kind} ${transaction.amount}`,
              ),
              createElement(
                "span",
                null,
                ` · ${transaction.meterKey ?? "all meters"} · ${
                  resolveCreditOperationsReference(transaction.reference, grantedPermissions) ??
                  "Reference permission required"
                }`,
              ),
            ),
          ),
        ),
  );
}

function createTransactionDetail(
  transaction: CreditOperationsTransaction,
  snapshot: CreditOperationsSnapshot,
  grantedPermissions: readonly string[],
): ReactElement {
  return createElement(
    "section",
    { "aria-label": `Transaction ${transaction.id} details` },
    createElement("h3", null, `Transaction ${transaction.id}`),
    createElement(
      "p",
      null,
      `${transaction.kind} ${transaction.amount} at ${transaction.occurredAt.toISOString()}`,
    ),
    createElement(
      "p",
      null,
      `Reference: ${
        resolveCreditOperationsReference(transaction.reference, grantedPermissions) ??
        "Permission required"
      }`,
    ),
    transaction.reservationId
      ? createElement("p", null, `Reservation: ${transaction.reservationId}`)
      : null,
    transaction.relatedTransactionId
      ? createElement("p", null, `Related transaction: ${transaction.relatedTransactionId}`)
      : null,
    transaction.actorId ? createElement("p", null, `Actor: ${transaction.actorId}`) : null,
    transaction.correlationId
      ? createElement("p", null, `Correlation: ${transaction.correlationId}`)
      : null,
    createAllocationEvidence(transaction.allocations, snapshot),
  );
}

function createReservations(
  reservations: readonly CreditOperationsReservation[],
  selectedReservationId: string | undefined,
  onSelectReservation: CreditOperationsConsoleProps["onSelectReservation"],
): ReactElement {
  return createElement(
    "section",
    { "aria-label": "Credit reservations" },
    createElement("h2", null, "Reservations"),
    reservations.length === 0
      ? createElement("p", null, "No reservations match the current filters.")
      : createElement(
          "ul",
          null,
          reservations.map((reservation) =>
            createElement(
              "li",
              { key: reservation.id },
              createElement(
                "button",
                {
                  "aria-current": reservation.id === selectedReservationId ? "true" : undefined,
                  onClick: () => onSelectReservation?.(reservation.id),
                  type: "button",
                },
                `${reservation.id}: ${reservation.amount} ${reservation.status}`,
              ),
            ),
          ),
        ),
  );
}

function createReservationDetail(
  reservation: CreditOperationsReservation,
  snapshot: CreditOperationsSnapshot,
): ReactElement {
  return createElement(
    "section",
    { "aria-label": `Reservation ${reservation.id} details` },
    createElement("h3", null, `Reservation ${reservation.id}`),
    createElement(
      "p",
      null,
      `${reservation.status} · created ${reservation.createdAt.toISOString()}${
        reservation.settledAt ? ` · settled ${reservation.settledAt.toISOString()}` : ""
      }`,
    ),
    createAllocationEvidence(reservation.allocations, snapshot),
  );
}

function createAllocationEvidence(
  allocations: readonly { readonly grantTransactionId: string; readonly amount: string }[],
  snapshot: CreditOperationsSnapshot,
): ReactElement {
  return createElement(
    "ul",
    { "aria-label": "Grant allocation evidence" },
    allocations.length === 0
      ? createElement("li", null, "No grant allocations")
      : allocations.map((allocation) => {
          const grant = snapshot.grantLots.find(
            (candidate) => candidate.transactionId === allocation.grantTransactionId,
          );
          return createElement(
            "li",
            { key: `${allocation.grantTransactionId}:${allocation.amount}` },
            `${allocation.amount} funded by ${allocation.grantTransactionId}${
              grant?.expiresAt ? ` (expires ${grant.expiresAt.toISOString()})` : ""
            }`,
          );
        }),
  );
}

function createActions(
  actions: readonly CreditOperationsAction[],
  onAction: CreditOperationsConsoleProps["onAction"],
): ReactElement {
  return createElement(
    "section",
    { "aria-label": "Audited credit actions" },
    createElement("h2", null, "Actions"),
    createElement(
      "p",
      null,
      "Every write requires actor, reason, idempotency, and ledger position.",
    ),
    createElement(
      "ul",
      null,
      actions.map((action) =>
        createElement(
          "li",
          { key: `${action.kind}:${action.targetId}` },
          createElement(
            "button",
            {
              "data-action": action.kind,
              "data-target-id": action.targetId,
              disabled: !action.allowed || onAction === undefined,
              onClick: () => onAction?.(action),
              title: action.reason,
              type: "button",
            },
            actionLabel(action.kind),
          ),
        ),
      ),
    ),
  );
}

function actionLabel(kind: CreditOperationsAction["kind"]): string {
  switch (kind) {
    case "grant":
      return "Grant credits";
    case "refund":
      return "Refund consumption";
    case "release-reservation":
      return "Release reservation";
    case "adjustment":
      return "Compensating adjustment";
  }
}

function createProblemState(
  state: string,
  title: string,
  detail: string,
  onRefresh: CreditOperationsConsoleProps["onRefresh"],
): ReactElement {
  return createElement(
    "section",
    { "aria-label": "Tenant credit operations", "data-state": state, role: "alert" },
    createElement("h1", null, title),
    createElement("p", null, detail),
    onRefresh ? createElement("button", { onClick: onRefresh, type: "button" }, "Retry") : null,
  );
}
