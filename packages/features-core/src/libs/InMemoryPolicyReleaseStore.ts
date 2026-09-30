import { policyCommandFingerprint, policyScopeKey, policyScheduleId } from "./Policy";
import type {
  PolicyRevision,
  PolicyPauseInput,
  PolicyScope,
  PolicyPublicationInput,
  PolicyCommandReceipt,
  PolicyResolution,
  PolicyScheduleInput,
  PolicyScheduleRecord,
} from "./Policy";
import type { PolicyScheduleLookup } from "./PolicyReleaseService";
import {
  PolicyRevisionConflictProblem,
  PolicyIdempotencyConflictProblem,
  PolicyScheduleProblem,
} from "./problems/PolicyProblems";

export class InMemoryPolicyReleaseStore<TValue = unknown> implements PolicyScheduleLookup<TValue> {
  private readonly revisions = new Map<string, PolicyRevision<TValue>[]>();
  private readonly receipts = new Map<string, PolicyCommandReceipt>();
  private readonly schedules = new Map<string, PolicyScheduleRecord>();
  private key(scope: PolicyScope, policyId: string): string {
    return JSON.stringify([policyId, policyScopeKey(scope)]);
  }
  async create(revision: PolicyRevision<TValue>): Promise<void> {
    this.persist(revision, revision.revision - 1);
  }
  private persist(revision: PolicyRevision<TValue>, expected: number): void {
    const key = this.key(revision.scope, revision.policyId);
    const entries = this.revisions.get(key) ?? [];
    const actual = entries.at(-1)?.revision ?? 0;
    if (actual !== expected || revision.revision !== expected + 1)
      throw new PolicyRevisionConflictProblem(revision.policyId, expected, actual);
    this.revisions.set(key, [...entries, structuredClone(revision)]);
  }
  async save(revision: PolicyRevision<TValue>, expectedRevision: number): Promise<void> {
    this.persist(revision, expectedRevision);
    if (revision.state === "reviewed" && revision.history.at(-1)?.from === "scheduled") {
      for (const [id, schedule] of this.schedules) {
        if (
          schedule.policyId === revision.policyId &&
          policyScopeKey(schedule.scope) === policyScopeKey(revision.scope) &&
          schedule.revision === expectedRevision &&
          schedule.state !== "completed" &&
          schedule.state !== "cancelled"
        ) {
          this.updateSchedule(id, {
            state: "cancelled",
            leaseUntil: undefined,
            claimedBy: undefined,
            lastError: "Policy schedule cancelled",
            updatedAt: revision.history.at(-1)?.occurredAt,
          });
        }
      }
    }
  }
  async get(scope: PolicyScope, policyId: string): Promise<PolicyRevision<TValue> | null> {
    return structuredClone(this.revisions.get(this.key(scope, policyId))?.at(-1) ?? null);
  }
  async getRevision(
    scope: PolicyScope,
    policyId: string,
    revision: number,
  ): Promise<PolicyRevision<TValue> | null> {
    return structuredClone(
      this.revisions.get(this.key(scope, policyId))?.find((item) => item.revision === revision) ??
        null,
    );
  }
  async list(scope: PolicyScope, policyId: string): Promise<readonly PolicyRevision<TValue>[]> {
    return structuredClone(this.revisions.get(this.key(scope, policyId)) ?? []);
  }
  async findCommandReceipt(
    scope: PolicyScope,
    policyId: string,
    idempotencyKey: string,
  ): Promise<PolicyCommandReceipt | null> {
    return structuredClone(
      this.receipts.get(JSON.stringify([this.key(scope, policyId), idempotencyKey])) ?? null,
    );
  }
  async recordPause(input: PolicyPauseInput<TValue>): Promise<PolicyCommandReceipt> {
    const { command, receipt, revision, retainedDraft } = input;
    const key = JSON.stringify([this.key(command.scope, command.policyId), command.idempotencyKey]);
    const fingerprint = policyCommandFingerprint(command);
    const existing = this.receipts.get(key);
    if (
      receipt.commandFingerprint !== fingerprint ||
      (existing && existing.commandFingerprint !== fingerprint)
    )
      throw new PolicyIdempotencyConflictProblem(command.policyId, command.idempotencyKey);
    if (existing) return structuredClone(existing);
    const entries = this.revisions.get(this.key(command.scope, command.policyId)) ?? [];
    const actual = entries.at(-1)?.revision ?? 0;
    const active = [...entries]
      .reverse()
      .find(
        (entry) =>
          (entry.state === "published" &&
            Date.parse(entry.publication?.effectiveAt ?? "") <= Date.parse(receipt.recordedAt) &&
            Date.parse(entry.publication?.publishedAt ?? "") <= Date.parse(receipt.recordedAt)) ||
          (entry.state === "paused" &&
            Date.parse(entry.history.at(-1)?.occurredAt ?? "") <= Date.parse(receipt.recordedAt)),
      );
    if (
      actual !== command.expectedRevision ||
      active?.version !== input.expectedActiveVersion ||
      revision.revision !== actual + 1 ||
      (retainedDraft && retainedDraft.revision !== actual + 2)
    )
      throw new PolicyRevisionConflictProblem(command.policyId, command.expectedRevision, actual);
    this.revisions.set(this.key(command.scope, command.policyId), [
      ...entries,
      structuredClone(revision),
      ...(retainedDraft ? [structuredClone(retainedDraft)] : []),
    ]);
    this.receipts.set(key, structuredClone(receipt));
    return structuredClone(receipt);
  }
  async recordPublication(input: PolicyPublicationInput<TValue>): Promise<PolicyCommandReceipt> {
    const { command, revision, receipt } = input;
    const key = JSON.stringify([this.key(command.scope, command.policyId), command.idempotencyKey]);
    const fingerprint = policyCommandFingerprint(command);
    const existing = this.receipts.get(key);
    if (
      receipt.commandFingerprint !== fingerprint ||
      (existing && existing.commandFingerprint !== fingerprint)
    )
      throw new PolicyIdempotencyConflictProblem(command.policyId, command.idempotencyKey);
    if (existing) return structuredClone(existing);
    this.persist(revision, command.expectedRevision);
    if (receipt.status === "scheduled") {
      const publishCommand = {
        ...command,
        expectedRevision: revision.revision,
        effectiveAt: receipt.effectiveAt,
        idempotencyKey: `${command.idempotencyKey}:publish`,
      };
      const schedule = {
        policyId: command.policyId,
        scope: command.scope,
        revision: revision.revision,
        reviewHash: command.reviewHash,
        effectiveAt: receipt.effectiveAt,
        idempotencyKey: publishCommand.idempotencyKey,
      };
      const id = policyScheduleId(schedule);
      this.schedules.set(
        id,
        structuredClone({
          ...schedule,
          id,
          state: "pending" as const,
          metadata: { command: publishCommand },
          createdAt: receipt.recordedAt,
          updatedAt: receipt.recordedAt,
        }),
      );
    }
    this.receipts.set(key, structuredClone(receipt));
    return structuredClone(receipt);
  }
  async resolve(scope: PolicyScope, policyId: string, at: Date): Promise<PolicyResolution<TValue>> {
    const entries = this.revisions.get(this.key(scope, policyId)) ?? [];
    const revision = [...entries]
      .reverse()
      .find(
        (item) =>
          (item.state === "published" &&
            Date.parse(item.publication?.effectiveAt ?? "") <= at.getTime() &&
            Date.parse(item.publication?.publishedAt ?? "") <= at.getTime()) ||
          (item.state === "paused" &&
            Date.parse(item.history.at(-1)?.occurredAt ?? "") <= at.getTime()),
      );
    if (!revision) return { policyId, scope, status: "unavailable" };
    return {
      policyId,
      scope,
      status: revision.state === "paused" ? "paused" : "active",
      version: revision.version,
      hash: revision.hash,
      value: structuredClone(revision.state === "paused" ? revision.fallback : revision.value),
      reason: revision.pauseReason,
    };
  }
  async schedule(input: PolicyScheduleInput): Promise<PolicyScheduleRecord> {
    const id = policyScheduleId(input);
    const existing = this.schedules.get(id);
    if (existing) return structuredClone(existing);
    const now = new Date().toISOString();
    const record: PolicyScheduleRecord = {
      ...structuredClone(input),
      id,
      state: "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.schedules.set(id, record);
    return structuredClone(record);
  }
  async getSchedule(id: string): Promise<PolicyScheduleRecord | null> {
    return structuredClone(this.schedules.get(id) ?? null);
  }
  private updateSchedule(id: string, changes: Partial<PolicyScheduleRecord>): PolicyScheduleRecord {
    const record = this.schedules.get(id);
    if (!record) throw new PolicyScheduleProblem(id, "Schedule not found");
    const next = { ...record, ...changes };
    this.schedules.set(id, next);
    return structuredClone(next);
  }
  async attachScheduleExecution(
    id: string,
    executionId: string,
    triggerId?: string,
  ): Promise<PolicyScheduleRecord> {
    return this.updateSchedule(id, { executionId, triggerId });
  }
  async listDueSchedules(now: Date, limit = 100): Promise<readonly PolicyScheduleRecord[]> {
    return structuredClone(
      [...this.schedules.values()]
        .filter(
          (record) =>
            (record.state === "pending" ||
              (record.state === "claimed" &&
                Date.parse(record.leaseUntil ?? "") <= now.getTime())) &&
            Date.parse(record.effectiveAt) <= now.getTime(),
        )
        .slice(0, limit),
    );
  }
  async claimSchedule(
    id: string,
    workerId: string,
    now: Date,
    leaseMs: number,
  ): Promise<PolicyScheduleRecord | null> {
    const record = this.schedules.get(id);
    if (
      !record ||
      Date.parse(record.effectiveAt) > now.getTime() ||
      (record.state !== "pending" &&
        !(record.state === "claimed" && Date.parse(record.leaseUntil ?? "") <= now.getTime()))
    )
      return null;
    return this.updateSchedule(id, {
      state: "claimed",
      claimedBy: workerId,
      leaseUntil: new Date(now.getTime() + leaseMs).toISOString(),
      updatedAt: now.toISOString(),
    });
  }
  async completeSchedule(id: string, now: Date): Promise<PolicyScheduleRecord> {
    return this.updateSchedule(id, { state: "completed", updatedAt: now.toISOString() });
  }
  async failSchedule(id: string, now: Date, error: string): Promise<PolicyScheduleRecord> {
    return this.updateSchedule(id, {
      state: "failed",
      lastError: error,
      updatedAt: now.toISOString(),
    });
  }
  async cancelSchedule(id: string, now: Date, reason: string): Promise<PolicyScheduleRecord> {
    return this.updateSchedule(id, {
      state: "cancelled",
      lastError: reason,
      updatedAt: now.toISOString(),
    });
  }
}
