import { isDeepStrictEqual } from "node:util";
import { sql } from "drizzle-orm";
import { SavedIntentConflictProblem, SavedIntentInvalidProblem } from "@croco/experience-core";
import type {
  ExperienceScope,
  ExperienceSubject,
  SavedIntent,
  SavedIntentMutation,
  SavedIntentPolicy,
  SavedIntentPolicyMutation,
  SavedIntentStore,
} from "@croco/experience-core";
import type { ExperiencePgDatabase, ExperiencePgExecutor } from "./PostgresExperienceStore";

type SubjectInput = Readonly<{ scope: ExperienceScope; subject: ExperienceSubject }>;

function required(value: string): void {
  if (typeof value !== "string" || !value.trim())
    throw new SavedIntentInvalidProblem("Saved intent identity and audit values are required");
}
function scopeKey(scope: ExperienceScope): string {
  [scope.appId, scope.environment, scope.tenantId].forEach(required);
  return JSON.stringify([scope.appId, scope.environment, scope.tenantId]);
}
function subjectKey(subject: ExperienceSubject): string {
  [subject.kind, subject.id].forEach(required);
  return JSON.stringify([subject.kind, subject.id]);
}
function timestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value)) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new SavedIntentInvalidProblem("An explicit timestamp is required");
}
function revision(expected: number | null, current?: number): void {
  if (expected !== null && (!Number.isSafeInteger(expected) || expected < 1))
    throw new SavedIntentInvalidProblem("Expected revision must be null or a positive integer");
  if ((current ?? null) !== expected)
    throw new SavedIntentConflictProblem("Saved intent revision changed");
}
async function subjectLock(tx: ExperiencePgExecutor, key: string, subject: string): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock_shared(hashtext(${key}), hashtext(${subject}))`,
  );
}

/** Durable saved intent state. Every mutation serializes receipts and both resource sources. */
export class PostgresSavedIntentStore implements SavedIntentStore {
  constructor(private readonly database: ExperiencePgDatabase) {}

  async mutate(input: SavedIntentMutation): Promise<SavedIntent> {
    const key = scopeKey(input.scope);
    const subject = subjectKey(input.subject);
    [input.resourceType, input.resourceId, input.id, input.idempotencyKey].forEach(required);
    timestamp(input.now);
    if (
      !["explicit", "recent"].includes(input.sourceKind) ||
      !["save", "remove", "complete", "pin"].includes(input.operation) ||
      (input.operation === "pin" && input.pinOrder === undefined) ||
      (input.pinOrder !== undefined &&
        input.pinOrder !== null &&
        (!Number.isSafeInteger(input.pinOrder) || input.pinOrder < 0 || input.pinOrder > 10000))
    )
      throw new SavedIntentInvalidProblem("Invalid saved intent mutation");
    const { id: _id, now: _now, ...command } = input;
    return this.database.transaction(async (tx) => {
      await subjectLock(tx, key, subject);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}),
        hashtext(${JSON.stringify(["receipt", subject, input.idempotencyKey])}))`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}),
        hashtext(${JSON.stringify(["resource", subject, input.resourceType, input.resourceId])}))`);
      const receipt = await tx.execute(sql`SELECT command, result FROM croco_saved_intent_receipts
        WHERE scope_key = ${key} AND subject_key = ${subject} AND idempotency_key = ${input.idempotencyKey}`);
      if (receipt.rows[0]) {
        if (!isDeepStrictEqual(receipt.rows[0].command, JSON.parse(JSON.stringify(command))))
          throw new SavedIntentConflictProblem(
            "Idempotency key names a different saved intent command",
          );
        return receipt.rows[0].result as SavedIntent;
      }
      const current = await tx.execute(sql`SELECT intent FROM croco_saved_intents
        WHERE scope_key = ${key} AND subject_key = ${subject}
          AND resource_type = ${input.resourceType} AND resource_id = ${input.resourceId}
          AND source_kind = ${input.sourceKind} FOR UPDATE`);
      const previous = current.rows[0]?.intent as SavedIntent | undefined;
      revision(input.expectedRevision, previous?.revision);
      if (!previous && input.operation !== "save")
        throw new SavedIntentConflictProblem("Saved intent does not exist");
      const suppression = await tx.execute(sql`SELECT 1 FROM croco_saved_intent_suppression
        WHERE scope_key = ${key} AND subject_key = ${subject}
          AND resource_type = ${input.resourceType} AND resource_id = ${input.resourceId}`);
      const suppressed = suppression.rows.length > 0;
      if (input.operation === "save" && input.sourceKind === "explicit") {
        await tx.execute(sql`DELETE FROM croco_saved_intent_suppression
          WHERE scope_key = ${key} AND subject_key = ${subject}
            AND resource_type = ${input.resourceType} AND resource_id = ${input.resourceId}`);
      }
      if (input.operation === "remove") {
        await tx.execute(sql`INSERT INTO croco_saved_intent_suppression
          (scope_key, subject_key, resource_type, resource_id)
          VALUES (${key}, ${subject}, ${input.resourceType}, ${input.resourceId}) ON CONFLICT DO NOTHING`);
        await tx.execute(sql`UPDATE croco_saved_intents SET intent = (intent - 'progressRef') || jsonb_build_object(
          'state', 'removed', 'updatedAt', ${input.now}::text, 'revision', (intent ->> 'revision')::integer + 1)
          WHERE scope_key = ${key} AND subject_key = ${subject}
            AND resource_type = ${input.resourceType} AND resource_id = ${input.resourceId}
            AND source_kind <> ${input.sourceKind}`);
      }
      const restoring = input.operation === "save" && input.sourceKind === "explicit";
      const state =
        input.operation === "remove" ||
        (!restoring && (suppressed || previous?.state === "removed"))
          ? "removed"
          : input.operation === "complete"
            ? "completed"
            : input.operation === "save"
              ? "saved"
              : previous?.state;
      if (!state) throw new SavedIntentInvalidProblem("Saved intent state is required");
      const intent: SavedIntent = {
        id: previous?.id ?? input.id,
        scope: input.scope,
        subject: input.subject,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        sourceKind: input.sourceKind,
        state,
        savedAt: previous?.savedAt ?? input.now,
        lastUsedAt:
          input.operation === "save" || input.operation === "complete"
            ? input.now
            : (previous?.lastUsedAt ?? input.now),
        updatedAt: input.now,
        revision: (previous?.revision ?? 0) + 1,
        ...(previous?.progressRef === undefined ? {} : { progressRef: previous.progressRef }),
        ...(input.operation === "save" && input.progressRef !== undefined
          ? { progressRef: input.progressRef }
          : {}),
        ...(previous?.pinOrder === undefined ? {} : { pinOrder: previous.pinOrder }),
        ...(input.operation === "pin" && input.pinOrder !== null
          ? { pinOrder: input.pinOrder }
          : {}),
      };
      const stored = Object.fromEntries(
        Object.entries(intent).filter(
          ([name]) =>
            !(name === "pinOrder" && input.operation === "pin" && input.pinOrder === null) &&
            !(name === "progressRef" && state === "removed"),
        ),
      ) as SavedIntent;
      await tx.execute(sql`INSERT INTO croco_saved_intents
        (scope_key, subject_key, resource_type, resource_id, source_kind, intent)
        VALUES (${key}, ${subject}, ${input.resourceType}, ${input.resourceId}, ${input.sourceKind}, ${JSON.stringify(stored)}::jsonb)
        ON CONFLICT (scope_key, subject_key, resource_type, resource_id, source_kind)
        DO UPDATE SET intent = EXCLUDED.intent`);
      await tx.execute(sql`INSERT INTO croco_saved_intent_receipts
        (scope_key, subject_key, idempotency_key, command, result)
        VALUES (${key}, ${subject}, ${input.idempotencyKey}, ${JSON.stringify(command)}::jsonb, ${JSON.stringify(stored)}::jsonb)`);
      return stored;
    });
  }

  async read(input: Parameters<SavedIntentStore["read"]>[0]): Promise<SavedIntent | undefined> {
    const key = scopeKey(input.scope);
    const subject = subjectKey(input.subject);
    [input.resourceType, input.resourceId].forEach(required);
    if (input.sourceKind !== "explicit" && input.sourceKind !== "recent")
      throw new SavedIntentInvalidProblem("Invalid sourceKind");
    const result = await this.database.execute(sql`SELECT intent FROM croco_saved_intents
      WHERE scope_key = ${key} AND subject_key = ${subject}
        AND resource_type = ${input.resourceType} AND resource_id = ${input.resourceId}
        AND source_kind = ${input.sourceKind}`);
    return result.rows[0]?.intent as SavedIntent | undefined;
  }

  async list(
    input: SubjectInput & Readonly<{ offset: number; limit: number }>,
  ): Promise<readonly SavedIntent[]> {
    if (
      !Number.isSafeInteger(input.offset) ||
      input.offset < 0 ||
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 10001
    )
      throw new SavedIntentInvalidProblem("Invalid saved intent pagination");
    const result = await this.database.execute(sql`SELECT intent FROM croco_saved_intents
      WHERE scope_key = ${scopeKey(input.scope)} AND subject_key = ${subjectKey(input.subject)}
      ORDER BY (intent ->> 'pinOrder')::integer ASC NULLS LAST,
        (intent ->> 'lastUsedAt')::timestamptz DESC, intent ->> 'id' ASC
      LIMIT ${input.limit} OFFSET ${input.offset}`);
    return result.rows.map((row) => row.intent as SavedIntent);
  }

  async readPolicy(
    input: Readonly<{ scope: ExperienceScope; resourceType: string }>,
  ): Promise<SavedIntentPolicy | undefined> {
    required(input.resourceType);
    const result = await this.database
      .execute(sql`SELECT policy FROM croco_saved_intent_policy_revisions
      WHERE scope_key = ${scopeKey(input.scope)} AND resource_type = ${input.resourceType}
      ORDER BY revision DESC LIMIT 1`);
    return result.rows[0]?.policy as SavedIntentPolicy | undefined;
  }

  async updatePolicy(input: SavedIntentPolicyMutation): Promise<SavedIntentPolicy> {
    const { policy } = input;
    const key = scopeKey(policy.scope);
    [policy.resourceType, policy.actorId, policy.reason, input.idempotencyKey].forEach(required);
    timestamp(policy.updatedAt);
    if (
      !Number.isSafeInteger(policy.displayLimit) ||
      policy.displayLimit < 1 ||
      policy.displayLimit > 100 ||
      !Number.isSafeInteger(policy.retentionDays) ||
      policy.retentionDays < 1 ||
      policy.retentionDays > 3650 ||
      typeof policy.excludeCompleted !== "boolean"
    )
      throw new SavedIntentInvalidProblem("Invalid saved intent policy");
    const { updatedAt: _updatedAt, revision: _revision, ...values } = policy;
    const command = { policy: values, expectedRevision: input.expectedRevision };
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}),
        hashtext(${JSON.stringify(["policy", policy.resourceType])}))`);
      const receipt =
        await tx.execute(sql`SELECT policy, command FROM croco_saved_intent_policy_revisions
        WHERE scope_key = ${key} AND resource_type = ${policy.resourceType} AND idempotency_key = ${input.idempotencyKey}`);
      if (receipt.rows[0]) {
        if (!isDeepStrictEqual(receipt.rows[0].command, command))
          throw new SavedIntentConflictProblem("Idempotency key names a different policy command");
        return receipt.rows[0].policy as SavedIntentPolicy;
      }
      const current = await tx.execute(sql`SELECT revision FROM croco_saved_intent_policy_revisions
        WHERE scope_key = ${key} AND resource_type = ${policy.resourceType} ORDER BY revision DESC LIMIT 1`);
      const previous = current.rows[0] ? Number(current.rows[0].revision) : undefined;
      revision(input.expectedRevision, previous);
      if (policy.revision !== (previous ?? 0) + 1)
        throw new SavedIntentConflictProblem("Policy revision must increment by one");
      await tx.execute(sql`INSERT INTO croco_saved_intent_policy_revisions
        (scope_key, resource_type, revision, idempotency_key, command, policy)
        VALUES (${key}, ${policy.resourceType}, ${policy.revision}, ${input.idempotencyKey},
          ${JSON.stringify(command)}::jsonb, ${JSON.stringify(policy)}::jsonb)`);
      return policy;
    });
  }

  async deleteSubject(input: SubjectInput): Promise<void> {
    const key = scopeKey(input.scope);
    const subject = subjectKey(input.subject);
    await this.database.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}), hashtext(${subject}))`);
      await tx.execute(
        sql`DELETE FROM croco_saved_intent_receipts WHERE scope_key = ${key} AND subject_key = ${subject}`,
      );
      await tx.execute(
        sql`DELETE FROM croco_saved_intents WHERE scope_key = ${key} AND subject_key = ${subject}`,
      );
      await tx.execute(
        sql`DELETE FROM croco_saved_intent_suppression WHERE scope_key = ${key} AND subject_key = ${subject}`,
      );
    });
  }

  async purgeExpired(
    input: SubjectInput & Readonly<{ resourceType: string; before: string }>,
  ): Promise<void> {
    const key = scopeKey(input.scope);
    const subject = subjectKey(input.subject);
    required(input.resourceType);
    timestamp(input.before);
    await this.database.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}), hashtext(${subject}))`);
      await tx.execute(sql`DELETE FROM croco_saved_intent_receipts
        WHERE scope_key = ${key} AND subject_key = ${subject}
          AND result ->> 'resourceType' = ${input.resourceType}
          AND (result ->> 'lastUsedAt')::timestamptz <= ${input.before}::timestamptz`);
      await tx.execute(sql`DELETE FROM croco_saved_intents
        WHERE scope_key = ${key} AND subject_key = ${subject} AND resource_type = ${input.resourceType}
          AND (intent ->> 'lastUsedAt')::timestamptz <= ${input.before}::timestamptz`);
    });
  }
}
