import { describe, expect, it, vi } from "vitest";
import { Cron } from "@croco/triggers-core";
import { QStashTriggerHandler } from "@croco/triggers-qstash";
import { InMemoryPolicyReleaseStore, PolicyReleaseService } from "@croco/features-core";
import type {
  QStashTriggerHandlerOptions,
  QStashWebhookPayload,
  QStashTriggerExecutionContext,
} from "@croco/triggers-qstash";
import type { Execution, ExecutionManager } from "@croco/execution-core";
import {
  ScheduledPolicyPublisher,
  type PolicyCommandReceipt,
  type PolicyRevision,
  type PolicyPublishCommand,
  type PolicyScheduleLookup,
  type PolicyScheduleRecord,
} from "../index";

const scope = { app: "banner", environment: "test", tenantId: "tenant-1" } as const;
const command: PolicyPublishCommand<{ message: string }> = {
  policyId: "banner-copy",
  scope,
  expectedRevision: 3,
  reviewHash: "sha256:review",
  actor: { id: "operator" },
  reason: "Launch reviewed copy",
  idempotencyKey: "publish-3",
  effectiveAt: "2026-09-29T12:00:00.000Z",
  value: { message: "Hello" },
};

const receipt: PolicyCommandReceipt = {
  id: "receipt-3",
  policyId: command.policyId,
  scope,
  revision: 3,
  version: 3,
  hash: "sha256:value",
  status: "published",
  idempotencyKey: command.idempotencyKey,
  commandFingerprint: "sha256:command",
  effectiveAt: command.effectiveAt as string,
  recordedAt: "2026-09-29T12:00:01.000Z",
};

function createSchedule(state: PolicyScheduleRecord["state"] = "pending"): PolicyScheduleRecord {
  return {
    id: "policy-schedule:one",
    policyId: command.policyId,
    scope,
    revision: command.expectedRevision,
    reviewHash: command.reviewHash,
    effectiveAt: command.effectiveAt as string,
    idempotencyKey: command.idempotencyKey,
    state,
    metadata: { command },
    createdAt: "2026-09-29T11:00:00.000Z",
    updatedAt: "2026-09-29T11:00:00.000Z",
  };
}

function createExecutionManager(): ExecutionManager & { executions: Map<string, Execution> } {
  const executions = new Map<string, Execution>();
  const manager = {
    executions,
    create: vi.fn(async (params: { idempotencyKey?: string }) => {
      const id = `execution-${executions.size + 1}`;
      const existing = [...executions.values()].find(
        (candidate) => candidate.idempotencyKey === params.idempotencyKey,
      );
      if (existing) return existing;
      const created = {
        id,
        type: "features.policy.publish",
        status: "pending",
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date("2026-09-29T11:00:00.000Z"),
        payload: undefined,
        result: undefined,
        error: undefined,
        startedAt: undefined,
        completedAt: undefined,
        timeout: undefined,
        scheduledFor: new Date(command.effectiveAt as string),
        idempotencyKey: params.idempotencyKey,
        replayOf: undefined,
        logs: [],
        parentId: undefined,
        metadata: undefined,
        checkpoints: {},
        progress: undefined,
        continuation: undefined,
      } as unknown as Execution;
      executions.set(id, created);
      return created;
    }),
    get: vi.fn(async (id: string) => executions.get(id)),
    start: vi.fn(async (id: string) => {
      const current = executions.get(id);
      if (!current) throw new Error("missing execution");
      const started = {
        ...current,
        status: "running",
        attempts: current.attempts + 1,
      } as Execution;
      executions.set(id, started);
      return started;
    }),
    complete: vi.fn(async (id: string, result?: unknown) => {
      const current = executions.get(id);
      if (!current) throw new Error("missing execution");
      const completed = { ...current, status: "completed", result } as Execution;
      executions.set(id, completed);
      return completed;
    }),
    fail: vi.fn(async (id: string) => {
      const current = executions.get(id);
      if (!current) throw new Error("missing execution");
      const failed = { ...current, status: "failed" } as Execution;
      executions.set(id, failed);
      return failed;
    }),
    retry: vi.fn(async (id: string) => {
      const current = executions.get(id);
      if (!current) throw new Error("missing execution");
      const retrying = { ...current, status: "retrying" } as Execution;
      executions.set(id, retrying);
      return retrying;
    }),
  } as unknown as ExecutionManager & { executions: Map<string, Execution> };
  return manager;
}

function createStore(): PolicyScheduleLookup<{ message: string }> & {
  scheduleRecord: PolicyScheduleRecord;
} {
  let scheduleRecord = createSchedule();
  return {
    get scheduleRecord() {
      return scheduleRecord;
    },
    findCommandReceipt: vi.fn(async () => receipt),
    schedule: vi.fn(async () => scheduleRecord),
    getSchedule: vi.fn(async () => scheduleRecord),
    attachScheduleExecution: vi.fn(async (id: string, executionId: string, triggerId?: string) => {
      scheduleRecord = { ...scheduleRecord, id, executionId, ...(triggerId ? { triggerId } : {}) };
      return scheduleRecord;
    }),
    listDueSchedules: vi.fn(async () => [scheduleRecord]),
    claimSchedule: vi.fn(async () => {
      if (scheduleRecord.state !== "pending") return null;
      scheduleRecord = { ...scheduleRecord, state: "claimed" };
      return scheduleRecord;
    }),
    completeSchedule: vi.fn(async () => {
      scheduleRecord = { ...scheduleRecord, state: "completed" };
      return scheduleRecord;
    }),
    failSchedule: vi.fn(async (_id: string, _now: Date, lastError: string) => {
      scheduleRecord = { ...scheduleRecord, state: "failed", lastError };
      return scheduleRecord;
    }),
    cancelSchedule: vi.fn(async () => {
      scheduleRecord = { ...scheduleRecord, state: "cancelled" };
      return scheduleRecord;
    }),
  } as unknown as PolicyScheduleLookup<{ message: string }> & {
    scheduleRecord: PolicyScheduleRecord;
  };
}

describe("ScheduledPolicyPublisher", () => {
  it("delivers a real service schedule through the store and reconciles redelivery", async () => {
    let now = new Date("2026-09-29T11:00:00.000Z");
    const store = new InMemoryPolicyReleaseStore<{ message: string }>();
    const service = new PolicyReleaseService({ store, clock: { now: () => now } });
    service.registerPolicy<{ message: string }>({
      id: command.policyId,
      schemaVersion: "1",
      codeRegistrationId: "banner-copy-v1",
      schema: {
        version: "1",
        validate: (value) => typeof value === "object" && value !== null && "message" in value,
      },
      fieldDescriptors: [],
      evaluate: (value) => value,
    });
    const target = {
      policyId: command.policyId,
      scope,
      actor: command.actor,
      reason: command.reason,
    };
    const draft = await service.createDraft({ ...target, value: { message: "Hello" } });
    const review = await service.review({ ...target, expectedRevision: draft.revision });
    const executionManager = createExecutionManager();
    const publisher = new ScheduledPolicyPublisher({
      store,
      executionManager,
      publish: (input) => service.publish<{ message: string }>(input),
      now: () => now,
    });
    const scheduled = await publisher.schedule({
      ...command,
      expectedRevision: review.revision,
      reviewHash: review.hash,
    });
    now = new Date("2026-09-29T12:01:00.000Z");
    const restored = new ScheduledPolicyPublisher({
      store,
      executionManager,
      publish: (input) => service.publish<{ message: string }>(input),
      now: () => now,
    });
    expect(await restored.recoverDue()).toHaveLength(1);
    const delivered = await restored.handleVerifiedDelivery({
      scheduleId: scheduled.id,
      deliveryId: "verified-message",
    });
    expect(delivered.state).toBe("completed");
    expect(delivered.receipt?.status).toBe("published");
    expect(await service.resolve(target)).toMatchObject({
      status: "active",
      value: { message: "Hello" },
    });
    expect(
      await restored.handleVerifiedDelivery({
        scheduleId: scheduled.id,
        deliveryId: "verified-replay",
      }),
    ).toMatchObject({ state: "duplicate" });
    expect(executionManager.executions.size).toBe(1);
  });
  it("publishes through an existing authenticated QStash cron trigger", async () => {
    const store = createStore();
    const executionManager = createExecutionManager();
    const publish = vi.fn(
      async () => ({ state: "published" }) as PolicyRevision<{ message: string }>,
    );
    const publisher = new ScheduledPolicyPublisher({ store, executionManager, publish });
    class PolicyDelivery {
      async deliver(payload: QStashWebhookPayload, context: QStashTriggerExecutionContext) {
        return publisher.handleVerifiedDelivery({
          scheduleId: payload.scheduleId,
          deliveryId: context.executionId,
        });
      }
    }
    const descriptor = Object.getOwnPropertyDescriptor(PolicyDelivery.prototype, "deliver");
    if (!descriptor) throw new Error("missing test handler");
    Cron("* * * * *", { name: "policy-release-test" })(
      PolicyDelivery.prototype,
      "deliver",
      descriptor,
    );
    const verify = vi.fn(async () => true);
    const deliveryIdentityVerifier = vi.fn(async () => false);
    const handler = new QStashTriggerHandler({
      receiver: { verify } as unknown as QStashTriggerHandlerOptions["receiver"],
      deliveryIdentityVerifier,
      executionManager,
      executionTimeout: 60_000,
      serviceResolver: () => new PolicyDelivery(),
    });
    const body = JSON.stringify({
      scheduleId: store.scheduleRecord.id,
      className: "PolicyDelivery",
      methodName: "deliver",
      triggerName: "policy-release-test",
      cronExpression: "* * * * *",
      timestamp: command.effectiveAt,
    });
    expect((await handler.handle(body, "signature", { messageId: "unverified" })).success).toBe(
      false,
    );
    expect(publish).not.toHaveBeenCalled();
    deliveryIdentityVerifier.mockResolvedValue(true);
    expect((await handler.handle(body, "signature", { messageId: "verified" })).success).toBe(true);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledTimes(2);
    expect(store.scheduleRecord.state).toBe("completed");
  });

  it("claims a verified delivery once and returns the receipt for duplicate deliveries", async () => {
    const store = createStore();
    const executionManager = createExecutionManager();
    const publish = vi.fn(
      async () =>
        ({ ...receipt, state: "published" }) as unknown as PolicyRevision<{ message: string }>,
    );
    const publisher = new ScheduledPolicyPublisher({
      store,
      executionManager,
      publish,
      now: () => new Date("2026-09-29T12:00:00.000Z"),
    });

    const first = await publisher.handleVerifiedDelivery({
      scheduleId: store.scheduleRecord.id,
      deliveryId: "delivery-1",
    });
    const second = await publisher.handleVerifiedDelivery({
      scheduleId: store.scheduleRecord.id,
      deliveryId: "delivery-2",
    });

    expect(first.state).toBe("completed");
    expect(second.state).toBe("duplicate");
    expect(second.receipt).toEqual(receipt);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(executionManager.create).toHaveBeenCalledTimes(1);
  });

  it("does not publish when its execution was cancelled", async () => {
    const store = createStore();
    const executionManager = createExecutionManager();
    const execution = await executionManager.create({ type: "features.policy.publish" });
    vi.mocked(executionManager.create).mockResolvedValue({ ...execution, status: "cancelled" });
    const publish = vi.fn();
    const publisher = new ScheduledPolicyPublisher({ store, executionManager, publish });
    await expect(
      publisher.handleVerifiedDelivery({
        scheduleId: store.scheduleRecord.id,
        deliveryId: "cancelled",
      }),
    ).rejects.toMatchObject({ code: "features/policy/invalid-schedule" });
    expect(publish).not.toHaveBeenCalled();
    expect(store.scheduleRecord.state).toBe("cancelled");
  });

  it("reconciles an execution completed before the schedule completion write", async () => {
    const store = createStore();
    const executionManager = createExecutionManager();
    const publish = vi.fn(
      async () => ({ state: "published" }) as PolicyRevision<{ message: string }>,
    );
    vi.mocked(store.completeSchedule).mockRejectedValueOnce(new Error("connection lost"));
    const publisher = new ScheduledPolicyPublisher({ store, executionManager, publish });
    await expect(
      publisher.handleVerifiedDelivery({
        scheduleId: store.scheduleRecord.id,
        deliveryId: "first",
      }),
    ).rejects.toThrow("connection lost");
    vi.mocked(store.claimSchedule).mockResolvedValueOnce({
      ...store.scheduleRecord,
      state: "claimed",
    });
    const restored = new ScheduledPolicyPublisher({ store, executionManager, publish });
    const result = await restored.handleVerifiedDelivery({
      scheduleId: store.scheduleRecord.id,
      deliveryId: "retry",
    });
    expect(result.receipt).toEqual(receipt);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(executionManager.complete).toHaveBeenCalledTimes(1);
    expect(executionManager.fail).not.toHaveBeenCalled();
  });

  it("rejects a persisted command whose scope differs from the scheduled scope", async () => {
    const store = createStore();
    vi.mocked(store.claimSchedule).mockResolvedValueOnce({
      ...createSchedule(),
      metadata: {
        command: { ...command, scope: { ...scope, tenantId: "other" } },
      },
    });
    const publish = vi.fn();
    const publisher = new ScheduledPolicyPublisher({
      store,
      executionManager: createExecutionManager(),
      publish,
    });
    await expect(
      publisher.handleVerifiedDelivery({ scheduleId: store.scheduleRecord.id, deliveryId: "bad" }),
    ).rejects.toMatchObject({ code: "features/policy/invalid-schedule" });
    expect(publish).not.toHaveBeenCalled();
  });

  it("runs the core schedule command before dispatching its durable delivery", async () => {
    const store = createStore();
    const publish = vi.fn(
      async () => ({ revision: 4, state: "scheduled" }) as PolicyRevision<{ message: string }>,
    );
    const dispatch = vi.fn(async () => ({ triggerId: "trigger" }));
    const publisher = new ScheduledPolicyPublisher({
      store,
      executionManager: createExecutionManager(),
      publish,
      triggerDispatcher: { dispatch },
    });
    await publisher.schedule(command);
    expect(publish).toHaveBeenCalledWith(command);
    expect(store.schedule).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("reuses the execution idempotency key when recovering a due schedule", async () => {
    const store = createStore();
    const executionManager = createExecutionManager();
    const dispatch = vi.fn(async () => ({ triggerId: "trigger-1", messageId: "message-1" }));
    const publisher = new ScheduledPolicyPublisher({
      store,
      executionManager,
      publish: vi.fn(
        async () =>
          ({ ...receipt, state: "published" }) as unknown as PolicyRevision<{ message: string }>,
      ),
      triggerDispatcher: { dispatch },
      now: () => new Date("2026-09-29T12:00:00.000Z"),
    });

    const recovered = await publisher.recoverDue(new Date("2026-09-29T12:00:00.000Z"));

    expect(recovered).toHaveLength(1);
    await publisher.recoverDue(new Date("2026-09-29T12:01:00.000Z"));
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(executionManager.executions.size).toBe(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "features.policy.publish",
        scheduleId: store.scheduleRecord.id,
      }),
      expect.objectContaining({ delayMs: 0 }),
    );
    expect(executionManager.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "features.policy.publish",
        idempotencyKey: expect.stringContaining("features-policy-publish:"),
      }),
    );
  });
});
