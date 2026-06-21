import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  RetryConsoleAuditConfirmation,
  RetryConsoleDetailPanel,
  RetryConsoleFailedWorkList,
  RetryConsoleRetryButton,
} from "../index";
import type { RetryConsoleItem } from "../index";

function item(overrides: Partial<RetryConsoleItem> = {}): RetryConsoleItem {
  return {
    id: "exec-1",
    source: {
      kind: "task",
      label: "Task",
      target: "send-email",
    },
    state: "retryable",
    title: "send-email",
    retryable: true,
    problem: {
      code: "UPSTREAM_UNAVAILABLE",
      message: "Email provider unavailable",
      retryable: true,
    },
    attempts: {
      current: 1,
      max: 3,
    },
    timestamps: {
      createdAt: "2026-01-01T00:00:00.000Z",
      startedAt: "2026-01-01T00:00:01.000Z",
      completedAt: "2026-01-01T00:00:02.000Z",
    },
    correlationIds: {
      executionId: "exec-1",
      traceId: "trace-1",
    },
    recoveryActions: [
      {
        id: "retry",
        kind: "retry",
        label: "Retry",
        allowed: true,
        reason: "Execution can be retried with an audit log entry",
        permission: {
          action: "admin-ops:retry",
          resource: "task:exec-1",
          scope: "admin-ops:recovery",
        },
        requiresAudit: true,
        requiresIdempotencyKey: true,
      },
    ],
    ...overrides,
  };
}

describe("Retry Console React primitives", () => {
  it("renders failed work list state, source, and Problem code", () => {
    const html = renderToStaticMarkup(
      <RetryConsoleFailedWorkList items={[item()]} selectedItemId="exec-1" />,
    );

    expect(html).toContain('data-source="task"');
    expect(html).toContain('data-state="retryable"');
    expect(html).toContain("UPSTREAM_UNAVAILABLE");
  });

  it("renders detail panel with attempts, timestamps, and correlation ids", () => {
    const html = renderToStaticMarkup(<RetryConsoleDetailPanel item={item()} />);

    expect(html).toContain("1/3");
    expect(html).toContain("2026-01-01T00:00:02.000Z");
    expect(html).toContain("trace-1");
  });

  it("disables retry button when no retry or replay action is allowed", () => {
    const onRecover = vi.fn();
    const html = renderToStaticMarkup(
      <RetryConsoleRetryButton
        item={item({
          state: "non_retryable",
          retryable: false,
          recoveryActions: [
            {
              id: "inspect",
              kind: "inspect",
              label: "Inspect",
              allowed: true,
              reason: "Failure is non-retryable",
              permission: {
                action: "admin-ops:inspect",
                resource: "task:exec-1",
              },
              requiresAudit: false,
              requiresIdempotencyKey: false,
            },
          ],
        })}
        onRecover={onRecover}
      />,
    );

    expect(html).toContain("disabled");
    expect(onRecover).not.toHaveBeenCalled();
  });

  it("renders audit confirmation with actor, reason, and idempotency key", () => {
    const html = renderToStaticMarkup(
      <RetryConsoleAuditConfirmation
        item={item()}
        audit={{
          actorId: "ops-user-1",
          reason: "Retry after provider recovered",
          idempotencyKey: "ops-retry-1",
        }}
        onConfirm={() => {}}
      />,
    );

    expect(html).toContain("ops-user-1");
    expect(html).toContain("Retry after provider recovered");
    expect(html).toContain("ops-retry-1");
  });
});
