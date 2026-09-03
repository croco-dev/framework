import {
  CampaignSnapshotIncompleteProblem,
  CampaignSnapshotNotFoundProblem,
  CampaignStoreConflictProblem,
  CampaignStoreValidationProblem,
  EngagementPersistenceProblem,
  campaignScopeForTenant,
  campaignScopeKey,
  type AppendCampaignSnapshotMembersInput,
  type CampaignMemberOutcome,
  type CampaignProgress,
  type CampaignScopeRef,
  type CampaignSnapshot,
  type CampaignSnapshotMember,
  type CampaignSnapshotMemberPage,
  type CampaignStore,
  type CompleteCampaignSnapshotInput,
  type CreateCampaignSnapshotInput,
  type FailCampaignSnapshotInput,
  type ListCampaignSnapshotMembersOptions,
  type RecordCampaignMemberOutcomeInput,
} from "@croco/engagement-core";
import { Problem } from "@croco/problems-core";
import type { TxManager } from "@croco/tx-core";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  engagementCampaignMemberOutcomes,
  engagementCampaignSnapshotMembers,
  engagementCampaignSnapshots,
  type EngagementCampaignMemberOutcomeRow,
  type EngagementCampaignSnapshotMemberRow,
  type EngagementCampaignSnapshotRow,
} from "./schema";

const campaignSchema = {
  engagementCampaignMemberOutcomes,
  engagementCampaignSnapshotMembers,
  engagementCampaignSnapshots,
};

export type DrizzleCampaignClient = NodePgDatabase<typeof campaignSchema>;
type DrizzleCampaignTransaction = Parameters<
  Parameters<DrizzleCampaignClient["transaction"]>[0]
>[0];
export type DrizzleCampaignTxManager = Pick<
  TxManager<DrizzleCampaignTransaction>,
  "getClient" | "run"
>;
type DrizzleCampaignQueryable = DrizzleCampaignClient | DrizzleCampaignTransaction;

/** PostgreSQL-backed campaign snapshot and execution outcome store. */
export class DrizzleCampaignStore implements CampaignStore {
  constructor(
    private readonly db: DrizzleCampaignClient,
    private readonly txManager: DrizzleCampaignTxManager,
  ) {}

  async createSnapshot(input: CreateCampaignSnapshotInput): Promise<CampaignSnapshot> {
    assertSnapshotInput(input);
    const scopeKey = campaignScopeKey(input.scope);
    return this.persist("create-campaign-snapshot", input.scope, async () => {
      const rows = await this.client()
        .insert(engagementCampaignSnapshots)
        .values({
          scopeKey,
          id: input.id,
          audienceId: input.audienceId,
          campaignId: input.campaignId,
          campaignVersion: input.campaignVersion,
          messageId: input.messageId,
          descriptorFingerprint: input.descriptorFingerprint,
          state: "building",
          memberCount: 0,
          createdAt: input.createdAt,
          completedAt: null,
          failureCode: null,
        })
        .onConflictDoNothing({
          target: [engagementCampaignSnapshots.scopeKey, engagementCampaignSnapshots.id],
        })
        .returning();
      const row = rows[0];
      if (row === undefined) {
        throw new CampaignStoreConflictProblem("snapshot-already-exists", input.id);
      }
      return mapSnapshot(row);
    });
  }

  async appendSnapshotMembers(
    input: AppendCampaignSnapshotMembersInput,
  ): Promise<CampaignSnapshot> {
    const scopeKey = campaignScopeKey(input.scope);
    return this.persist("append-campaign-snapshot-members", input.scope, () =>
      this.txManager.run(async () => {
        const client = this.client();
        const snapshot = await this.requireSnapshot(client, input.scope, input.snapshotId, true);
        if (snapshot.state !== "building") {
          throw new CampaignStoreConflictProblem("snapshot-is-immutable", input.snapshotId);
        }
        if (input.expectedStartOrdinal !== snapshot.memberCount) {
          throw new CampaignStoreConflictProblem(
            "snapshot-append-position-mismatch",
            input.snapshotId,
          );
        }

        const seen = new Set<string>();
        for (const [index, member] of input.members.entries()) {
          assertMember(member, input.scope, input.snapshotId, input.expectedStartOrdinal + index);
          if (seen.has(member.memberKey)) {
            throw new CampaignStoreConflictProblem("duplicate-member-key", input.snapshotId);
          }
          seen.add(member.memberKey);
        }

        if (input.members.length > 0) {
          const existing = await client
            .select({ memberKey: engagementCampaignSnapshotMembers.memberKey })
            .from(engagementCampaignSnapshotMembers)
            .where(
              and(
                eq(engagementCampaignSnapshotMembers.scopeKey, scopeKey),
                eq(engagementCampaignSnapshotMembers.snapshotId, input.snapshotId),
                inArray(
                  engagementCampaignSnapshotMembers.memberKey,
                  input.members.map((member) => member.memberKey),
                ),
              ),
            );
          const existingKeys = new Set(existing.map((row) => row.memberKey));
          const duplicate = input.members.find((member) => existingKeys.has(member.memberKey));
          if (duplicate !== undefined) {
            throw new CampaignStoreConflictProblem("duplicate-member-key", input.snapshotId);
          }

          await client.insert(engagementCampaignSnapshotMembers).values(
            input.members.map((member) => ({
              scopeKey,
              snapshotId: input.snapshotId,
              ordinal: member.ordinal,
              memberKey: member.memberKey,
              recipient: member.recipient ?? null,
              state: member.state,
              data: member.state === "ready" ? member.data : null,
              policy: member.state === "ready" ? (member.policy ?? null) : null,
              failureCode: member.state === "mapping-failed" ? member.failureCode : null,
            })),
          );
        }

        const updated = await client
          .update(engagementCampaignSnapshots)
          .set({ memberCount: snapshot.memberCount + input.members.length })
          .where(
            and(
              eq(engagementCampaignSnapshots.scopeKey, scopeKey),
              eq(engagementCampaignSnapshots.id, input.snapshotId),
            ),
          )
          .returning();
        return mapSnapshot(requiredRow(updated[0], "updated campaign snapshot"));
      }),
    );
  }

  async completeSnapshot(input: CompleteCampaignSnapshotInput): Promise<CampaignSnapshot> {
    const scopeKey = campaignScopeKey(input.scope);
    return this.persist("complete-campaign-snapshot", input.scope, () =>
      this.txManager.run(async () => {
        const client = this.client();
        const snapshot = await this.requireSnapshot(client, input.scope, input.snapshotId, true);
        if (snapshot.state !== "building") {
          throw new CampaignStoreConflictProblem("snapshot-cannot-complete", input.snapshotId);
        }
        if (input.expectedMemberCount !== snapshot.memberCount) {
          throw new CampaignStoreConflictProblem(
            "snapshot-member-count-mismatch",
            input.snapshotId,
          );
        }
        assertDate(input.completedAt, "Campaign snapshot completion time");
        const rows = await client
          .update(engagementCampaignSnapshots)
          .set({ state: "complete", completedAt: input.completedAt })
          .where(snapshotIdentity(scopeKey, input.snapshotId))
          .returning();
        return mapSnapshot(requiredRow(rows[0], "completed campaign snapshot"));
      }),
    );
  }

  async failSnapshot(input: FailCampaignSnapshotInput): Promise<CampaignSnapshot> {
    const scopeKey = campaignScopeKey(input.scope);
    return this.persist("fail-campaign-snapshot", input.scope, () =>
      this.txManager.run(async () => {
        const client = this.client();
        const snapshot = await this.requireSnapshot(client, input.scope, input.snapshotId, true);
        if (snapshot.state === "complete") {
          throw new CampaignStoreConflictProblem(
            "completed-snapshot-cannot-fail",
            input.snapshotId,
          );
        }
        if (snapshot.state === "failed") return snapshot;
        assertText(input.failureCode, "Campaign snapshot failure code");
        assertDate(input.completedAt, "Campaign snapshot failure time");
        const rows = await client
          .update(engagementCampaignSnapshots)
          .set({
            state: "failed",
            completedAt: input.completedAt,
            failureCode: input.failureCode,
          })
          .where(snapshotIdentity(scopeKey, input.snapshotId))
          .returning();
        return mapSnapshot(requiredRow(rows[0], "failed campaign snapshot"));
      }),
    );
  }

  async getSnapshot(
    scope: CampaignScopeRef,
    snapshotId: string,
  ): Promise<CampaignSnapshot | undefined> {
    const scopeKey = campaignScopeKey(scope);
    return this.persist("get-campaign-snapshot", scope, async () => {
      const rows = await this.client()
        .select()
        .from(engagementCampaignSnapshots)
        .where(snapshotIdentity(scopeKey, snapshotId))
        .limit(1);
      return rows[0] === undefined ? undefined : mapSnapshot(rows[0]);
    });
  }

  async listSnapshotMembers(
    scope: CampaignScopeRef,
    snapshotId: string,
    options: ListCampaignSnapshotMembersOptions,
  ): Promise<CampaignSnapshotMemberPage> {
    assertPage(options);
    const scopeKey = campaignScopeKey(scope);
    return this.persist("list-campaign-snapshot-members", scope, async () => {
      const client = this.client();
      const snapshot = await this.requireSnapshot(client, scope, snapshotId, false);
      if (snapshot.state !== "complete") {
        throw new CampaignSnapshotIncompleteProblem(snapshotId, snapshot.state);
      }
      const rows = await client
        .select()
        .from(engagementCampaignSnapshotMembers)
        .where(
          and(
            eq(engagementCampaignSnapshotMembers.scopeKey, scopeKey),
            eq(engagementCampaignSnapshotMembers.snapshotId, snapshotId),
            options.afterOrdinal === undefined
              ? undefined
              : gt(engagementCampaignSnapshotMembers.ordinal, options.afterOrdinal),
          ),
        )
        .orderBy(asc(engagementCampaignSnapshotMembers.ordinal))
        .limit(options.limit + 1);
      const pageRows = rows.slice(0, options.limit);
      const members = pageRows.map((row) => mapMember(row, scope));
      const last = members.at(-1);
      return {
        members,
        ...(rows.length > options.limit && last !== undefined ? { nextOrdinal: last.ordinal } : {}),
      };
    });
  }

  async getMemberOutcome(
    scope: CampaignScopeRef,
    snapshotId: string,
    memberKey: string,
  ): Promise<CampaignMemberOutcome | undefined> {
    const scopeKey = campaignScopeKey(scope);
    return this.persist("get-campaign-member-outcome", scope, async () => {
      await this.requireSnapshot(this.client(), scope, snapshotId, false);
      const rows = await this.client()
        .select()
        .from(engagementCampaignMemberOutcomes)
        .where(outcomeIdentity(scopeKey, snapshotId, memberKey))
        .limit(1);
      return rows[0] === undefined ? undefined : mapOutcome(rows[0], scope);
    });
  }

  async recordMemberOutcome(
    input: RecordCampaignMemberOutcomeInput,
  ): Promise<CampaignMemberOutcome> {
    assertOutcome(input);
    const scopeKey = campaignScopeKey(input.scope);
    return this.persist("record-campaign-member-outcome", input.scope, () =>
      this.txManager.run(async () => {
        const client = this.client();
        const snapshot = await this.requireSnapshot(client, input.scope, input.snapshotId, true);
        if (snapshot.state !== "complete") {
          throw new CampaignSnapshotIncompleteProblem(input.snapshotId, snapshot.state);
        }
        const members = await client
          .select({ memberKey: engagementCampaignSnapshotMembers.memberKey })
          .from(engagementCampaignSnapshotMembers)
          .where(
            and(
              eq(engagementCampaignSnapshotMembers.scopeKey, scopeKey),
              eq(engagementCampaignSnapshotMembers.snapshotId, input.snapshotId),
              eq(engagementCampaignSnapshotMembers.memberKey, input.memberKey),
            ),
          )
          .for("update")
          .limit(1);
        if (members[0] === undefined) {
          throw new CampaignStoreValidationProblem(
            `Snapshot ${input.snapshotId} does not contain the requested member`,
          );
        }

        const existingRows = await client
          .select()
          .from(engagementCampaignMemberOutcomes)
          .where(outcomeIdentity(scopeKey, input.snapshotId, input.memberKey))
          .limit(1);
        const existing = existingRows[0];
        if (
          existing !== undefined &&
          (existing.outcome.status !== "failed" ||
            existing.outcome.retryable !== true ||
            (input.status === "failed" && input.retryable))
        ) {
          return mapOutcome(existing, input.scope);
        }

        const values = {
          scopeKey,
          snapshotId: input.snapshotId,
          memberKey: input.memberKey,
          outcome: {
            status: input.status,
            ...(input.executionIds === undefined ? {} : { executionIds: input.executionIds }),
            ...(input.reason === undefined ? {} : { reason: input.reason }),
            ...(input.failureCode === undefined ? {} : { failureCode: input.failureCode }),
            ...(input.retryable === undefined ? {} : { retryable: input.retryable }),
          },
          recordedAt: input.recordedAt,
        };
        const rows =
          existing === undefined
            ? await client.insert(engagementCampaignMemberOutcomes).values(values).returning()
            : await client
                .update(engagementCampaignMemberOutcomes)
                .set(values)
                .where(outcomeIdentity(scopeKey, input.snapshotId, input.memberKey))
                .returning();
        return mapOutcome(requiredRow(rows[0], "recorded campaign outcome"), input.scope);
      }),
    );
  }

  async summarizeSnapshot(scope: CampaignScopeRef, snapshotId: string): Promise<CampaignProgress> {
    const scopeKey = campaignScopeKey(scope);
    return this.persist("summarize-campaign-snapshot", scope, async () => {
      const snapshot = await this.requireSnapshot(this.client(), scope, snapshotId, false);
      const rows = await this.client()
        .select({
          queued: sql<number>`count(*) filter (where ${engagementCampaignMemberOutcomes.outcome} ->> 'status' = 'queued')::integer`,
          suppressed: sql<number>`count(*) filter (where ${engagementCampaignMemberOutcomes.outcome} ->> 'status' = 'suppressed')::integer`,
          failed: sql<number>`count(*) filter (where ${engagementCampaignMemberOutcomes.outcome} ->> 'status' = 'failed')::integer`,
          skipped: sql<number>`count(*) filter (where ${engagementCampaignMemberOutcomes.outcome} ->> 'status' = 'skipped')::integer`,
        })
        .from(engagementCampaignMemberOutcomes)
        .where(
          and(
            eq(engagementCampaignMemberOutcomes.scopeKey, scopeKey),
            eq(engagementCampaignMemberOutcomes.snapshotId, snapshotId),
          ),
        );
      const aggregate = rows[0];
      const counts = {
        queued: aggregate?.queued ?? 0,
        suppressed: aggregate?.suppressed ?? 0,
        failed: aggregate?.failed ?? 0,
        skipped: aggregate?.skipped ?? 0,
      };
      const completed = counts.queued + counts.suppressed + counts.failed + counts.skipped;
      return {
        total: snapshot.memberCount,
        completed,
        ...counts,
        pending: Math.max(0, snapshot.memberCount - completed),
      };
    });
  }

  private client(): DrizzleCampaignQueryable {
    return this.txManager.getClient() ?? this.db;
  }

  private async requireSnapshot(
    client: DrizzleCampaignQueryable,
    scope: CampaignScopeRef,
    snapshotId: string,
    lock: boolean,
  ): Promise<CampaignSnapshot> {
    const query = client
      .select()
      .from(engagementCampaignSnapshots)
      .where(snapshotIdentity(campaignScopeKey(scope), snapshotId));
    const rows = lock ? await query.for("update").limit(1) : await query.limit(1);
    if (rows[0] === undefined) throw new CampaignSnapshotNotFoundProblem(snapshotId, scope);
    return mapSnapshot(rows[0]);
  }

  private async persist<TResult>(
    operation: string,
    scope: CampaignScopeRef,
    action: () => Promise<TResult>,
  ): Promise<TResult> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof Problem) throw error;
      throw new EngagementPersistenceProblem(
        operation,
        scope.kind === "tenant" ? scope.tenantId : "global",
        normalizeError(error),
      );
    }
  }
}

function snapshotIdentity(scopeKey: string, snapshotId: string) {
  return and(
    eq(engagementCampaignSnapshots.scopeKey, scopeKey),
    eq(engagementCampaignSnapshots.id, snapshotId),
  );
}

function outcomeIdentity(scopeKey: string, snapshotId: string, memberKey: string) {
  return and(
    eq(engagementCampaignMemberOutcomes.scopeKey, scopeKey),
    eq(engagementCampaignMemberOutcomes.snapshotId, snapshotId),
    eq(engagementCampaignMemberOutcomes.memberKey, memberKey),
  );
}

function mapSnapshot(row: EngagementCampaignSnapshotRow): CampaignSnapshot {
  return {
    id: row.id,
    scope: scopeFromKey(row.scopeKey),
    audienceId: row.audienceId,
    campaignId: row.campaignId,
    campaignVersion: row.campaignVersion,
    messageId: row.messageId,
    descriptorFingerprint: row.descriptorFingerprint,
    state: row.state,
    memberCount: row.memberCount,
    createdAt: new Date(row.createdAt),
    ...(row.completedAt === null ? {} : { completedAt: new Date(row.completedAt) }),
    ...(row.failureCode === null ? {} : { failureCode: row.failureCode }),
  };
}

function mapMember(
  row: EngagementCampaignSnapshotMemberRow,
  scope: CampaignScopeRef,
): CampaignSnapshotMember {
  const base = {
    snapshotId: row.snapshotId,
    scope,
    ordinal: row.ordinal,
    memberKey: row.memberKey,
  };
  if (row.state === "mapping-failed") {
    return {
      ...base,
      state: "mapping-failed",
      ...(row.recipient === null ? {} : { recipient: row.recipient }),
      failureCode: requiredText(row.failureCode, "mapping failure code"),
    };
  }
  if (row.recipient === null || row.data === null) {
    throw new CampaignStoreValidationProblem("Stored ready campaign member payload is incomplete");
  }
  return {
    ...base,
    state: "ready",
    recipient: row.recipient,
    data: row.data,
    ...(row.policy === null ? {} : { policy: row.policy }),
  };
}

function mapOutcome(
  row: EngagementCampaignMemberOutcomeRow,
  scope: CampaignScopeRef,
): CampaignMemberOutcome {
  const base = {
    snapshotId: row.snapshotId,
    scope,
    memberKey: row.memberKey,
    ...(row.outcome.executionIds === undefined ? {} : { executionIds: row.outcome.executionIds }),
    ...(row.outcome.reason === undefined ? {} : { reason: row.outcome.reason }),
    recordedAt: new Date(row.recordedAt),
  };
  if (row.outcome.status === "failed") {
    if (typeof row.outcome.retryable !== "boolean") {
      throw new CampaignStoreValidationProblem(
        "Stored campaign outcome retryable state is invalid",
      );
    }
    return {
      ...base,
      status: "failed",
      failureCode: requiredText(row.outcome.failureCode ?? null, "campaign outcome failure code"),
      retryable: row.outcome.retryable,
    };
  }
  return {
    ...base,
    status: row.outcome.status,
  };
}

function scopeFromKey(scopeKey: string): CampaignScopeRef {
  if (scopeKey === "global") return { kind: "global" };
  if (!scopeKey.startsWith("tenant:")) {
    throw new CampaignStoreValidationProblem("Stored campaign scope key is invalid");
  }
  try {
    return campaignScopeForTenant(decodeURIComponent(scopeKey.slice("tenant:".length)));
  } catch {
    throw new CampaignStoreValidationProblem("Stored campaign tenant scope key is invalid");
  }
}

function assertSnapshotInput(input: CreateCampaignSnapshotInput): void {
  assertText(input.id, "Campaign snapshot id");
  assertText(input.audienceId, "Campaign audience id");
  assertText(input.campaignId, "Campaign id");
  assertText(input.campaignVersion, "Campaign version");
  assertText(input.messageId, "Campaign message id");
  assertText(input.descriptorFingerprint, "Campaign descriptor fingerprint");
  if (input.scope.kind === "tenant") assertText(input.scope.tenantId, "Campaign tenant scope");
  assertDate(input.createdAt, "Campaign snapshot creation time");
}

function assertMember(
  member: CampaignSnapshotMember,
  scope: CampaignScopeRef,
  snapshotId: string,
  ordinal: number,
): void {
  if (
    member.snapshotId !== snapshotId ||
    campaignScopeKey(member.scope) !== campaignScopeKey(scope)
  ) {
    throw new CampaignStoreValidationProblem("Campaign snapshot member scope or id is invalid");
  }
  if (member.ordinal !== ordinal) {
    throw new CampaignStoreValidationProblem("Campaign snapshot member ordinal is not contiguous");
  }
  assertText(member.memberKey, "Campaign snapshot member key");
  if (
    scope.kind === "tenant" &&
    member.recipient !== undefined &&
    member.recipient.tenantId !== scope.tenantId
  ) {
    throw new CampaignStoreValidationProblem("Campaign snapshot member crossed tenant scope");
  }
  if (member.state === "mapping-failed") {
    assertText(member.failureCode, "Campaign snapshot member failure code");
  }
}

function assertOutcome(input: CampaignMemberOutcome): void {
  assertText(input.memberKey, "Campaign outcome member key");
  assertDate(input.recordedAt, "Campaign outcome time");
  if (input.status === "failed") {
    assertText(input.failureCode, "Campaign outcome failure code");
    if (typeof input.retryable !== "boolean") {
      throw new CampaignStoreValidationProblem("Campaign outcome retryable state must be explicit");
    }
  }
}

function assertPage(options: ListCampaignSnapshotMembersOptions): void {
  if (!Number.isSafeInteger(options.limit) || options.limit <= 0) {
    throw new CampaignStoreValidationProblem("Campaign page limit must be a positive integer");
  }
  if (
    options.afterOrdinal !== undefined &&
    (!Number.isSafeInteger(options.afterOrdinal) || options.afterOrdinal < 0)
  ) {
    throw new CampaignStoreValidationProblem("afterOrdinal must be a non-negative integer");
  }
}

function assertText(value: string, field: string): void {
  if (value.trim().length === 0)
    throw new CampaignStoreValidationProblem(`${field} must not be empty`);
}

function assertDate(value: Date, field: string): void {
  if (Number.isNaN(value.getTime()))
    throw new CampaignStoreValidationProblem(`${field} is invalid`);
}

function requiredText(value: string | null, field: string): string {
  if (value === null)
    throw new CampaignStoreValidationProblem(`Stored campaign ${field} is missing`);
  return value;
}

function requiredRow<TRow>(row: TRow | undefined, label: string): TRow {
  if (row === undefined) throw new CampaignStoreValidationProblem(`Expected ${label}`);
  return row;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
