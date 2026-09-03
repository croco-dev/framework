import { assertValidChunkSize } from "@croco/batch-core";
import type { Checkpointable, ItemReader } from "@croco/batch-core";
import type { Execution, ExecutionManager } from "@croco/execution-core";
import { Problem, ProblemCategory } from "@croco/problems-core";

import type {
  AudienceConstructor,
  AudienceContext,
  AnyCampaign,
  AudienceRegistry,
  CampaignRegistry,
  DefinedCampaign,
} from "./CampaignContracts";
import {
  CampaignSnapshotIncompleteProblem,
  CampaignSnapshotNotFoundProblem,
  campaignOutcomeFromSendResult,
  campaignScopeForTenant,
  campaignScopeKey,
  decodeCampaignSnapshotData,
  encodeCampaignSnapshotData,
  type CampaignProgress,
  type CampaignScopeRef,
  type CampaignSnapshot,
  type CampaignSnapshotMember,
  type CampaignStore,
} from "./CampaignStore";
import type {
  EngagementDeliveryPolicy,
  EngagementSendCommand,
  EngagementSendResult,
} from "./EngagementService";
import { parseMessageData, type AnyMessage } from "./MessageContracts";
import type { RecipientRef } from "./RecipientContracts";

const CAMPAIGN_EXECUTION_TYPE = "engagement.campaign-broadcast";
const CAMPAIGN_CHECKPOINT_KEY = "campaign.next-ordinal";
const DEFAULT_SNAPSHOT_CHUNK_SIZE = 100;
const DEFAULT_BROADCAST_PAGE_SIZE = 100;
const DEFAULT_BROADCAST_CONCURRENCY = 10;
const DEFAULT_MAX_ATTEMPTS = 3;
const INTERNAL_MEMBER_KEY_PREFIX = "@croco/internal/";

export type CampaignSnapshotOptions = Readonly<{
  chunkSize?: number;
}>;

export type CampaignExecutionOptions = Readonly<{
  pageSize?: number;
  concurrency?: number;
  maxAttempts?: number;
}>;

export type CampaignScheduleOptions = CampaignExecutionOptions &
  Readonly<{
    scheduledFor: Date;
  }>;

export type CampaignExecutionPublication = Readonly<{
  executionId: string;
  scheduledFor: Date;
  idempotencyKey: string;
}>;

export interface CampaignExecutionPublisher {
  publish(input: CampaignExecutionPublication): Promise<void>;
}

export interface CampaignMessageSender {
  send<TMessage extends AnyMessage>(
    message: TMessage,
    command: EngagementSendCommand<TMessage>,
  ): Promise<EngagementSendResult>;
}

export type CampaignBroadcastResult = Readonly<{
  execution: Execution;
  snapshot: CampaignSnapshot;
  progress: CampaignProgress;
}>;

export type CampaignSnapshotCreationResult = Readonly<{
  snapshot: CampaignSnapshot;
  estimatedMemberCount?: number;
}>;

export class CampaignSnapshotService {
  constructor(
    private readonly audiences: AudienceRegistry,
    private readonly store: CampaignStore,
    private readonly clock: () => Date = () => new Date(),
    private readonly idGenerator: () => string = () => globalThis.crypto.randomUUID(),
  ) {}

  preview<TMember>(
    audience: AudienceConstructor<TMember>,
    context: AudienceContext,
    limit: number,
  ): Promise<readonly TMember[]> {
    return this.audiences.preview(audience, context, limit);
  }

  async createSnapshot<
    TId extends string,
    TVersion extends string,
    TAudience extends AudienceConstructor,
    TMessage extends AnyMessage,
  >(
    campaign: DefinedCampaign<TId, TVersion, TAudience, TMessage>,
    context: AudienceContext,
    options: CampaignSnapshotOptions = {},
  ): Promise<CampaignSnapshotCreationResult> {
    const chunkSize = options.chunkSize ?? DEFAULT_SNAPSHOT_CHUNK_SIZE;
    assertValidChunkSize(chunkSize);
    const scope = scopeForCampaign(campaign, context);
    const source = this.audiences.resolve(campaign.audience);
    const snapshotId = this.idGenerator();
    const createdAt = this.clock();
    const snapshot = await this.store.createSnapshot({
      id: snapshotId,
      scope,
      audienceId: campaign.descriptor.audienceId,
      campaignId: campaign.id,
      campaignVersion: String(campaign.descriptor.version),
      messageId: campaign.message.id,
      descriptorFingerprint: campaign.descriptor.hash,
      createdAt,
    });

    let estimatedMemberCount: number | undefined;
    try {
      estimatedMemberCount = await estimateAudience(source, context);
      let ordinal = 0;
      let chunk: CampaignSnapshotMember[] = [];

      for await (const member of source.members(context)) {
        chunk.push(mapSnapshotMember(campaign, scope, snapshotId, ordinal, member));
        ordinal += 1;
        if (chunk.length === chunkSize) {
          await this.store.appendSnapshotMembers({
            scope,
            snapshotId,
            expectedStartOrdinal: ordinal - chunk.length,
            members: chunk,
          });
          chunk = [];
        }
      }

      if (chunk.length > 0) {
        await this.store.appendSnapshotMembers({
          scope,
          snapshotId,
          expectedStartOrdinal: ordinal - chunk.length,
          members: chunk,
        });
      }

      const completed = await this.store.completeSnapshot({
        scope,
        snapshotId,
        expectedMemberCount: ordinal,
        completedAt: this.clock(),
      });
      return Object.freeze({
        snapshot: completed,
        ...(estimatedMemberCount === undefined ? {} : { estimatedMemberCount }),
      });
    } catch (error) {
      const failureCode = errorCode(error);
      try {
        await this.store.failSnapshot({
          scope,
          snapshotId: snapshot.id,
          failureCode,
          completedAt: this.clock(),
        });
      } catch (failureRecordError) {
        attachFailureRecordError(error, failureRecordError);
      }
      throw new CampaignSnapshotCreationProblem(snapshot.id, failureCode, normalizeError(error));
    }
  }
}

export class CampaignBroadcastService {
  constructor(
    private readonly campaigns: CampaignRegistry,
    private readonly store: CampaignStore,
    private readonly executions: ExecutionManager,
    private readonly sender: CampaignMessageSender,
    private readonly publisher?: CampaignExecutionPublisher,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async createExecution<TCampaign extends AnyCampaign>(
    campaign: TCampaign,
    scope: CampaignScopeRef,
    snapshotId: string,
    options: CampaignExecutionOptions & Readonly<{ scheduledFor?: Date }> = {},
  ): Promise<Execution> {
    const snapshot = await this.requireSnapshot(campaign, scope, snapshotId);
    if (snapshot.state !== "complete") {
      throw new CampaignSnapshotIncompleteProblem(snapshot.id, snapshot.state);
    }
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    assertPositiveSafeInteger("maxAttempts", maxAttempts);
    assertExecutionBounds(options.pageSize, options.concurrency);
    if (options.scheduledFor !== undefined && Number.isNaN(options.scheduledFor.getTime())) {
      throw new CampaignExecutionInvalidProblem("scheduledFor must be a valid date");
    }

    return this.executions.create({
      type: CAMPAIGN_EXECUTION_TYPE,
      payload: {
        snapshotId,
        scopeKey: campaignScopeKey(scope),
        campaignId: campaign.id,
        campaignVersion: String(campaign.descriptor.version),
        descriptorFingerprint: campaign.descriptor.hash,
        pageSize: options.pageSize ?? DEFAULT_BROADCAST_PAGE_SIZE,
        concurrency: options.concurrency ?? DEFAULT_BROADCAST_CONCURRENCY,
        ...(options.scheduledFor === undefined
          ? {}
          : { scheduledFor: options.scheduledFor.toISOString() }),
      } satisfies CampaignExecutionPayload,
      maxAttempts,
      ...(options.scheduledFor === undefined
        ? {}
        : { scheduledFor: new Date(options.scheduledFor) }),
      idempotencyKey: campaignExecutionIdempotencyKey(snapshot),
      metadata: {
        campaignId: campaign.id,
        campaignVersion: String(campaign.descriptor.version),
        snapshotId,
        scopeKey: campaignScopeKey(scope),
      },
    });
  }

  async schedule<TCampaign extends AnyCampaign>(
    campaign: TCampaign,
    scope: CampaignScopeRef,
    snapshotId: string,
    options: CampaignScheduleOptions,
  ): Promise<Execution> {
    if (this.publisher === undefined) {
      throw new CampaignExecutionPublisherMissingProblem();
    }
    if (Number.isNaN(options.scheduledFor.getTime()) || options.scheduledFor <= this.clock()) {
      throw new CampaignExecutionInvalidProblem("scheduledFor must be in the future");
    }
    const execution = await this.createExecution(campaign, scope, snapshotId, options);
    if (execution.idempotencyKey === undefined) {
      throw new CampaignExecutionInvalidProblem(
        "Campaign execution is missing its idempotency key",
      );
    }
    await this.publisher.publish({
      executionId: execution.id,
      scheduledFor: new Date(options.scheduledFor),
      idempotencyKey: execution.idempotencyKey,
    });
    return execution;
  }

  async broadcast<TCampaign extends AnyCampaign>(
    campaign: TCampaign,
    scope: CampaignScopeRef,
    snapshotId: string,
    options: CampaignExecutionOptions = {},
  ): Promise<CampaignBroadcastResult> {
    const execution = await this.createExecution(campaign, scope, snapshotId, options);
    return this.execute(execution.id);
  }

  async execute(executionId: string): Promise<CampaignBroadcastResult> {
    let execution = await this.executions.get(executionId);
    const payload = parseExecutionPayload(execution);
    const campaign = this.campaigns.resolve(payload.campaignId);
    const scope = scopeFromKey(payload.scopeKey);
    const snapshot = await this.requireSnapshot(campaign, scope, payload.snapshotId);
    if (
      payload.campaignVersion !== snapshot.campaignVersion ||
      payload.descriptorFingerprint !== snapshot.descriptorFingerprint ||
      payload.scheduledFor !== execution.scheduledFor?.toISOString()
    ) {
      throw new CampaignExecutionInvalidProblem(
        `Execution ${execution.id} does not match its campaign snapshot`,
      );
    }

    if (execution.status === "completed" || execution.status === "cancelled") {
      return this.result(execution, snapshot);
    }
    if (execution.status !== "pending" && execution.status !== "retrying") {
      throw new CampaignExecutionInvalidProblem(
        `Execution ${execution.id} cannot run from ${execution.status}`,
      );
    }
    if (execution.scheduledFor !== undefined && execution.scheduledFor > this.clock()) {
      throw new CampaignExecutionNotReadyProblem(execution.id, execution.scheduledFor);
    }

    execution = await this.executions.start(execution.id);
    const reader = new CampaignSnapshotReader(
      this.store,
      this.executions,
      execution.id,
      scope,
      snapshot.id,
      payload.pageSize,
    );
    const checkpoint = execution.checkpoints?.[CAMPAIGN_CHECKPOINT_KEY];
    if (checkpoint !== undefined) reader.restoreCheckpoint(checkpoint);

    try {
      while (true) {
        execution = await this.executions.get(execution.id);
        if (execution.status === "cancelled") break;
        if (execution.status !== "running") {
          throw new CampaignExecutionInvalidProblem(
            `Execution ${execution.id} changed to ${execution.status} while running`,
          );
        }

        const members = await reader.readPage();
        if (members.length === 0) break;
        await processWithConcurrency(members, payload.concurrency, async (member) => {
          await this.processMember(execution.id, campaign, snapshot, member);
        });

        await this.executions.checkpoint(
          execution.id,
          CAMPAIGN_CHECKPOINT_KEY,
          reader.getCheckpoint(),
        );
        await this.updateProgress(execution.id, scope, snapshot.id);
      }

      execution = await this.executions.get(execution.id);
      if (execution.status === "running") {
        const progress = await this.store.summarizeSnapshot(scope, snapshot.id);
        execution = await this.executions.complete(execution.id, { progress });
      }
      return this.result(execution, snapshot);
    } catch (error) {
      const current = await this.executions.get(execution.id);
      if (current.status === "running") {
        try {
          await this.executions.fail(execution.id, {
            message: normalizeError(error).message,
            code: errorCode(error),
            retryable: isRetryable(error),
          });
        } catch (failureRecordError) {
          attachFailureRecordError(error, failureRecordError);
        }
      }
      throw error;
    }
  }

  cancel(executionId: string, reason?: string): Promise<Execution> {
    return this.executions.cancel(executionId, reason);
  }

  private async processMember(
    executionId: string,
    campaign: AnyCampaign,
    snapshot: CampaignSnapshot,
    member: CampaignSnapshotMember,
  ): Promise<void> {
    const existing = await this.store.getMemberOutcome(
      snapshot.scope,
      snapshot.id,
      member.memberKey,
    );
    if (
      existing !== undefined &&
      (member.state !== "ready" || existing.status !== "failed" || !existing.retryable)
    ) {
      return;
    }

    const execution = await this.executions.get(executionId);
    if (execution.status === "cancelled") {
      await this.store.recordMemberOutcome({
        scope: snapshot.scope,
        snapshotId: snapshot.id,
        memberKey: member.memberKey,
        status: "skipped",
        reason: "cancelled",
        recordedAt: this.clock(),
      });
      return;
    }
    if (execution.status !== "running") {
      throw new CampaignExecutionInvalidProblem(
        `Execution ${execution.id} changed to ${execution.status} before dispatch`,
      );
    }

    if (member.state === "mapping-failed") {
      await this.store.recordMemberOutcome({
        scope: snapshot.scope,
        snapshotId: snapshot.id,
        memberKey: member.memberKey,
        status: "failed",
        failureCode: member.failureCode,
        retryable: false,
        recordedAt: this.clock(),
      });
      return;
    }

    let result: EngagementSendResult;
    try {
      result = await this.sender.send(campaign.message, {
        recipient: member.recipient,
        data: decodeCampaignSnapshotData(member.data),
        key: campaignMemberSendKey(snapshot, member),
        ...(member.policy === undefined ? {} : { policy: member.policy }),
      });
    } catch (error) {
      const retryable = isRetryable(error);
      await this.store.recordMemberOutcome({
        scope: snapshot.scope,
        snapshotId: snapshot.id,
        memberKey: member.memberKey,
        status: "failed",
        failureCode: errorCode(error),
        retryable,
        recordedAt: this.clock(),
      });
      if (retryable) throw error;
      return;
    }
    await this.store.recordMemberOutcome(
      campaignOutcomeFromSendResult({
        scope: snapshot.scope,
        snapshotId: snapshot.id,
        memberKey: member.memberKey,
        result,
        recordedAt: this.clock(),
      }),
    );
  }

  private async updateProgress(
    executionId: string,
    scope: CampaignScopeRef,
    snapshotId: string,
  ): Promise<void> {
    const progress = await this.store.summarizeSnapshot(scope, snapshotId);
    await this.executions.updateProgress(executionId, {
      current: progress.completed,
      total: progress.total,
      message: `queued=${progress.queued} suppressed=${progress.suppressed} failed=${progress.failed} skipped=${progress.skipped}`,
    });
  }

  private async requireSnapshot(
    campaign: AnyCampaign,
    scope: CampaignScopeRef,
    snapshotId: string,
  ): Promise<CampaignSnapshot> {
    const registered = this.campaigns.resolve(campaign.id);
    if (registered.descriptor.hash !== campaign.descriptor.hash) {
      throw new CampaignDefinitionMismatchProblem(campaign.id, snapshotId);
    }
    const snapshot = await this.store.getSnapshot(scope, snapshotId);
    if (snapshot === undefined) throw new CampaignSnapshotNotFoundProblem(snapshotId, scope);
    if (
      snapshot.campaignId !== campaign.id ||
      snapshot.campaignVersion !== String(campaign.descriptor.version) ||
      snapshot.messageId !== campaign.message.id ||
      snapshot.descriptorFingerprint !== campaign.descriptor.hash
    ) {
      throw new CampaignDefinitionMismatchProblem(campaign.id, snapshotId);
    }
    return snapshot;
  }

  private async result(
    execution: Execution,
    snapshot: CampaignSnapshot,
  ): Promise<CampaignBroadcastResult> {
    return Object.freeze({
      execution,
      snapshot,
      progress: await this.store.summarizeSnapshot(snapshot.scope, snapshot.id),
    });
  }
}

export class CampaignSnapshotCreationProblem extends Problem {
  constructor(snapshotId: string, failureCode: string, cause: Error) {
    super(
      "engagement-core/campaign-snapshot-creation-failed",
      ProblemCategory.InternalServerError,
      `Campaign snapshot ${snapshotId} could not be completed`,
      { cause, extensions: { snapshotId, failureCode, retryable: isRetryable(cause) } },
    );
  }
}

export class CampaignExecutionInvalidProblem extends Problem {
  constructor(detail: string) {
    super("engagement-core/campaign-execution-invalid", ProblemCategory.Conflict, detail, {
      extensions: { retryable: false },
    });
  }
}

export class CampaignExecutionNotReadyProblem extends Problem {
  constructor(executionId: string, scheduledFor: Date) {
    super(
      "engagement-core/campaign-execution-not-ready",
      ProblemCategory.Conflict,
      `Campaign execution ${executionId} is scheduled for ${scheduledFor.toISOString()}`,
      {
        extensions: {
          executionId,
          scheduledFor: scheduledFor.toISOString(),
          retryable: true,
        },
      },
    );
  }
}

export class CampaignDefinitionMismatchProblem extends Problem {
  constructor(campaignId: string, snapshotId: string) {
    super(
      "engagement-core/campaign-definition-mismatch",
      ProblemCategory.Conflict,
      `Campaign ${campaignId} no longer matches snapshot ${snapshotId}`,
      { extensions: { campaignId, snapshotId, retryable: false } },
    );
  }
}

export class CampaignExecutionPublisherMissingProblem extends Problem {
  constructor() {
    super(
      "engagement-core/campaign-execution-publisher-missing",
      ProblemCategory.InternalServerError,
      "Scheduled campaign execution requires an explicit one-shot execution publisher",
      { extensions: { retryable: false } },
    );
  }
}

type CampaignExecutionPayload = Readonly<{
  snapshotId: string;
  scopeKey: string;
  campaignId: string;
  campaignVersion: string;
  descriptorFingerprint: string;
  pageSize: number;
  concurrency: number;
  scheduledFor?: string;
}>;

class CampaignSnapshotReader implements ItemReader<CampaignSnapshotMember>, Checkpointable {
  private afterOrdinal: number | undefined;
  private ended = false;

  constructor(
    private readonly store: CampaignStore,
    private readonly executions: ExecutionManager,
    private readonly executionId: string,
    private readonly scope: CampaignScopeRef,
    private readonly snapshotId: string,
    private readonly pageSize: number,
  ) {}

  async read(): Promise<CampaignSnapshotMember | null> {
    const page = await this.readPage(1);
    return page[0] ?? null;
  }

  async readPage(limit = this.pageSize): Promise<readonly CampaignSnapshotMember[]> {
    if (this.ended) return [];
    const execution = await this.executions.get(this.executionId);
    if (execution.status === "cancelled") {
      this.ended = true;
      return [];
    }
    const page = await this.store.listSnapshotMembers(this.scope, this.snapshotId, {
      ...(this.afterOrdinal === undefined ? {} : { afterOrdinal: this.afterOrdinal }),
      limit,
    });
    const last = page.members.at(-1);
    if (last !== undefined) this.afterOrdinal = last.ordinal;
    if (page.nextOrdinal === undefined) this.ended = true;
    return page.members;
  }

  getCheckpoint(): unknown {
    return { afterOrdinal: this.afterOrdinal ?? -1 };
  }

  restoreCheckpoint(checkpoint: unknown): void {
    if (
      typeof checkpoint !== "object" ||
      checkpoint === null ||
      !("afterOrdinal" in checkpoint) ||
      typeof checkpoint.afterOrdinal !== "number" ||
      !Number.isSafeInteger(checkpoint.afterOrdinal) ||
      checkpoint.afterOrdinal < -1
    ) {
      throw new CampaignExecutionInvalidProblem("Campaign checkpoint is invalid");
    }
    this.afterOrdinal = checkpoint.afterOrdinal === -1 ? undefined : checkpoint.afterOrdinal;
    this.ended = false;
  }
}

function mapSnapshotMember<
  TId extends string,
  TVersion extends string,
  TAudience extends AudienceConstructor,
  TMessage extends AnyMessage,
>(
  campaign: DefinedCampaign<TId, TVersion, TAudience, TMessage>,
  scope: CampaignScopeRef,
  snapshotId: string,
  ordinal: number,
  member: unknown,
): CampaignSnapshotMember {
  let command: EngagementSendCommand<TMessage>;
  try {
    command = campaign.map(member as never);
  } catch (error) {
    return Object.freeze({
      snapshotId,
      scope,
      ordinal,
      memberKey: `${INTERNAL_MEMBER_KEY_PREFIX}mapping-failed/${ordinal}`,
      state: "mapping-failed",
      failureCode: errorCode(error),
    });
  }
  let identity: ReturnType<typeof parseCommandIdentity>;
  try {
    identity = parseCommandIdentity(command, scope);
  } catch (error) {
    if (error instanceof CampaignMapperTenantScopeProblem) throw error;
    return Object.freeze({
      snapshotId,
      scope,
      ordinal,
      memberKey: `${INTERNAL_MEMBER_KEY_PREFIX}mapping-failed/${ordinal}`,
      state: "mapping-failed",
      failureCode: errorCode(error),
    });
  }
  try {
    parseMessageData(campaign.message, command.data);
    const data = encodeCampaignSnapshotData(command.data);
    return Object.freeze({
      snapshotId,
      scope,
      ordinal,
      memberKey: identity.key,
      recipient: identity.recipient,
      state: "ready",
      data,
      ...(identity.policy === undefined ? {} : { policy: identity.policy }),
    });
  } catch (error) {
    return Object.freeze({
      snapshotId,
      scope,
      ordinal,
      memberKey: identity.key,
      recipient: identity.recipient,
      state: "mapping-failed",
      failureCode: errorCode(error),
    });
  }
}

function parseCommandIdentity(
  value: unknown,
  scope: CampaignScopeRef,
): Readonly<{
  recipient: RecipientRef;
  key: string;
  policy?: EngagementDeliveryPolicy;
}> {
  if (typeof value !== "object" || value === null) {
    throw new CampaignExecutionInvalidProblem("Campaign mapper must return an object");
  }
  const recipient = "recipient" in value ? value.recipient : undefined;
  if (typeof recipient !== "object" || recipient === null) {
    throw new CampaignExecutionInvalidProblem("Campaign mapper recipient must be an object");
  }
  const tenantId = "tenantId" in recipient ? recipient.tenantId : undefined;
  const userId = "userId" in recipient ? recipient.userId : undefined;
  if (
    typeof tenantId !== "string" ||
    tenantId.trim().length === 0 ||
    typeof userId !== "string" ||
    userId.trim().length === 0
  ) {
    throw new CampaignExecutionInvalidProblem(
      "Campaign mapper recipient requires tenantId and userId",
    );
  }
  if (scope.kind === "tenant" && tenantId !== scope.tenantId) {
    throw new CampaignMapperTenantScopeProblem();
  }
  const key = "key" in value ? value.key : undefined;
  if (typeof key !== "string" || key.trim().length === 0) {
    throw new CampaignExecutionInvalidProblem("Campaign mapper key must not be empty");
  }
  if (key.startsWith(INTERNAL_MEMBER_KEY_PREFIX)) {
    throw new CampaignExecutionInvalidProblem(
      `Campaign mapper key must not use the reserved ${INTERNAL_MEMBER_KEY_PREFIX} prefix`,
    );
  }
  const policy = "policy" in value ? value.policy : undefined;
  if (policy !== undefined && policy !== "first-reachable" && policy !== "all-reachable") {
    throw new CampaignExecutionInvalidProblem("Campaign mapper policy is invalid");
  }
  return Object.freeze({
    recipient: Object.freeze({ tenantId, userId }),
    key,
    ...(policy === undefined ? {} : { policy }),
  });
}

class CampaignMapperTenantScopeProblem extends CampaignExecutionInvalidProblem {
  constructor() {
    super("Campaign mapper crossed tenant scope");
  }
}

async function estimateAudience(
  source: Readonly<{
    estimate?(context: AudienceContext): number | Promise<number>;
  }>,
  context: AudienceContext,
): Promise<number | undefined> {
  if (source.estimate === undefined) return undefined;
  const estimate = await source.estimate(context);
  if (!Number.isSafeInteger(estimate) || estimate < 0) {
    throw new CampaignExecutionInvalidProblem("Audience estimate must be a non-negative integer");
  }
  return estimate;
}

function scopeForCampaign(campaign: AnyCampaign, context: AudienceContext): CampaignScopeRef {
  if (campaign.descriptor.audienceScope === "global") return Object.freeze({ kind: "global" });
  if (context.tenantId === undefined || context.tenantId.trim().length === 0) {
    throw new CampaignExecutionInvalidProblem(
      `Campaign ${campaign.id} requires a tenant-scoped audience context`,
    );
  }
  return campaignScopeForTenant(context.tenantId);
}

function parseExecutionPayload(execution: Execution): CampaignExecutionPayload {
  if (execution.type !== CAMPAIGN_EXECUTION_TYPE) {
    throw new CampaignExecutionInvalidProblem(
      `Execution ${execution.id} is not a campaign broadcast`,
    );
  }
  const payload = execution.payload;
  if (typeof payload !== "object" || payload === null) {
    throw new CampaignExecutionInvalidProblem("Campaign execution payload must be an object");
  }
  const record = payload as Record<string, unknown>;
  const requiredStrings = [
    "snapshotId",
    "scopeKey",
    "campaignId",
    "campaignVersion",
    "descriptorFingerprint",
  ] as const;
  for (const key of requiredStrings) {
    if (!(key in record) || typeof record[key] !== "string" || record[key].length === 0) {
      throw new CampaignExecutionInvalidProblem(`Campaign execution payload ${key} is invalid`);
    }
  }
  const pageSize = "pageSize" in record ? record.pageSize : undefined;
  const concurrency = "concurrency" in record ? record.concurrency : undefined;
  assertExecutionBounds(pageSize, concurrency);
  const scheduledFor = "scheduledFor" in record ? record.scheduledFor : undefined;
  if (
    scheduledFor !== undefined &&
    (typeof scheduledFor !== "string" ||
      Number.isNaN(new Date(scheduledFor).getTime()) ||
      new Date(scheduledFor).toISOString() !== scheduledFor)
  ) {
    throw new CampaignExecutionInvalidProblem("Campaign execution payload scheduledFor is invalid");
  }
  return payload as CampaignExecutionPayload;
}

function scopeFromKey(scopeKey: string): CampaignScopeRef {
  if (scopeKey === "global") return Object.freeze({ kind: "global" });
  if (!scopeKey.startsWith("tenant:")) {
    throw new CampaignExecutionInvalidProblem("Campaign execution scope is invalid");
  }
  let tenantId: string;
  try {
    tenantId = decodeURIComponent(scopeKey.slice("tenant:".length));
  } catch {
    throw new CampaignExecutionInvalidProblem("Campaign execution tenant scope is invalid");
  }
  return campaignScopeForTenant(tenantId);
}

async function processWithConcurrency<T>(
  values: readonly T[],
  concurrency: number,
  process: (value: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await process(values[currentIndex] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
}

function campaignMemberSendKey(snapshot: CampaignSnapshot, member: CampaignSnapshotMember): string {
  return [
    "campaign",
    campaignScopeKey(snapshot.scope),
    snapshot.campaignId,
    snapshot.campaignVersion,
    snapshot.messageId,
    "snapshot",
    snapshot.id,
    "member",
    member.memberKey,
  ]
    .map(encodeURIComponent)
    .join(":");
}

function campaignExecutionIdempotencyKey(snapshot: CampaignSnapshot): string {
  return [
    "engagement-campaign",
    campaignScopeKey(snapshot.scope),
    snapshot.campaignId,
    snapshot.campaignVersion,
    snapshot.messageId,
    snapshot.id,
  ]
    .map(encodeURIComponent)
    .join(":");
}

function assertExecutionBounds(pageSize: unknown, concurrency: unknown): void {
  assertPositiveSafeInteger("pageSize", pageSize ?? DEFAULT_BROADCAST_PAGE_SIZE);
  assertPositiveSafeInteger("concurrency", concurrency ?? DEFAULT_BROADCAST_CONCURRENCY);
  const normalizedPageSize = pageSize ?? DEFAULT_BROADCAST_PAGE_SIZE;
  const normalizedConcurrency = concurrency ?? DEFAULT_BROADCAST_CONCURRENCY;
  if ((normalizedConcurrency as number) > (normalizedPageSize as number)) {
    throw new CampaignExecutionInvalidProblem("concurrency must not exceed pageSize");
  }
}

function assertPositiveSafeInteger(name: string, value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new CampaignExecutionInvalidProblem(`${name} must be a positive integer`);
  }
}

function errorCode(error: unknown): string {
  return error instanceof Problem ? error.code : "engagement-core/campaign-operation-failed";
}

function isRetryable(error: unknown): boolean {
  return !(error instanceof Problem) || error.extensions?.retryable === true;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function attachFailureRecordError(error: unknown, failureRecordError: unknown): void {
  if (typeof error !== "object" || error === null) return;
  try {
    Object.defineProperty(error, "campaignFailureRecordError", {
      configurable: true,
      enumerable: false,
      value: failureRecordError,
    });
  } catch {
    return;
  }
}
