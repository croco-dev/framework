import type { Execution, ExecutionManager } from "@croco/execution-core";
import { PolicyScheduleProblem } from "./problems";
import {
  policyScheduleId,
  type PolicyCommandReceipt,
  type PolicyRevision,
  type PolicyPublishCommand,
  type PolicyScheduleLookup,
  type PolicyScheduleDelivery,
  type PolicyScheduleRecord,
  policyScopeKey,
} from "./contracts";

export type PolicyTriggerDispatcher = Readonly<{
  dispatch(
    payload: PolicyScheduleDeliveryPayload,
    options: Readonly<{ delayMs: number; idempotencyKey: string }>,
  ): Promise<Readonly<{ triggerId?: string; messageId?: string }>>;
}>;

export type PolicyScheduleDeliveryPayload = Readonly<{
  kind: "features.policy.publish";
  scheduleId: string;
  policyId: string;
  scope: PolicyPublishCommand["scope"];
  revision: number;
  reviewHash: string;
  effectiveAt: string;
  idempotencyKey: string;
}>;

export type ScheduledPolicyPublisherOptions<TValue = unknown> = Readonly<{
  store: PolicyScheduleLookup<TValue>;
  executionManager: ExecutionManager;
  publish(command: PolicyPublishCommand<TValue>): Promise<PolicyRevision<TValue>>;
  triggerDispatcher?: PolicyTriggerDispatcher;
  workerId?: string;
  leaseMs?: number;
  now?: () => Date;
}>;

export type RecoverDueSchedulesResult = Readonly<{
  schedule: PolicyScheduleRecord;
  executionId: string;
  triggerId?: string;
}>;

/**
 * Connects durable policy schedules to Croco executions and a verified trigger delivery.
 *
 * `schedule` writes the schedule before dispatching a trigger. A QStash/task adapter can
 * implement `PolicyTriggerDispatcher`; its verified webhook must call `handleVerifiedDelivery`.
 * `recoverDue` is safe after process restart because the schedule row and execution idempotency
 * key are durable. `handleVerifiedDelivery` claims the row before calling the core publisher,
 * and the publisher's command receipt is the final duplicate guard.
 */
export class ScheduledPolicyPublisher<TValue = unknown> {
  private readonly workerId: string;
  private readonly leaseMs: number;
  private readonly now: () => Date;

  constructor(private readonly options: ScheduledPolicyPublisherOptions<TValue>) {
    this.workerId = options.workerId ?? `features-policy-worker:${process.pid}`;
    this.leaseMs = options.leaseMs ?? 60_000;
    this.now = options.now ?? (() => new Date());
    if (!Number.isSafeInteger(this.leaseMs) || this.leaseMs <= 0) {
      throw new PolicyScheduleProblem("configuration", "leaseMs must be a positive safe integer");
    }
  }

  async schedule(command: PolicyPublishCommand<TValue>): Promise<PolicyScheduleRecord> {
    if (!command.effectiveAt) {
      throw new PolicyScheduleProblem(command.policyId, "effectiveAt is required");
    }
    const revision = await this.options.publish(command);
    if (revision.state !== "scheduled") {
      throw new PolicyScheduleProblem(
        command.policyId,
        "publication did not create a scheduled revision",
      );
    }
    const scheduleId = policyScheduleId({
      policyId: command.policyId,
      scope: command.scope,
      revision: revision.revision,
      reviewHash: command.reviewHash,
      effectiveAt: command.effectiveAt,
      idempotencyKey: `${command.idempotencyKey}:publish`,
    });
    const schedule = await this.options.store.getSchedule(scheduleId);
    if (!schedule)
      throw new PolicyScheduleProblem(
        command.policyId,
        "scheduled revision has no durable delivery",
      );
    const execution = await this.ensureExecution(schedule);
    let current = await this.options.store.attachScheduleExecution(schedule.id, execution.id);
    if (this.options.triggerDispatcher && !current.triggerId) {
      const dispatched = await this.options.triggerDispatcher.dispatch(this.payload(current), {
        delayMs: Math.max(0, new Date(current.effectiveAt).getTime() - this.now().getTime()),
        idempotencyKey: this.executionKey(current),
      });
      current = await this.options.store.attachScheduleExecution(
        current.id,
        execution.id,
        dispatched.triggerId,
      );
    }
    return current;
  }

  /** Re-enqueues due rows after restart; it does not call the core publisher directly. */
  async recoverDue(now = this.now(), limit = 100): Promise<readonly RecoverDueSchedulesResult[]> {
    const due = await this.options.store.listDueSchedules(now, limit);
    const recovered: RecoverDueSchedulesResult[] = [];
    for (const schedule of due) {
      const execution = await this.ensureExecution(schedule);
      let current = await this.options.store.attachScheduleExecution(schedule.id, execution.id);
      if (this.options.triggerDispatcher) {
        const dispatched = await this.options.triggerDispatcher.dispatch(this.payload(current), {
          delayMs: 0,
          idempotencyKey: `${this.executionKey(current)}:recovery:${schedule.updatedAt}`,
        });
        current = await this.options.store.attachScheduleExecution(
          current.id,
          execution.id,
          dispatched.triggerId,
        );
      }
      recovered.push({
        schedule: current,
        executionId: execution.id,
        ...(current.triggerId ? { triggerId: current.triggerId } : {}),
      });
    }
    return recovered;
  }

  /**
   * Entry point for a trigger handler after provider signature and message identity verification.
   * The schedule claim and command receipt make duplicate deliveries and lease takeovers safe.
   */
  async handleVerifiedDelivery(delivery: PolicyScheduleDelivery): Promise<{
    state: "completed" | "duplicate";
    schedule: PolicyScheduleRecord;
    receipt?: PolicyCommandReceipt;
    executionId?: string;
  }> {
    const receivedAt = delivery.receivedAt ?? this.now();
    const existing = await this.options.store.getSchedule(delivery.scheduleId);
    if (!existing) throw new PolicyScheduleProblem(delivery.scheduleId, "schedule was not found");
    const claimed = await this.options.store.claimSchedule(
      delivery.scheduleId,
      this.workerId,
      receivedAt,
      this.leaseMs,
    );
    if (!claimed) {
      if (
        new Date(existing.effectiveAt) > receivedAt &&
        existing.state !== "cancelled" &&
        existing.state !== "completed"
      ) {
        throw new PolicyScheduleProblem(existing.policyId, "scheduled effectiveAt has not arrived");
      }
      const receipt =
        existing.state === "completed"
          ? await this.requireReceipt(this.commandFromSchedule(existing))
          : undefined;
      return {
        state: "duplicate",
        schedule: existing,
        ...(receipt ? { receipt } : {}),
        ...(existing.executionId ? { executionId: existing.executionId } : {}),
      };
    }
    const command = this.commandFromSchedule(claimed);
    const execution = await this.ensureExecution(claimed);
    if (execution.status === "completed") {
      const receipt = await this.requireReceipt(command);
      const completed = await this.options.store.completeSchedule(claimed.id, this.now());
      return { state: "completed", schedule: completed, receipt, executionId: execution.id };
    }
    if (execution.status === "cancelled") {
      await this.options.store.cancelSchedule(claimed.id, this.now(), "Execution was cancelled");
      throw new PolicyScheduleProblem(claimed.policyId, "execution was cancelled");
    }
    await this.startIfNeeded(execution);
    let receipt: PolicyCommandReceipt;
    try {
      await this.options.publish(command);
      receipt = await this.requireReceipt(command);
      await this.options.executionManager.complete(execution.id, receipt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.options.executionManager.fail(execution.id, {
        message,
        code: "features/policy/scheduled-publish-failed",
        retryable: true,
      });
      await this.options.store.failSchedule(claimed.id, this.now(), message);
      throw error;
    }
    const completed = await this.options.store.completeSchedule(claimed.id, this.now());
    return { state: "completed", schedule: completed, receipt, executionId: execution.id };
  }

  private async requireReceipt(
    command: PolicyPublishCommand<TValue>,
  ): Promise<PolicyCommandReceipt> {
    const receipt = await this.options.store.findCommandReceipt(
      command.scope,
      command.policyId,
      command.idempotencyKey,
    );
    if (!receipt)
      throw new PolicyScheduleProblem(
        command.policyId,
        "published command receipt was not persisted",
      );
    return receipt;
  }

  private payload(schedule: PolicyScheduleRecord): PolicyScheduleDeliveryPayload {
    const command = this.commandFromSchedule(schedule);
    return {
      kind: "features.policy.publish",
      scheduleId: schedule.id,
      policyId: schedule.policyId,
      scope: command.scope,
      revision: schedule.revision,
      reviewHash: schedule.reviewHash,
      effectiveAt: schedule.effectiveAt,
      idempotencyKey: schedule.idempotencyKey,
    };
  }

  private commandFromSchedule(schedule: PolicyScheduleRecord): PolicyPublishCommand<TValue> {
    const candidate = schedule.metadata?.command;
    if (typeof candidate !== "object" || candidate === null) {
      throw new PolicyScheduleProblem(schedule.id, "persisted publish command is missing");
    }
    const command = candidate as PolicyPublishCommand<TValue>;
    if (
      command.policyId !== schedule.policyId ||
      command.idempotencyKey !== schedule.idempotencyKey ||
      command.expectedRevision !== schedule.revision ||
      command.reviewHash !== schedule.reviewHash ||
      policyScopeKey(command.scope) !== policyScopeKey(schedule.scope) ||
      command.effectiveAt !== schedule.effectiveAt
    ) {
      throw new PolicyScheduleProblem(
        schedule.id,
        "publish command does not match schedule metadata",
      );
    }
    return command;
  }

  private executionKey(schedule: PolicyScheduleRecord): string {
    return `features-policy-publish:${policyScheduleId({
      policyId: schedule.policyId,
      scope: schedule.scope,
      revision: schedule.revision,
      reviewHash: schedule.reviewHash,
      effectiveAt: schedule.effectiveAt,
      idempotencyKey: schedule.idempotencyKey,
    })}`;
  }

  private async ensureExecution(schedule: PolicyScheduleRecord): Promise<Execution> {
    const key = this.executionKey(schedule);
    const execution = await this.options.executionManager.create({
      type: "features.policy.publish",
      payload: this.payload(schedule),
      scheduledFor: new Date(schedule.effectiveAt),
      idempotencyKey: key,
      metadata: { scheduleId: schedule.id, policyId: schedule.policyId },
      maxAttempts: 3,
    });
    if (schedule.executionId !== execution.id) {
      await this.options.store.attachScheduleExecution(
        schedule.id,
        execution.id,
        schedule.triggerId,
      );
    }
    return execution;
  }

  private async startIfNeeded(execution: Execution): Promise<void> {
    if (execution.status === "pending" || execution.status === "retrying") {
      await this.options.executionManager.start(execution.id);
      return;
    }
    if (execution.status === "failed" || execution.status === "timed_out") {
      const retried = await this.options.executionManager.retry(execution.id);
      await this.options.executionManager.start(retried.id);
    }
  }
}
