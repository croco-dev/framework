import { createElement, type ReactElement, type ReactNode } from "react";
import type {
  RetryConsoleAuditDescriptor,
  RetryConsoleItem,
  RetryConsoleRecoveryAction,
} from "./types";

export type RetryConsoleFailedWorkListProps = {
  readonly items: readonly RetryConsoleItem[];
  readonly selectedItemId?: string;
  readonly onSelect?: (item: RetryConsoleItem) => void;
};

export type RetryConsoleDetailPanelProps = {
  readonly item: RetryConsoleItem;
  readonly actions?: ReactNode;
};

export type RetryConsoleRetryButtonProps = {
  readonly item: RetryConsoleItem;
  readonly onRecover: (action: RetryConsoleRecoveryAction, item: RetryConsoleItem) => void;
  readonly disabled?: boolean;
};

export type RetryConsoleAuditConfirmationProps = {
  readonly item: RetryConsoleItem;
  readonly audit: RetryConsoleAuditDescriptor;
  readonly onConfirm: (audit: RetryConsoleAuditDescriptor, item: RetryConsoleItem) => void;
};

function firstAllowedRecoveryAction(
  item: RetryConsoleItem,
): RetryConsoleRecoveryAction | undefined {
  return item.recoveryActions.find(
    (action) => action.allowed && (action.kind === "retry" || action.kind === "replay"),
  );
}

function field(label: string, value: ReactNode): ReactElement {
  return createElement(
    "div",
    { className: "croco-retry-console-field" },
    createElement("dt", null, label),
    createElement("dd", null, value),
  );
}

function timestampRows(item: RetryConsoleItem): ReactElement[] {
  return Object.entries(item.timestamps)
    .filter(([, value]) => value !== undefined)
    .map(([label, value]) => field(label, value));
}

function correlationRows(item: RetryConsoleItem): ReactElement[] {
  return Object.entries(item.correlationIds)
    .filter(([, value]) => value !== undefined)
    .map(([label, value]) => field(label, value));
}

export function RetryConsoleFailedWorkList({
  items,
  selectedItemId,
  onSelect,
}: RetryConsoleFailedWorkListProps): ReactElement {
  return createElement(
    "ul",
    { className: "croco-retry-console-list" },
    items.map((item) =>
      createElement(
        "li",
        {
          key: item.id,
          "data-source": item.source.kind,
          "data-state": item.state,
          "aria-selected": item.id === selectedItemId,
        },
        createElement(
          "button",
          {
            type: "button",
            onClick: () => onSelect?.(item),
          },
          createElement("span", { className: "croco-retry-console-item-title" }, item.title),
          createElement("span", { className: "croco-retry-console-item-state" }, item.state),
          item.problem
            ? createElement(
                "span",
                { className: "croco-retry-console-item-problem" },
                item.problem.code,
              )
            : null,
        ),
      ),
    ),
  );
}

export function RetryConsoleNonRetryableExplanation({
  item,
}: {
  readonly item: RetryConsoleItem;
}): ReactElement {
  const problem = item.problem;
  return createElement(
    "p",
    { className: "croco-retry-console-non-retryable", role: "note" },
    problem
      ? `${problem.code}: ${problem.message}`
      : "This item is not retryable from the admin console.",
  );
}

export function RetryConsoleRetryButton({
  item,
  onRecover,
  disabled,
}: RetryConsoleRetryButtonProps): ReactElement {
  const action = firstAllowedRecoveryAction(item);

  return createElement(
    "button",
    {
      type: "button",
      disabled: disabled || action === undefined,
      onClick: () => {
        if (action) {
          onRecover(action, item);
        }
      },
    },
    action?.label ?? "Unavailable",
  );
}

export function RetryConsoleDetailPanel({
  item,
  actions,
}: RetryConsoleDetailPanelProps): ReactElement {
  return createElement(
    "section",
    {
      className: "croco-retry-console-detail",
      "data-source": item.source.kind,
      "data-state": item.state,
    },
    createElement("h2", null, item.title),
    createElement(
      "dl",
      null,
      field("state", item.state),
      field("source", item.source.label),
      field(
        "attempts",
        item.attempts.max === undefined
          ? String(item.attempts.current)
          : `${item.attempts.current}/${item.attempts.max}`,
      ),
      item.problem ? field("problem", `${item.problem.code}: ${item.problem.message}`) : null,
      ...timestampRows(item),
      ...correlationRows(item),
    ),
    item.state === "non_retryable"
      ? createElement(RetryConsoleNonRetryableExplanation, { item })
      : null,
    actions ?? createElement(RetryConsoleRetryButton, { item, onRecover: () => {} }),
  );
}

export function RetryConsoleAuditConfirmation({
  item,
  audit,
  onConfirm,
}: RetryConsoleAuditConfirmationProps): ReactElement {
  return createElement(
    "section",
    { className: "croco-retry-console-audit-confirmation" },
    createElement("h3", null, "Confirm recovery"),
    createElement(
      "dl",
      null,
      field("item", item.id),
      field("actor", audit.actorId),
      field("reason", audit.reason),
      field("idempotencyKey", audit.idempotencyKey),
      audit.ticketId ? field("ticket", audit.ticketId) : null,
    ),
    createElement(
      "button",
      {
        type: "button",
        onClick: () => onConfirm(audit, item),
      },
      "Confirm",
    ),
  );
}
