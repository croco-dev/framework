import {
  assertEngagementPreference,
  assertEngagementStoreText,
  assertEngagementSuppression,
  createEngagementDeliveryEventId,
  createEngagementDispatchId,
  createEngagementDispatchIdentityKey,
  normalizeEngagementEvidence,
  EngagementPersistenceProblem,
  EngagementStoreValidationProblem,
  type ContactEndpoint,
  type ContactEndpointInvalidationResult,
  type EngagementDeliveryEvent,
  type EngagementDeliveryEventRecordResult,
  type EngagementDispatch,
  type EngagementDispatchHistoryPage,
  type EngagementDispatchIdentity,
  type EngagementPersistence,
  type EngagementPreference,
  type EngagementPreferenceLookup,
  type EngagementStoreTransaction,
  type EngagementSuppression,
  type EngagementSuppressionLookup,
  type InvalidateContactEndpointInput,
  type RecordEngagementDeliveryEventInput,
  type RecordEngagementDispatchInput,
  type SaveContactEndpointInput,
} from "@croco/engagement-core";
import { Problem } from "@croco/problems-core";
import type { TxManager } from "@croco/tx-core";
import { and, asc, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  engagementContactEndpoints,
  engagementDeliveryEvents,
  engagementDispatchTargets,
  engagementDispatches,
  engagementPreferences,
  engagementSuppressions,
  type EngagementContactEndpointRow,
  type EngagementDeliveryEventRow,
  type EngagementDispatchRow,
  type EngagementDispatchTargetRow,
} from "./schema";

const schema = {
  engagementContactEndpoints,
  engagementDeliveryEvents,
  engagementDispatchTargets,
  engagementDispatches,
  engagementPreferences,
  engagementSuppressions,
};

export type DrizzleEngagementClient = NodePgDatabase<typeof schema>;
type DrizzleEngagementTransaction = Parameters<
  Parameters<DrizzleEngagementClient["transaction"]>[0]
>[0];
export type DrizzleEngagementTxManager = Pick<
  TxManager<DrizzleEngagementTransaction>,
  "getClient" | "run"
>;
type DrizzleEngagementQueryable = DrizzleEngagementClient | DrizzleEngagementTransaction;

/** PostgreSQL-backed implementation of every engagement persistence contract. */
export class DrizzleEngagementStore implements EngagementPersistence {
  constructor(
    private readonly db: DrizzleEngagementClient,
    private readonly txManager: DrizzleEngagementTxManager,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async saveEndpoint(input: SaveContactEndpointInput): Promise<ContactEndpoint> {
    assertEndpoint(input);
    return this.persist("save-endpoint", input.tenantId, async () => {
      const now = this.clock();
      const common = {
        tenantId: input.tenantId,
        id: input.id,
        recipientId: input.recipientId,
        kind: input.kind,
        lastSeenAt: input.lastSeenAt,
        invalidatedAt: null,
        invalidationReason: null,
        updatedAt: now,
      };
      const values =
        input.kind === "email"
          ? {
              ...common,
              address: input.address,
              provider: null,
              app: null,
              platform: null,
              environment: null,
              tokenReference: null,
              version: 1,
              createdAt: now,
            }
          : {
              ...common,
              address: null,
              provider: input.provider,
              app: input.app,
              platform: input.platform,
              environment: input.environment,
              tokenReference: input.tokenReference,
              version: 1,
              createdAt: now,
            };
      const rows = await this.client()
        .insert(engagementContactEndpoints)
        .values(values)
        .onConflictDoUpdate({
          target: [engagementContactEndpoints.tenantId, engagementContactEndpoints.id],
          set: {
            recipientId: input.recipientId,
            kind: input.kind,
            address: input.kind === "email" ? input.address : null,
            provider: input.kind === "push" ? input.provider : null,
            app: input.kind === "push" ? input.app : null,
            platform: input.kind === "push" ? input.platform : null,
            environment: input.kind === "push" ? input.environment : null,
            tokenReference: input.kind === "push" ? input.tokenReference : null,
            lastSeenAt: input.lastSeenAt,
            version: sql`${engagementContactEndpoints.version} + 1`,
            updatedAt: now,
          },
        })
        .returning();
      return mapEndpoint(requiredRow(rows[0], "saved endpoint"));
    });
  }

  async getEndpoint(tenantId: string, endpointId: string): Promise<ContactEndpoint | undefined> {
    return this.persist("get-endpoint", tenantId, async () => {
      const rows = await this.client()
        .select()
        .from(engagementContactEndpoints)
        .where(
          and(
            eq(engagementContactEndpoints.tenantId, tenantId),
            eq(engagementContactEndpoints.id, endpointId),
          ),
        )
        .limit(1);
      return rows[0] === undefined ? undefined : mapEndpoint(rows[0]);
    });
  }

  async listActiveEndpoints(
    tenantId: string,
    recipientId: string,
  ): Promise<readonly ContactEndpoint[]> {
    return this.persist("list-active-endpoints", tenantId, async () => {
      const rows = await this.client()
        .select()
        .from(engagementContactEndpoints)
        .where(
          and(
            eq(engagementContactEndpoints.tenantId, tenantId),
            eq(engagementContactEndpoints.recipientId, recipientId),
            isNull(engagementContactEndpoints.invalidatedAt),
          ),
        )
        .orderBy(asc(engagementContactEndpoints.kind), asc(engagementContactEndpoints.id));
      return rows.map(mapEndpoint);
    });
  }

  async invalidateEndpoint(
    input: InvalidateContactEndpointInput,
  ): Promise<ContactEndpointInvalidationResult> {
    return this.persist("invalidate-endpoint", input.tenantId, async () => {
      const rows = await this.client()
        .update(engagementContactEndpoints)
        .set({
          invalidatedAt: input.invalidatedAt,
          invalidationReason: input.reason,
          version: sql`${engagementContactEndpoints.version} + 1`,
          updatedAt: input.invalidatedAt,
        })
        .where(
          and(
            eq(engagementContactEndpoints.tenantId, input.tenantId),
            eq(engagementContactEndpoints.id, input.endpointId),
            eq(engagementContactEndpoints.version, input.expectedVersion),
            isNull(engagementContactEndpoints.invalidatedAt),
          ),
        )
        .returning();
      if (rows[0] !== undefined) {
        return { status: "invalidated", endpoint: mapEndpoint(rows[0]) };
      }

      const current = await this.getEndpoint(input.tenantId, input.endpointId);
      if (current === undefined) return { status: "not-found" };
      return current.invalidatedAt === undefined
        ? { status: "version-mismatch", endpoint: current }
        : { status: "already-invalid", endpoint: current };
    });
  }

  async setPreference(preference: EngagementPreference): Promise<void> {
    assertEngagementPreference(preference);
    const evidence = normalizeEngagementEvidence(preference.evidence);
    return this.persist("set-preference", preference.tenantId, async () => {
      const recipientKey = preference.recipientId ?? "";
      await this.client()
        .insert(engagementPreferences)
        .values({
          tenantId: preference.tenantId,
          scope: preference.scope,
          recipientKey,
          topic: preference.topic,
          channel: preference.channel,
          state: preference.state,
          source: preference.source,
          changedAt: preference.changedAt,
          evidence: evidence ?? null,
        })
        .onConflictDoUpdate({
          target: [
            engagementPreferences.tenantId,
            engagementPreferences.scope,
            engagementPreferences.recipientKey,
            engagementPreferences.topic,
            engagementPreferences.channel,
          ],
          set: {
            state: preference.state,
            source: preference.source,
            changedAt: preference.changedAt,
            evidence: evidence ?? null,
          },
        });
    });
  }

  async resolvePreference(
    input: EngagementPreferenceLookup,
  ): Promise<EngagementPreference | undefined> {
    return this.persist("resolve-preference", input.tenantId, async () => {
      const rows = await this.client()
        .select()
        .from(engagementPreferences)
        .where(
          and(
            eq(engagementPreferences.tenantId, input.tenantId),
            eq(engagementPreferences.topic, input.topic),
            eq(engagementPreferences.channel, input.channel),
            or(
              and(
                eq(engagementPreferences.scope, "recipient"),
                eq(engagementPreferences.recipientKey, input.recipientId),
              ),
              and(
                eq(engagementPreferences.scope, "tenant"),
                eq(engagementPreferences.recipientKey, ""),
              ),
            ),
          ),
        )
        .orderBy(sql`case when ${engagementPreferences.scope} = 'recipient' then 0 else 1 end`)
        .limit(1);
      const row = rows[0];
      if (row === undefined) return undefined;
      return {
        tenantId: row.tenantId,
        scope: row.scope,
        ...(row.scope === "recipient" ? { recipientId: row.recipientKey } : {}),
        topic: row.topic,
        channel: row.channel,
        state: row.state,
        source: row.source,
        changedAt: new Date(row.changedAt),
        ...(row.evidence === null ? {} : { evidence: normalizeEngagementEvidence(row.evidence) }),
      };
    });
  }

  async saveSuppression(suppression: EngagementSuppression): Promise<void> {
    assertEngagementSuppression(suppression);
    const evidence = normalizeEngagementEvidence(suppression.evidence);
    return this.persist("save-suppression", suppression.tenantId, async () => {
      await this.client()
        .insert(engagementSuppressions)
        .values({
          tenantId: suppression.tenantId,
          id: suppression.id,
          recipientId: suppression.recipientId ?? null,
          endpointId: suppression.endpointId ?? null,
          channel: suppression.channel,
          topic: suppression.topic ?? null,
          reason: suppression.reason,
          source: suppression.source,
          createdAt: suppression.createdAt,
          expiresAt: suppression.expiresAt ?? null,
          evidence: evidence ?? null,
        })
        .onConflictDoUpdate({
          target: [engagementSuppressions.tenantId, engagementSuppressions.id],
          set: {
            recipientId: suppression.recipientId ?? null,
            endpointId: suppression.endpointId ?? null,
            channel: suppression.channel,
            topic: suppression.topic ?? null,
            reason: suppression.reason,
            source: suppression.source,
            createdAt: suppression.createdAt,
            expiresAt: suppression.expiresAt ?? null,
            evidence: evidence ?? null,
          },
        });
    });
  }

  async findActiveSuppressions(
    input: EngagementSuppressionLookup,
  ): Promise<readonly EngagementSuppression[]> {
    return this.persist("find-active-suppressions", input.tenantId, async () => {
      const rows = await this.client()
        .select()
        .from(engagementSuppressions)
        .where(
          and(
            eq(engagementSuppressions.tenantId, input.tenantId),
            eq(engagementSuppressions.channel, input.channel),
            or(
              isNull(engagementSuppressions.recipientId),
              eq(engagementSuppressions.recipientId, input.recipientId),
            ),
            or(
              isNull(engagementSuppressions.endpointId),
              eq(engagementSuppressions.endpointId, input.endpointId),
            ),
            or(isNull(engagementSuppressions.topic), eq(engagementSuppressions.topic, input.topic)),
            or(
              isNull(engagementSuppressions.expiresAt),
              gt(engagementSuppressions.expiresAt, input.at),
            ),
          ),
        )
        .orderBy(asc(engagementSuppressions.createdAt), asc(engagementSuppressions.id));
      return rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        ...(row.recipientId === null ? {} : { recipientId: row.recipientId }),
        ...(row.endpointId === null ? {} : { endpointId: row.endpointId }),
        channel: row.channel,
        ...(row.topic === null ? {} : { topic: row.topic }),
        reason: row.reason,
        source: row.source,
        createdAt: new Date(row.createdAt),
        ...(row.expiresAt === null ? {} : { expiresAt: new Date(row.expiresAt) }),
        ...(row.evidence === null ? {} : { evidence: normalizeEngagementEvidence(row.evidence) }),
      }));
    });
  }

  async recordDispatch(input: RecordEngagementDispatchInput): Promise<EngagementDispatch> {
    return this.persist("record-dispatch", input.tenantId, () =>
      this.txManager.run(async () => {
        const client = this.client();
        await client.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${createEngagementDispatchIdentityKey(input)}, 0))`,
        );
        const existingRows = await client
          .select()
          .from(engagementDispatches)
          .where(dispatchIdentityWhere(input))
          .for("update")
          .limit(1);
        const existing = existingRows[0];
        if (existing !== undefined && existing.outcome.kind !== "failed") {
          return this.mapDispatch(client, existing);
        }

        const id = existing?.id ?? createEngagementDispatchId(input);
        const createdAt = existing?.createdAt ?? input.recordedAt;
        const values = {
          tenantId: input.tenantId,
          id,
          messageId: input.messageId,
          recipientId: input.recipientId,
          channel: input.channel,
          semanticKey: input.semanticKey,
          topic: input.topic,
          outcome: input.outcome,
          createdAt,
          updatedAt: input.recordedAt,
        };
        const rows =
          existing === undefined
            ? await client.insert(engagementDispatches).values(values).returning()
            : await client
                .update(engagementDispatches)
                .set({
                  topic: input.topic,
                  outcome: input.outcome,
                  updatedAt: input.recordedAt,
                })
                .where(
                  and(
                    eq(engagementDispatches.tenantId, input.tenantId),
                    eq(engagementDispatches.id, id),
                  ),
                )
                .returning();

        await client
          .delete(engagementDispatchTargets)
          .where(
            and(
              eq(engagementDispatchTargets.tenantId, input.tenantId),
              eq(engagementDispatchTargets.dispatchId, id),
            ),
          );
        if (input.targets.length > 0) {
          await client.insert(engagementDispatchTargets).values(
            input.targets.map((target) => ({
              tenantId: input.tenantId,
              dispatchId: id,
              endpointId: target.endpointId,
              endpointVersion: target.endpointVersion,
              executionId: target.executionId,
              provider: target.provider,
              providerMessageId: target.providerMessageId,
            })),
          );
        }
        return this.mapDispatch(client, requiredRow(rows[0], "recorded dispatch"));
      }),
    );
  }

  async getDispatch(tenantId: string, dispatchId: string): Promise<EngagementDispatch | undefined> {
    return this.persist("get-dispatch", tenantId, async () => {
      const client = this.client();
      const rows = await client
        .select()
        .from(engagementDispatches)
        .where(
          and(eq(engagementDispatches.tenantId, tenantId), eq(engagementDispatches.id, dispatchId)),
        )
        .limit(1);
      return rows[0] === undefined ? undefined : this.mapDispatch(client, rows[0]);
    });
  }

  async findByIdentity(
    identity: EngagementDispatchIdentity,
  ): Promise<EngagementDispatch | undefined> {
    return this.persist("find-dispatch", identity.tenantId, async () => {
      const client = this.client();
      const rows = await client
        .select()
        .from(engagementDispatches)
        .where(dispatchIdentityWhere(identity))
        .limit(1);
      return rows[0] === undefined ? undefined : this.mapDispatch(client, rows[0]);
    });
  }

  async listByRecipient(
    tenantId: string,
    recipientId: string,
    options: Readonly<{
      limit: number;
      after?: Readonly<{ updatedAt: Date; dispatchId: string }>;
    }>,
  ): Promise<EngagementDispatchHistoryPage> {
    if (!Number.isInteger(options.limit) || options.limit <= 0 || options.limit > 500) {
      throw new EngagementStoreValidationProblem(
        "Engagement history limit must be between 1 and 500",
      );
    }
    return this.persist("list-dispatch-history", tenantId, async () => {
      const client = this.client();
      const cursor = options.after;
      const rows = await client
        .select()
        .from(engagementDispatches)
        .where(
          and(
            eq(engagementDispatches.tenantId, tenantId),
            eq(engagementDispatches.recipientId, recipientId),
            cursor === undefined
              ? undefined
              : or(
                  lt(engagementDispatches.updatedAt, cursor.updatedAt),
                  and(
                    eq(engagementDispatches.updatedAt, cursor.updatedAt),
                    lt(engagementDispatches.id, cursor.dispatchId),
                  ),
                ),
          ),
        )
        .orderBy(desc(engagementDispatches.updatedAt), desc(engagementDispatches.id))
        .limit(options.limit + 1);
      const pageRows = rows.slice(0, options.limit);
      const items = await Promise.all(pageRows.map((row) => this.mapDispatch(client, row)));
      const last = items.at(-1);
      return {
        items,
        ...(rows.length > options.limit && last !== undefined
          ? { nextCursor: { updatedAt: new Date(last.updatedAt), dispatchId: last.id } }
          : {}),
      };
    });
  }

  async recordDeliveryEvent(
    input: RecordEngagementDeliveryEventInput,
  ): Promise<EngagementDeliveryEventRecordResult> {
    const evidence = normalizeEngagementEvidence(input.evidence);
    return this.persist("record-delivery-event", input.tenantId, async () => {
      const id = createEngagementDeliveryEventId(
        input.tenantId,
        input.provider,
        input.providerEventId,
      );
      const client = this.client();
      const inserted = await client
        .insert(engagementDeliveryEvents)
        .values({ ...input, id, evidence: evidence ?? null })
        .onConflictDoNothing({
          target: [
            engagementDeliveryEvents.tenantId,
            engagementDeliveryEvents.provider,
            engagementDeliveryEvents.providerEventId,
          ],
        })
        .returning();
      if (inserted[0] !== undefined) {
        return { event: mapDeliveryEvent(inserted[0]), duplicate: false };
      }
      const existing = await client
        .select()
        .from(engagementDeliveryEvents)
        .where(
          and(
            eq(engagementDeliveryEvents.tenantId, input.tenantId),
            eq(engagementDeliveryEvents.provider, input.provider),
            eq(engagementDeliveryEvents.providerEventId, input.providerEventId),
          ),
        )
        .limit(1);
      return {
        event: mapDeliveryEvent(requiredRow(existing[0], "deduplicated delivery event")),
        duplicate: true,
      };
    });
  }

  async listByDispatch(
    tenantId: string,
    dispatchId: string,
  ): Promise<readonly EngagementDeliveryEvent[]> {
    return this.persist("list-delivery-events", tenantId, async () => {
      const rows = await this.client()
        .select()
        .from(engagementDeliveryEvents)
        .where(
          and(
            eq(engagementDeliveryEvents.tenantId, tenantId),
            eq(engagementDeliveryEvents.dispatchId, dispatchId),
          ),
        )
        .orderBy(asc(engagementDeliveryEvents.occurredAt), asc(engagementDeliveryEvents.id));
      return rows.map(mapDeliveryEvent);
    });
  }

  async transaction<TResult>(
    operation: (stores: EngagementStoreTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    try {
      return await this.txManager.run(() => operation(this));
    } catch (error) {
      if (error instanceof Problem) throw error;
      throw new EngagementPersistenceProblem("transaction", "unresolved", normalizeError(error));
    }
  }

  private client(): DrizzleEngagementQueryable {
    return this.txManager.getClient() ?? this.db;
  }

  private async mapDispatch(
    client: DrizzleEngagementQueryable,
    row: EngagementDispatchRow,
  ): Promise<EngagementDispatch> {
    const targets = await client
      .select()
      .from(engagementDispatchTargets)
      .where(
        and(
          eq(engagementDispatchTargets.tenantId, row.tenantId),
          eq(engagementDispatchTargets.dispatchId, row.id),
        ),
      )
      .orderBy(asc(engagementDispatchTargets.endpointId));
    return {
      id: row.id,
      tenantId: row.tenantId,
      messageId: row.messageId,
      recipientId: row.recipientId,
      channel: row.channel,
      semanticKey: row.semanticKey,
      topic: row.topic,
      targets: targets.map(mapDispatchTarget),
      outcome: row.outcome,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private async persist<TResult>(
    operation: string,
    tenantId: string,
    action: () => Promise<TResult>,
  ): Promise<TResult> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof Problem) throw error;
      throw new EngagementPersistenceProblem(operation, tenantId, normalizeError(error));
    }
  }
}

function assertEndpoint(input: SaveContactEndpointInput): void {
  assertEngagementStoreText(input.id, "Endpoint id");
  assertEngagementStoreText(input.tenantId, "Endpoint tenantId");
  assertEngagementStoreText(input.recipientId, "Endpoint recipientId");
  if (input.kind === "email") {
    assertEngagementStoreText(input.address, "Email address");
    return;
  }
  assertEngagementStoreText(input.provider, "Push provider");
  assertEngagementStoreText(input.app, "Push app");
  assertEngagementStoreText(input.platform, "Push platform");
  assertEngagementStoreText(input.environment, "Push environment");
  assertEngagementStoreText(input.tokenReference, "Push token reference");
}

function dispatchIdentityWhere(identity: EngagementDispatchIdentity) {
  return and(
    eq(engagementDispatches.tenantId, identity.tenantId),
    eq(engagementDispatches.messageId, identity.messageId),
    eq(engagementDispatches.recipientId, identity.recipientId),
    eq(engagementDispatches.channel, identity.channel),
    eq(engagementDispatches.semanticKey, identity.semanticKey),
  );
}

function mapEndpoint(row: EngagementContactEndpointRow): ContactEndpoint {
  const common = {
    id: row.id,
    tenantId: row.tenantId,
    recipientId: row.recipientId,
    lastSeenAt: new Date(row.lastSeenAt),
    version: row.version,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    ...(row.invalidatedAt === null ? {} : { invalidatedAt: new Date(row.invalidatedAt) }),
    ...(row.invalidationReason === null ? {} : { invalidationReason: row.invalidationReason }),
  };
  if (row.kind === "email") {
    return { ...common, kind: "email", address: requiredText(row.address, "email address") };
  }
  return {
    ...common,
    kind: "push",
    provider: requiredText(row.provider, "push provider"),
    app: requiredText(row.app, "push app"),
    platform: requiredText(row.platform, "push platform"),
    environment: requiredText(row.environment, "push environment"),
    tokenReference: requiredText(row.tokenReference, "push token reference"),
  };
}

function mapDispatchTarget(row: EngagementDispatchTargetRow) {
  return {
    endpointId: row.endpointId,
    endpointVersion: row.endpointVersion,
    ...(row.executionId === null ? {} : { executionId: row.executionId }),
    ...(row.provider === null ? {} : { provider: row.provider }),
    ...(row.providerMessageId === null ? {} : { providerMessageId: row.providerMessageId }),
  };
}

function mapDeliveryEvent(row: EngagementDeliveryEventRow): EngagementDeliveryEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    provider: row.provider,
    providerEventId: row.providerEventId,
    dispatchId: row.dispatchId,
    endpointId: row.endpointId,
    type: row.type,
    occurredAt: new Date(row.occurredAt),
    ...(row.evidence === null ? {} : { evidence: normalizeEngagementEvidence(row.evidence) }),
    recordedAt: new Date(row.recordedAt),
  };
}

function requiredText(value: string | null, field: string): string {
  if (value === null) {
    throw new EngagementStoreValidationProblem(`Stored engagement ${field} is missing`);
  }
  return value;
}

function requiredRow<TRow>(row: TRow | undefined, label: string): TRow {
  if (row === undefined) {
    throw new EngagementStoreValidationProblem(`Expected ${label}`);
  }
  return row;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
