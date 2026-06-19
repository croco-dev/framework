import { describe, expect, it } from "vitest";
import {
  collectOperationsTimeline,
  createOperationsTimeline,
  createOperationsTimelineRows,
  InMemoryOperationsTimelineSourceAdapter,
  normalizeAuditLogEntry,
  normalizeDomainEvent,
  normalizeLifecycleRun,
  normalizeTaskFailureExecution,
  normalizeWorkflowExecution,
} from "../index";

describe("admin operations timeline", () => {
  it("normalizes audit, domain event, and task failure sources into one ordered model", () => {
    const audit = normalizeAuditLogEntry({
      id: "audit-1",
      tenantId: "tenant-1",
      actorId: "user-1",
      action: "order.approved",
      resourceType: "order",
      resourceId: "order-1",
      payload: { approvalId: "approval-1" },
      diff: { status: ["pending", "approved"] },
      metadata: {
        correlationId: "corr-1",
        customerId: "customer-1",
        recoveryAction: "Review approval policy.",
      },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      sequence: 7,
      integrityHash: "hash-1",
    });
    const domainEvent = normalizeDomainEvent({
      eventId: "event-1",
      eventName: "OrderPaymentFailed",
      timestamp: new Date("2026-01-01T00:01:00.000Z"),
      aggregateId: "order-1",
      payload: { paymentId: "payment-1" },
      metadata: {
        tenantId: "tenant-1",
        customerId: "customer-1",
        entityType: "order",
        problem: {
          code: "billing/payment-failed",
          message: "Card was declined",
          retryable: true,
        },
        retry: {
          attempt: 2,
          maxAttempts: 3,
          retryable: true,
        },
        traceContext: {
          traceId: "trace-1",
        },
      },
    });
    const task = normalizeTaskFailureExecution({
      id: "execution-1",
      type: "charge-card",
      status: "failed",
      error: {
        code: "tasks-core/payment-provider-timeout",
        message: "Payment provider timed out",
        retryable: true,
        stack: "stack",
      },
      attempts: 2,
      maxAttempts: 3,
      createdAt: new Date("2026-01-01T00:00:30.000Z"),
      completedAt: new Date("2026-01-01T00:02:00.000Z"),
      metadata: {
        tenantId: "tenant-1",
        customerId: "customer-1",
        correlationId: "corr-1",
        entity: {
          type: "order",
          id: "order-1",
        },
      },
    });

    const timeline = createOperationsTimeline([task, domainEvent, audit]);

    expect(timeline.map((event) => event.id)).toEqual([
      "audit:audit-1",
      "domain-event:event-1",
      "task:execution-1",
    ]);
    expect(domainEvent.problem).toMatchObject({
      code: "billing/payment-failed",
      retryable: true,
    });
    expect(task.retry).toEqual({
      attempt: 2,
      maxAttempts: 3,
      retryable: true,
    });
    expect(audit.extension.entry.integrityHash).toBe("hash-1");
    expect(domainEvent.extension.event.payload).toEqual({ paymentId: "payment-1" });
    expect(task.extension.execution.error?.stack).toBe("stack");
  });

  it("filters by tenant and entity across mixed sources", () => {
    const matchingAudit = normalizeAuditLogEntry({
      id: "audit-1",
      tenantId: "tenant-1",
      actorId: "user-1",
      action: "order.updated",
      resourceType: "order",
      resourceId: "order-1",
      payload: {},
      diff: null,
      metadata: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const otherTenantAudit = normalizeAuditLogEntry({
      id: "audit-2",
      tenantId: "tenant-2",
      actorId: "user-2",
      action: "order.updated",
      resourceType: "order",
      resourceId: "order-1",
      payload: {},
      diff: null,
      metadata: {},
      createdAt: "2026-01-01T00:01:00.000Z",
    });
    const matchingTask = normalizeTaskFailureExecution({
      id: "execution-1",
      type: "sync-order",
      status: "failed",
      error: {
        message: "Sync failed",
        retryable: false,
      },
      createdAt: "2026-01-01T00:02:00.000Z",
      metadata: {
        tenantId: "tenant-1",
        entity: {
          type: "order",
          id: "order-1",
        },
      },
    });

    const timeline = createOperationsTimeline([matchingAudit, otherTenantAudit, matchingTask], {
      tenantId: "tenant-1",
      entity: {
        type: "order",
        id: "order-1",
      },
    });

    expect(timeline.map((event) => event.id)).toEqual(["audit:audit-1", "task:execution-1"]);
  });

  it("renders mixed source rows with source badges, problem codes, and recovery actions", () => {
    const workflow = normalizeWorkflowExecution({
      id: "workflow-1",
      workflow: "billing-recovery",
      status: "failed",
      createdAt: "2026-01-01T00:00:00.000Z",
      completedAt: "2026-01-01T00:03:00.000Z",
      error: {
        code: "workflow-core/step-failed",
        message: "Step failed",
        retryable: true,
      },
      metadata: {
        tenantId: "tenant-1",
      },
    });
    const lifecycle = normalizeLifecycleRun({
      id: "lifecycle-1",
      ruleId: "past-due-recovery",
      tenantId: "tenant-1",
      signalType: "billing.subscription.updated",
      signalId: "signal-1",
      severity: "critical",
      status: "failed",
      actionResults: [
        {
          actionId: "notify-cs",
          type: "notification",
          status: "failure",
          error: {
            code: "notifications/send-failed",
            message: "Unable to send notification",
          },
        },
      ],
      error: {
        code: "lifecycle-core/action-failed",
        message: "Action failed",
      },
      startedAt: "2026-01-01T00:04:00.000Z",
      completedAt: "2026-01-01T00:05:00.000Z",
    });

    const rows = createOperationsTimelineRows([lifecycle, workflow], {
      order: "desc",
    });

    expect(rows.map((row) => row.badge)).toEqual(["Lifecycle", "Workflow"]);
    expect(rows[0]).toMatchObject({
      problemCode: "lifecycle-core/action-failed",
      recoveryAction: "Inspect lifecycle run 'lifecycle-1' and failed action results.",
      subtitle: "tenant tenant-1 · lifecycle-rule/past-due-recovery · lifecycle-core/action-failed",
    });
    expect(lifecycle.extension.run.actionResults[0]?.error?.code).toBe("notifications/send-failed");
  });

  it("collects and re-sorts events from source adapters", async () => {
    const audit = normalizeAuditLogEntry({
      id: "audit-1",
      tenantId: "tenant-1",
      actorId: "user-1",
      action: "tenant.updated",
      resourceType: "tenant",
      resourceId: "tenant-1",
      payload: {},
      diff: null,
      metadata: {},
      createdAt: "2026-01-01T00:02:00.000Z",
    });
    const event = normalizeDomainEvent({
      eventId: "event-1",
      eventName: "TenantCreated",
      timestamp: "2026-01-01T00:01:00.000Z",
      metadata: {
        tenantId: "tenant-1",
        entityType: "tenant",
        entityId: "tenant-1",
      },
    });
    const adapters = [
      new InMemoryOperationsTimelineSourceAdapter("audit", [audit]),
      new InMemoryOperationsTimelineSourceAdapter("domain-event", [event]),
    ];

    const timeline = await collectOperationsTimeline(adapters, {
      tenantId: "tenant-1",
      order: "asc",
    });

    expect(timeline.map((item) => item.id)).toEqual(["domain-event:event-1", "audit:audit-1"]);
  });
});
