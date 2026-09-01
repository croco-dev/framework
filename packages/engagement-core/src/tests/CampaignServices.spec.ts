import {
  ExecutionManagerImpl,
  ExecutionStore,
  type CreateExecutionRecordParams,
  type Execution,
  type ExecutionStatus,
  type ListExecutionsOptions,
  type ListRunningExecutionsOptions,
} from "@croco/execution-core";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  Audience,
  AudienceRegistry,
  CampaignRegistry,
  defineCampaign,
  type AudienceContext,
  type AudienceSource,
} from "../libs/CampaignContracts";
import {
  InMemoryCampaignStore,
  campaignScopeForTenant,
  type AppendCampaignSnapshotMembersInput,
  type CampaignMemberOutcome,
  type RecordCampaignMemberOutcomeInput,
} from "../libs/CampaignStore";
import {
  CampaignBroadcastService,
  CampaignExecutionInvalidProblem,
  CampaignExecutionNotReadyProblem,
  CampaignSnapshotCreationProblem,
  CampaignSnapshotService,
  type CampaignExecutionPublication,
  type CampaignExecutionPublisher,
  type CampaignMessageSender,
} from "../libs/CampaignServices";
import type { EngagementSendCommand, EngagementSendResult } from "../libs/EngagementService";
import { defineMessage, type AnyMessage } from "../libs/MessageContracts";

type TrialMember = Readonly<{
  recipient: Readonly<{ tenantId: string; userId: string }>;
  subscriptionId: string;
  firstName: string;
  trialEndsAt: Date;
  invalidData?: boolean;
  invalidKey?: boolean;
  invalidRecipient?: boolean;
  throwMapping?: boolean;
}>;

@Audience("inactive-trials")
class InactiveTrials implements AudienceSource<TrialMember> {
  calls = 0;
  throwAfter?: number;

  constructor(public membersList: readonly TrialMember[]) {}

  estimate(): number {
    return this.membersList.length;
  }

  async *members(_context: AudienceContext): AsyncIterable<TrialMember> {
    this.calls += 1;
    for (const [index, member] of this.membersList.entries()) {
      if (index === this.throwAfter) throw new Error("audience unavailable");
      yield member;
    }
  }
}

const TrialEnding = defineMessage({
  id: "trial-ending",
  topic: "billing",
  data: z
    .object({
      firstName: z.string(),
      trialEndsAt: z.date(),
    })
    .strict(),
  channels: ["email"],
});

const TrialReminder = defineCampaign({
  id: "trial-reminder",
  version: "2026-09-01",
  audience: InactiveTrials,
  message: TrialEnding,
  map: (member) => {
    if (member.throwMapping) throw new Error("mapper unavailable");
    return {
      recipient: member.invalidRecipient ? { tenantId: "", userId: "" } : member.recipient,
      data: {
        firstName: member.invalidData ? (1 as unknown as string) : member.firstName,
        trialEndsAt: member.trialEndsAt,
      },
      key: member.invalidKey ? "" : member.subscriptionId,
    };
  },
});

const TENANT_SCOPE = campaignScopeForTenant("tenant-1");

function trialMembers(count: number, tenantId = "tenant-1"): readonly TrialMember[] {
  return Array.from({ length: count }, (_, index) => ({
    recipient: { tenantId, userId: `user-${index}` },
    subscriptionId: `subscription-${index}`,
    firstName: `Member ${index}`,
    trialEndsAt: new Date("2026-09-30T00:00:00.000Z"),
  }));
}

class RecordingCampaignStore extends InMemoryCampaignStore {
  largestAppend = 0;

  override async appendSnapshotMembers(input: AppendCampaignSnapshotMembersInput) {
    this.largestAppend = Math.max(this.largestAppend, input.members.length);
    return super.appendSnapshotMembers(input);
  }
}

class FailOnceCampaignStore extends RecordingCampaignStore {
  failNextOutcome = true;

  override async recordMemberOutcome(
    input: RecordCampaignMemberOutcomeInput,
  ): Promise<CampaignMemberOutcome> {
    if (this.failNextOutcome) {
      this.failNextOutcome = false;
      throw new Error("campaign outcome store unavailable");
    }
    return super.recordMemberOutcome(input);
  }
}

class FakeCampaignSender implements CampaignMessageSender {
  active = 0;
  maxActive = 0;
  attempts = new Map<string, number>();
  logicalExecutionIds = new Map<string, string>();
  commands: Readonly<{ recipientId: string; key: string }>[] = [];
  onSend?: (command: Readonly<{ recipientId: string; key: string }>) => Promise<void>;

  async send<TMessage extends AnyMessage>(
    _message: TMessage,
    command: EngagementSendCommand<TMessage>,
  ): Promise<EngagementSendResult> {
    const call = { recipientId: command.recipient.userId, key: command.key };
    this.commands = [...this.commands, call];
    this.attempts.set(command.key, (this.attempts.get(command.key) ?? 0) + 1);
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    try {
      await new Promise<void>((resolve) => queueMicrotask(resolve));
      await this.onSend?.(call);
      if (command.recipient.userId === "user-2") {
        return {
          status: "suppressed",
          reason: "preference",
          channelResults: [{ channel: "email", status: "suppressed", reason: "preference" }],
        };
      }
      if (command.recipient.userId === "user-3") {
        throw new CampaignExecutionInvalidProblem("renderer unavailable");
      }
      const executionId =
        this.logicalExecutionIds.get(command.key) ?? `send-${this.logicalExecutionIds.size + 1}`;
      this.logicalExecutionIds.set(command.key, executionId);
      return {
        status: "queued",
        executionIds: [executionId],
        channelResults: [{ channel: "email", status: "queued", executionIds: [executionId] }],
      };
    } finally {
      this.active -= 1;
    }
  }
}

class MemoryExecutionStore extends ExecutionStore {
  private readonly executions = new Map<string, Execution>();
  private sequence = 0;

  async create(params: CreateExecutionRecordParams): Promise<Execution> {
    if (params.idempotencyKey !== undefined) {
      const existing = await this.findByIdempotencyKey(params.idempotencyKey);
      if (existing !== null) return existing;
    }
    const execution: Execution = {
      ...params,
      id: `execution-${(this.sequence += 1)}`,
      type: params.type,
      status: "pending",
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 1,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      checkpoints: {},
    };
    this.executions.set(execution.id, cloneExecution(execution));
    return cloneExecution(execution);
  }

  async findById(id: string): Promise<Execution | null> {
    const execution = this.executions.get(id);
    return execution === undefined ? null : cloneExecution(execution);
  }

  async findByIdempotencyKey(key: string): Promise<Execution | null> {
    const execution = [...this.executions.values()].find(
      (candidate) => candidate.idempotencyKey === key,
    );
    return execution === undefined ? null : cloneExecution(execution);
  }

  async update(id: string, data: Partial<Execution>): Promise<Execution> {
    const execution = this.require(id);
    const updated = { ...execution, ...data };
    this.executions.set(id, cloneExecution(updated));
    return cloneExecution(updated);
  }

  async mergeCheckpoint(id: string, key: string, value: unknown): Promise<Execution> {
    const execution = this.require(id);
    return this.update(id, { checkpoints: { ...execution.checkpoints, [key]: value } });
  }

  async updateIfStatus(
    id: string,
    expectedStatus: ExecutionStatus,
    data: Partial<Execution>,
  ): Promise<Execution | null> {
    const execution = this.require(id);
    return execution.status === expectedStatus ? this.update(id, data) : null;
  }

  async listRunning(options: ListRunningExecutionsOptions): Promise<Execution[]> {
    return [...this.executions.values()]
      .filter((execution) => execution.status === "running")
      .filter((execution) => options.afterId === undefined || execution.id > options.afterId)
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, options.limit)
      .map(cloneExecution);
  }

  async list(options: ListExecutionsOptions = {}): Promise<Execution[]> {
    return [...this.executions.values()]
      .filter((execution) => options.status === undefined || execution.status === options.status)
      .filter((execution) => options.type === undefined || execution.type === options.type)
      .slice(
        options.offset ?? 0,
        (options.offset ?? 0) + (options.limit ?? Number.MAX_SAFE_INTEGER),
      )
      .map(cloneExecution);
  }

  async delete(id: string): Promise<void> {
    this.executions.delete(id);
  }

  private require(id: string): Execution {
    const execution = this.executions.get(id);
    if (execution === undefined) throw new Error(`Missing execution ${id}`);
    return execution;
  }
}

class RecordingPublisher implements CampaignExecutionPublisher {
  publications: CampaignExecutionPublication[] = [];

  async publish(input: CampaignExecutionPublication): Promise<void> {
    this.publications.push(input);
  }
}

function cloneExecution(execution: Execution): Execution {
  return {
    ...execution,
    createdAt: new Date(execution.createdAt),
    ...(execution.startedAt === undefined ? {} : { startedAt: new Date(execution.startedAt) }),
    ...(execution.completedAt === undefined
      ? {}
      : { completedAt: new Date(execution.completedAt) }),
    ...(execution.scheduledFor === undefined
      ? {}
      : { scheduledFor: new Date(execution.scheduledFor) }),
    checkpoints: { ...execution.checkpoints },
    metadata: execution.metadata === undefined ? undefined : { ...execution.metadata },
  };
}

function createFixture(
  members: readonly TrialMember[],
  store: RecordingCampaignStore = new RecordingCampaignStore(),
  publisher?: CampaignExecutionPublisher,
) {
  const source = new InactiveTrials(members);
  const audiences = new AudienceRegistry();
  audiences.register(InactiveTrials, source);
  const campaigns = new CampaignRegistry();
  campaigns.register(TrialReminder);
  const executionManager = new ExecutionManagerImpl(new MemoryExecutionStore(), {
    clock: () => new Date("2026-09-01T00:00:00.000Z"),
  });
  const sender = new FakeCampaignSender();
  const snapshots = new CampaignSnapshotService(
    audiences,
    store,
    () => new Date("2026-09-01T00:00:00.000Z"),
    () => "snapshot-1",
  );
  const broadcasts = new CampaignBroadcastService(
    campaigns,
    store,
    executionManager,
    sender,
    publisher,
    () => new Date("2026-09-01T00:00:00.000Z"),
  );
  return { source, campaigns, executionManager, sender, snapshots, broadcasts, store };
}

describe("CampaignServices", () => {
  it("streams a complete immutable snapshot in bounded chunks and preserves invalid mappings", async () => {
    const members = [...trialMembers(6)];
    members[2] = { ...members[2], invalidData: true };
    members[4] = { ...members[4], throwMapping: true };
    const fixture = createFixture(members);

    const result = await fixture.snapshots.createSnapshot(
      TrialReminder,
      { tenantId: "tenant-1" },
      { chunkSize: 2 },
    );
    fixture.source.membersList = [];
    const page = await fixture.store.listSnapshotMembers(TENANT_SCOPE, result.snapshot.id, {
      limit: 10,
    });

    expect(result).toMatchObject({
      estimatedMemberCount: 6,
      snapshot: { state: "complete", memberCount: 6 },
    });
    expect(fixture.store.largestAppend).toBe(2);
    expect(page.members).toHaveLength(6);
    expect(page.members[2]).toMatchObject({
      state: "mapping-failed",
      failureCode: "engagement-core/message-data-invalid",
    });
    expect(page.members[4]).toEqual({
      snapshotId: result.snapshot.id,
      scope: TENANT_SCOPE,
      ordinal: 4,
      memberKey: "@croco/internal/mapping-failed/4",
      state: "mapping-failed",
      failureCode: "engagement-core/campaign-operation-failed",
    });
    expect(fixture.source.calls).toBe(1);
  });

  it("marks enumeration and tenant-scope failures without publishing partial snapshots", async () => {
    const failedEnumeration = createFixture(trialMembers(3));
    failedEnumeration.source.throwAfter = 1;

    await expect(
      failedEnumeration.snapshots.createSnapshot(
        TrialReminder,
        { tenantId: "tenant-1" },
        { chunkSize: 1 },
      ),
    ).rejects.toThrow(CampaignSnapshotCreationProblem);
    await expect(
      failedEnumeration.store.getSnapshot(TENANT_SCOPE, "snapshot-1"),
    ).resolves.toMatchObject({ state: "failed", memberCount: 1 });

    const foreign = createFixture(trialMembers(1, "tenant-2"));
    await expect(
      foreign.snapshots.createSnapshot(TrialReminder, { tenantId: "tenant-1" }),
    ).rejects.toThrow(CampaignSnapshotCreationProblem);
    await expect(foreign.store.getSnapshot(TENANT_SCOPE, "snapshot-1")).resolves.toMatchObject({
      state: "failed",
      memberCount: 0,
    });
  });

  it("retains invalid mapper identities as visible member failures", async () => {
    const members = [...trialMembers(2)];
    members[0] = { ...members[0], invalidKey: true };
    members[1] = { ...members[1], invalidRecipient: true };
    const fixture = createFixture(members);

    const { snapshot } = await fixture.snapshots.createSnapshot(
      TrialReminder,
      { tenantId: "tenant-1" },
      { chunkSize: 1 },
    );
    const page = await fixture.store.listSnapshotMembers(TENANT_SCOPE, snapshot.id, { limit: 2 });

    expect(snapshot).toMatchObject({ state: "complete", memberCount: 2 });
    expect(page.members).toEqual([
      {
        snapshotId: snapshot.id,
        scope: TENANT_SCOPE,
        ordinal: 0,
        memberKey: "@croco/internal/mapping-failed/0",
        state: "mapping-failed",
        failureCode: "engagement-core/campaign-execution-invalid",
      },
      {
        snapshotId: snapshot.id,
        scope: TENANT_SCOPE,
        ordinal: 1,
        memberKey: "@croco/internal/mapping-failed/1",
        state: "mapping-failed",
        failureCode: "engagement-core/campaign-execution-invalid",
      },
    ]);
  });

  it("fans out with bounded concurrency and exposes queued, suppressed, and failed totals", async () => {
    const fixture = createFixture(trialMembers(5));
    const { snapshot } = await fixture.snapshots.createSnapshot(
      TrialReminder,
      { tenantId: "tenant-1" },
      { chunkSize: 2 },
    );

    await expect(
      fixture.broadcasts.broadcast(TrialReminder, campaignScopeForTenant("tenant-2"), snapshot.id, {
        pageSize: 2,
        concurrency: 2,
      }),
    ).rejects.toMatchObject({ code: "engagement-core/campaign-snapshot-not-found" });
    expect(fixture.sender.commands).toEqual([]);

    const result = await fixture.broadcasts.broadcast(TrialReminder, TENANT_SCOPE, snapshot.id, {
      pageSize: 2,
      concurrency: 2,
    });

    expect(result.execution.status).toBe("completed");
    expect(result.progress).toEqual({
      total: 5,
      completed: 5,
      queued: 3,
      suppressed: 1,
      failed: 1,
      skipped: 0,
      pending: 0,
    });
    expect(fixture.sender.maxActive).toBe(2);
    expect(fixture.sender.commands.every((command) => command.key.includes(snapshot.id))).toBe(
      true,
    );
    expect(fixture.source.calls).toBe(1);

    await fixture.broadcasts.execute(result.execution.id);
    expect(fixture.sender.commands).toHaveLength(5);
    expect(fixture.source.calls).toBe(1);
  });

  it("resumes after outcome persistence failure with the same logical send identity", async () => {
    const store = new FailOnceCampaignStore();
    const fixture = createFixture(trialMembers(3), store);
    const { snapshot } = await fixture.snapshots.createSnapshot(TrialReminder, {
      tenantId: "tenant-1",
    });
    const execution = await fixture.broadcasts.createExecution(
      TrialReminder,
      TENANT_SCOPE,
      snapshot.id,
      { pageSize: 2, concurrency: 1, maxAttempts: 2 },
    );

    await expect(fixture.broadcasts.execute(execution.id)).rejects.toThrow(
      "campaign outcome store unavailable",
    );
    await expect(fixture.executionManager.get(execution.id)).resolves.toMatchObject({
      status: "retrying",
    });

    const result = await fixture.broadcasts.execute(execution.id);
    expect(result.progress).toMatchObject({
      total: 3,
      queued: 2,
      suppressed: 1,
      completed: 3,
      pending: 0,
    });
    expect(fixture.sender.logicalExecutionIds.size).toBe(2);
    const repeated = [...fixture.sender.attempts.values()].filter((attempts) => attempts > 1);
    expect(repeated).toEqual([2]);
  });

  it("retries a transient member failure from the same snapshot and send identity", async () => {
    const fixture = createFixture(trialMembers(1));
    const { snapshot } = await fixture.snapshots.createSnapshot(TrialReminder, {
      tenantId: "tenant-1",
    });
    const execution = await fixture.broadcasts.createExecution(
      TrialReminder,
      TENANT_SCOPE,
      snapshot.id,
      { pageSize: 1, concurrency: 1, maxAttempts: 2 },
    );
    let unavailable = true;
    fixture.sender.onSend = async () => {
      if (!unavailable) return;
      unavailable = false;
      throw new Error("provider temporarily unavailable");
    };

    await expect(fixture.broadcasts.execute(execution.id)).rejects.toThrow(
      "provider temporarily unavailable",
    );
    await expect(fixture.executionManager.get(execution.id)).resolves.toMatchObject({
      status: "retrying",
      attempts: 1,
    });
    await expect(
      fixture.store.getMemberOutcome(TENANT_SCOPE, snapshot.id, "subscription-0"),
    ).resolves.toMatchObject({ status: "failed", retryable: true });

    const result = await fixture.broadcasts.execute(execution.id);
    const sendKey = fixture.sender.commands[0]?.key;

    expect(result.execution).toMatchObject({ status: "completed", attempts: 2 });
    expect(result.progress).toEqual({
      total: 1,
      completed: 1,
      queued: 1,
      suppressed: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
    });
    expect(fixture.source.calls).toBe(1);
    expect(sendKey).toBeDefined();
    expect(fixture.sender.commands.map((command) => command.key)).toEqual([sendKey, sendKey]);
    expect(fixture.sender.attempts.get(sendKey as string)).toBe(2);
  });

  it("does not resend terminal member failures when retrying an uncheckpointed page", async () => {
    const fixture = createFixture(trialMembers(2));
    const { snapshot } = await fixture.snapshots.createSnapshot(TrialReminder, {
      tenantId: "tenant-1",
    });
    const execution = await fixture.broadcasts.createExecution(
      TrialReminder,
      TENANT_SCOPE,
      snapshot.id,
      { pageSize: 2, concurrency: 1, maxAttempts: 2 },
    );
    let transientFailure = true;
    fixture.sender.onSend = async ({ recipientId }) => {
      if (recipientId === "user-0") {
        throw new CampaignExecutionInvalidProblem("provider rejected the recipient");
      }
      if (transientFailure) {
        transientFailure = false;
        throw new Error("provider temporarily unavailable");
      }
    };

    await expect(fixture.broadcasts.execute(execution.id)).rejects.toThrow(
      "provider temporarily unavailable",
    );
    await expect(
      fixture.store.getMemberOutcome(TENANT_SCOPE, snapshot.id, "subscription-0"),
    ).resolves.toMatchObject({ status: "failed", retryable: false });
    await expect(
      fixture.store.getMemberOutcome(TENANT_SCOPE, snapshot.id, "subscription-1"),
    ).resolves.toMatchObject({ status: "failed", retryable: true });

    const result = await fixture.broadcasts.execute(execution.id);

    expect(result.progress).toMatchObject({ queued: 1, failed: 1, completed: 2, pending: 0 });
    expect(fixture.sender.commands.map(({ recipientId }) => recipientId)).toEqual([
      "user-0",
      "user-1",
      "user-1",
    ]);
    expect(fixture.sender.attempts.get(fixture.sender.commands[0]?.key as string)).toBe(1);
  });

  it("stops undispatched work after cancellation without rolling back accepted sends", async () => {
    const fixture = createFixture(trialMembers(5));
    const { snapshot } = await fixture.snapshots.createSnapshot(TrialReminder, {
      tenantId: "tenant-1",
    });
    const execution = await fixture.broadcasts.createExecution(
      TrialReminder,
      TENANT_SCOPE,
      snapshot.id,
      { pageSize: 2, concurrency: 1 },
    );
    let cancelled = false;
    fixture.sender.onSend = async () => {
      if (cancelled) return;
      cancelled = true;
      await fixture.broadcasts.cancel(execution.id, "operator requested cancellation");
    };

    const result = await fixture.broadcasts.execute(execution.id);

    expect(result.execution.status).toBe("cancelled");
    expect(result.progress).toEqual({
      total: 5,
      completed: 2,
      queued: 1,
      suppressed: 0,
      failed: 0,
      skipped: 1,
      pending: 3,
    });
    expect(fixture.sender.commands).toHaveLength(1);
  });

  it("publishes one absolute scheduled execution and rejects early execution", async () => {
    const publisher = new RecordingPublisher();
    const fixture = createFixture(trialMembers(1), new RecordingCampaignStore(), publisher);
    const { snapshot } = await fixture.snapshots.createSnapshot(TrialReminder, {
      tenantId: "tenant-1",
    });
    const scheduledFor = new Date("2026-09-01T01:00:00.000Z");
    const execution = await fixture.broadcasts.schedule(TrialReminder, TENANT_SCOPE, snapshot.id, {
      scheduledFor,
      pageSize: 1,
      concurrency: 1,
    });

    expect(execution.scheduledFor).toEqual(scheduledFor);
    expect(publisher.publications).toEqual([
      {
        executionId: execution.id,
        scheduledFor,
        idempotencyKey:
          "engagement-campaign:tenant%3Atenant-1:trial-reminder:2026-09-01:trial-ending:snapshot-1",
      },
    ]);
    await expect(
      fixture.broadcasts.schedule(TrialReminder, TENANT_SCOPE, snapshot.id, {
        scheduledFor: new Date("2026-09-01T02:00:00.000Z"),
        pageSize: 1,
        concurrency: 1,
      }),
    ).rejects.toMatchObject({ code: "execution/idempotency-conflict" });
    await expect(fixture.broadcasts.execute(execution.id)).rejects.toThrow(
      CampaignExecutionNotReadyProblem,
    );
  });
});
