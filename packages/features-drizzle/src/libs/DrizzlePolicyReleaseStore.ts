import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  PolicyIdempotencyConflictProblem,
  PolicyRevisionConflictProblem,
  PolicyScheduleProblem,
  FeaturePolicyPersistenceProblem,
} from "./problems";
import type {
  PolicyAuditEntry,
  PolicyCommandReceipt,
  PolicyDecisionReference,
  PolicyDefinitionRecord,
  PolicyDecisionInput,
  PolicyPublishCommand,
  PolicyPublicationInput,
  PolicyPauseInput,
  PolicyScheduleLookup,
  PolicyResolution,
  PolicyRevision,
  PolicyScheduleInput,
  PolicyScheduleRecord,
  PolicyScope,
} from "./contracts";
import { normalizePolicyScope, policyScheduleId, policyScopeKey } from "./contracts";

type QueryRow = Record<string, unknown>;
type QueryResult = { readonly rows: readonly QueryRow[] };

export interface FeaturePolicyPgExecutor {
  execute(query: SQL): PromiseLike<QueryResult>;
}

export interface FeaturePolicyPgDatabase extends FeaturePolicyPgExecutor {
  transaction<T>(work: (transaction: FeaturePolicyPgExecutor) => Promise<T>): Promise<T>;
}

export type DrizzlePolicyReleaseStoreOptions = Readonly<{
  now?: () => Date;
  idGenerator?: () => string;
}>;

const json = (value: unknown): SQL => sql`${JSON.stringify(value ?? null)}::jsonb`;
const asRows = (result: unknown): readonly QueryRow[] => {
  if (typeof result !== "object" || result === null || !("rows" in result))
    throw new FeaturePolicyPersistenceProblem("unavailable", "Database result has no rows");
  const rows = result.rows;
  if (!Array.isArray(rows))
    throw new FeaturePolicyPersistenceProblem("unavailable", "Database rows are invalid");
  return rows as QueryRow[];
};
function parseRequiredJson<T>(value: unknown): T {
  if (value === undefined) {
    throw new FeaturePolicyPersistenceProblem(
      "unavailable",
      "Required JSON value was not persisted",
    );
  }
  return value as T;
}

function parseDate(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  throw new FeaturePolicyPersistenceProblem(
    "unavailable",
    "Persisted timestamp has an unsupported type",
  );
}

function requiredDate(value: unknown): string {
  const parsed = parseDate(value);
  if (!parsed)
    throw new FeaturePolicyPersistenceProblem(
      "unavailable",
      "Required timestamp was not persisted",
    );
  return parsed;
}

function parseScope(scopeKey: string): PolicyScope {
  const value = JSON.parse(scopeKey) as unknown;
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    typeof value[0] !== "string" ||
    typeof value[1] !== "string"
  ) {
    throw new FeaturePolicyPersistenceProblem(
      "unavailable",
      "Persisted feature policy scope key is invalid",
    );
  }
  const tenantId = value[2];
  if (tenantId !== null && tenantId !== undefined && typeof tenantId !== "string") {
    throw new FeaturePolicyPersistenceProblem(
      "unavailable",
      "Persisted feature policy tenant scope is invalid",
    );
  }
  return { app: value[0], environment: value[1], tenantId: tenantId ?? null };
}

function nullable<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

function asRevision<TValue>(row: QueryRow): PolicyRevision<TValue> {
  const scopeKeyValue = String(row.scope_key);
  return {
    id: String(row.id),
    policyId: String(row.policy_id),
    scope: parseScope(scopeKeyValue),
    schemaVersion: String(row.schema_version),
    codeRegistrationId: String(row.code_registration_id),
    registrationFingerprint: String(row.registration_fingerprint),
    revision: Number(row.revision),
    version: Number(row.version),
    value: parseRequiredJson<TValue>(row.value),
    hash: String(row.hash),
    state: String(row.state) as PolicyRevision<TValue>["state"],
    ...(row.review === null || row.review === undefined
      ? {}
      : { review: parseRequiredJson<NonNullable<PolicyRevision<TValue>["review"]>>(row.review) }),
    ...(row.publication === null || row.publication === undefined
      ? {}
      : {
          publication: parseRequiredJson<NonNullable<PolicyRevision<TValue>["publication"]>>(
            row.publication,
          ),
        }),
    ...(row.schedule_idempotency_key === null || row.schedule_idempotency_key === undefined
      ? {}
      : { scheduleIdempotencyKey: String(row.schedule_idempotency_key) }),
    ...(parseDate(row.scheduled_for) ? { scheduledFor: requiredDate(row.scheduled_for) } : {}),
    ...(row.fallback_present !== true ? {} : { fallback: parseRequiredJson<TValue>(row.fallback) }),
    ...(row.pause_reason === null || row.pause_reason === undefined
      ? {}
      : { pauseReason: String(row.pause_reason) }),
    ...(row.rollback_of === null || row.rollback_of === undefined
      ? {}
      : { rollbackOf: Number(row.rollback_of) }),
    history: parseRequiredJson<PolicyRevision<TValue>["history"]>(row.history),
  };
}

function asReceipt(row: QueryRow): PolicyCommandReceipt {
  return parseRequiredJson<PolicyCommandReceipt>(row.receipt);
}

function asSchedule(row: QueryRow): PolicyScheduleRecord {
  return {
    id: String(row.id),
    policyId: String(row.policy_id),
    scope: parseScope(String(row.scope_key)),
    revision: Number(row.revision),
    reviewHash: String(row.review_hash),
    effectiveAt: requiredDate(row.effective_at),
    idempotencyKey: String(row.idempotency_key),
    state: String(row.state) as PolicyScheduleRecord["state"],
    ...(row.execution_id === null || row.execution_id === undefined
      ? {}
      : { executionId: String(row.execution_id) }),
    ...(row.trigger_id === null || row.trigger_id === undefined
      ? {}
      : { triggerId: String(row.trigger_id) }),
    ...(parseDate(row.lease_until) ? { leaseUntil: requiredDate(row.lease_until) } : {}),
    ...(row.claimed_by === null || row.claimed_by === undefined
      ? {}
      : { claimedBy: String(row.claimed_by) }),
    ...(row.last_error === null || row.last_error === undefined
      ? {}
      : { lastError: String(row.last_error) }),
    ...(row.metadata === null || row.metadata === undefined
      ? {}
      : { metadata: parseRequiredJson<Readonly<Record<string, unknown>>>(row.metadata) }),
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

function asAudit(row: QueryRow): PolicyAuditEntry {
  return {
    id: String(row.id),
    policyId: String(row.policy_id),
    scope: parseScope(String(row.scope_key)),
    action: String(row.action) as PolicyAuditEntry["action"],
    ...(row.revision_id === null || row.revision_id === undefined
      ? {}
      : { revisionId: String(row.revision_id) }),
    ...(row.revision === null || row.revision === undefined
      ? {}
      : { revision: Number(row.revision) }),
    actor: parseRequiredJson<PolicyAuditEntry["actor"]>(row.actor),
    reason: String(row.reason),
    occurredAt: requiredDate(row.occurred_at),
  };
}

function asResolution<TValue>(
  row: QueryRow,
  status: PolicyResolution<TValue>["status"],
): PolicyResolution<TValue> {
  const revision = asRevision<TValue>(row);
  const reference: NonNullable<PolicyResolution<TValue>["reference"]> = {
    policyId: revision.policyId,
    scope: revision.scope,
    version: revision.version,
    hash: revision.hash,
  };
  return {
    policyId: revision.policyId,
    scope: revision.scope,
    status,
    version: revision.version,
    hash: revision.hash,
    ...(revision.state === "paused"
      ? revision.fallback === undefined
        ? {}
        : { value: revision.fallback }
      : { value: revision.value }),
    reference,
    ...(revision.pauseReason ? { reason: revision.pauseReason } : {}),
  };
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const seen = new Set<object>();
  let current = error;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    if (
      "code" in current &&
      current.code === "23505" &&
      "constraint" in current &&
      current.constraint === constraint
    ) {
      return true;
    }
    seen.add(current);
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

function asCommandJson<TValue>(command: PolicyPublishCommand<TValue>): Record<string, unknown> {
  return {
    policyId: command.policyId,
    scope: normalizePolicyScope(command.scope),
    expectedRevision: command.expectedRevision,
    reviewHash: command.reviewHash,
    actor: command.actor,
    reason: command.reason,
    idempotencyKey: command.idempotencyKey,
    ...(command.effectiveAt ? { effectiveAt: command.effectiveAt } : {}),
    ...(command.value === undefined ? {} : { value: command.value }),
  };
}

/** PostgreSQL persistence for policy revisions, activation pointers, receipts, and schedules. */
export class DrizzlePolicyReleaseStore<TValue = unknown> implements PolicyScheduleLookup<TValue> {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;

  constructor(
    private readonly database: FeaturePolicyPgDatabase,
    options: DrizzlePolicyReleaseStoreOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
  }

  private async transaction<T>(
    work: (transaction: FeaturePolicyPgExecutor) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(work);
  }

  private async execute(
    executor: FeaturePolicyPgExecutor,
    query: SQL,
  ): Promise<readonly QueryRow[]> {
    return asRows(await executor.execute(query));
  }

  private async findRevision(
    executor: FeaturePolicyPgExecutor,
    policyId: string,
    scope: PolicyScope,
    revision: number,
    lock = false,
  ): Promise<PolicyRevision<TValue> | null> {
    const rows = await this.execute(
      executor,
      sql`
        select *, fallback is not null as fallback_present from croco_feature_policy_revisions
        where policy_id=${policyId} and scope_key=${policyScopeKey(scope)} and revision=${revision}
        limit 1 ${lock ? sql`for update` : sql``}
      `,
    );
    return rows[0] ? asRevision<TValue>(rows[0]) : null;
  }

  private async findHead(
    executor: FeaturePolicyPgExecutor,
    policyId: string,
    scope: PolicyScope,
    lock = false,
  ): Promise<number | null> {
    const rows = await this.execute(
      executor,
      sql`
        select revision from croco_feature_policy_heads
        where policy_id=${policyId} and scope_key=${policyScopeKey(scope)}
        limit 1 ${lock ? sql`for update` : sql``}
      `,
    );
    return rows[0] ? Number(rows[0].revision) : null;
  }

  private async saveDefinition(
    executor: FeaturePolicyPgExecutor,
    definition: PolicyDefinitionRecord,
  ): Promise<void> {
    const scope = normalizePolicyScope(definition.scope);
    const scopeKey = policyScopeKey(scope);
    await this.execute(
      executor,
      sql`
        insert into croco_feature_policy_definitions
          (policy_id,scope_key,app,environment,tenant_id,schema_version,code_registration_id,registration_fingerprint,metadata,created_at,updated_at)
        values
          (${definition.policyId},${scopeKey},${scope.app},${scope.environment},${nullable(scope.tenantId)},
           ${definition.schemaVersion},${definition.codeRegistrationId},${definition.registrationFingerprint},
           ${json(definition.metadata)},${this.now()},${this.now()})
        on conflict (policy_id,scope_key) do update set schema_version=excluded.schema_version,
          code_registration_id=excluded.code_registration_id,
          registration_fingerprint=excluded.registration_fingerprint,metadata=excluded.metadata,
          updated_at=excluded.updated_at
      `,
    );
  }

  private revisionInsertValues(revision: PolicyRevision<TValue>): SQL {
    const scopeKey = policyScopeKey(revision.scope);
    return sql`
      insert into croco_feature_policy_revisions
        (id,policy_id,scope_key,revision,version,schema_version,code_registration_id,registration_fingerprint,
         value,hash,state,review,publication,scheduled_for,schedule_idempotency_key,fallback,pause_reason,rollback_of,history,created_at)
      values
        (${revision.id},${revision.policyId},${scopeKey},${revision.revision},${revision.version},
         ${revision.schemaVersion},${revision.codeRegistrationId},${revision.registrationFingerprint},
         ${json(revision.value)},${revision.hash},${revision.state},${json(revision.review)},${json(revision.publication)},
         ${revision.scheduledFor ? new Date(revision.scheduledFor) : null},${revision.scheduleIdempotencyKey ?? null},${revision.fallback === undefined ? sql`null` : json(revision.fallback)},
         ${nullable(revision.pauseReason)},${nullable(revision.rollbackOf)},${json(revision.history)},${this.now()})
    `;
  }

  async create(
    revision: PolicyRevision<TValue>,
    definition?: PolicyDefinitionRecord,
  ): Promise<void> {
    try {
      await this.save(revision, revision.revision - 1, definition);
    } catch (error) {
      if (
        [
          "croco_feature_policy_definitions_pk",
          "croco_feature_policy_revisions_pkey",
          "croco_feature_policy_revisions_scope_revision_unique",
          "croco_feature_policy_heads_pk",
        ].some((constraint) => isUniqueViolation(error, constraint))
      ) {
        const head = await this.findHead(this.database, revision.policyId, revision.scope);
        if (head !== null)
          throw new PolicyRevisionConflictProblem(revision.policyId, revision.revision - 1, head);
      }
      throw error;
    }
  }

  async get(scope: PolicyScope, policyId: string): Promise<PolicyRevision<TValue> | null> {
    const head = await this.findHead(this.database, policyId, scope);
    return head === null ? null : this.findRevision(this.database, policyId, scope, head);
  }

  async getRevision(
    scope: PolicyScope,
    policyId: string,
    revision: number,
  ): Promise<PolicyRevision<TValue> | null> {
    return this.findRevision(this.database, policyId, scope, revision);
  }

  async list(scope: PolicyScope, policyId: string): Promise<readonly PolicyRevision<TValue>[]> {
    const rows = await this.execute(
      this.database,
      sql`
        select *, fallback is not null as fallback_present from croco_feature_policy_revisions
        where policy_id=${policyId} and scope_key=${policyScopeKey(scope)}
        order by revision asc
      `,
    );
    return rows.map((row) => asRevision<TValue>(row));
  }

  async save(
    revision: PolicyRevision<TValue>,
    expectedRevision: number,
    definition?: PolicyDefinitionRecord,
  ): Promise<void> {
    await this.transaction(async (transaction) => {
      if (definition) await this.saveDefinition(transaction, definition);
      const currentRevision = await this.findHead(
        transaction,
        revision.policyId,
        revision.scope,
        true,
      );
      if (currentRevision === null) {
        if (expectedRevision !== 0 || revision.revision !== 1) {
          throw new PolicyRevisionConflictProblem(revision.policyId, expectedRevision, 0);
        }
        await this.execute(transaction, this.revisionInsertValues(revision));
        await this.execute(
          transaction,
          sql`
            insert into croco_feature_policy_heads(policy_id,scope_key,revision,updated_at)
            values (${revision.policyId},${policyScopeKey(revision.scope)},${revision.revision},${this.now()})
          `,
        );
        if (revision.state === "paused") {
          await this.setActiveInTransaction(
            transaction,
            revision.policyId,
            revision.scope,
            revision,
          );
        }
        return;
      }
      if (currentRevision !== expectedRevision) {
        throw new PolicyRevisionConflictProblem(
          revision.policyId,
          expectedRevision,
          currentRevision,
        );
      }
      if (revision.revision === expectedRevision + 1) {
        if (revision.state === "reviewed") {
          await this.execute(
            transaction,
            sql`
            update croco_feature_policy_schedules set state='cancelled', lease_until=null, claimed_by=null,
              last_error='Policy schedule cancelled', updated_at=${this.now()}
            where policy_id=${revision.policyId} and scope_key=${policyScopeKey(revision.scope)}
              and revision=${expectedRevision} and state not in ('completed','cancelled')
          `,
          );
        }
        await this.execute(transaction, this.revisionInsertValues(revision));
        await this.execute(
          transaction,
          sql`
            update croco_feature_policy_heads
            set revision=${revision.revision}, updated_at=${this.now()}
            where policy_id=${revision.policyId} and scope_key=${policyScopeKey(revision.scope)}
              and revision=${expectedRevision}
          `,
        );
        if (revision.state === "paused") {
          await this.setActiveInTransaction(
            transaction,
            revision.policyId,
            revision.scope,
            revision,
          );
        }
        return;
      }
      throw new PolicyRevisionConflictProblem(
        revision.policyId,
        expectedRevision + 1,
        revision.revision,
      );
    });
  }

  async findCommandReceipt(
    scope: PolicyScope,
    policyId: string,
    idempotencyKey: string,
  ): Promise<PolicyCommandReceipt | null> {
    const rows = await this.execute(
      this.database,
      sql`
        select receipt from croco_feature_policy_command_receipts
        where policy_id=${policyId} and scope_key=${policyScopeKey(scope)} and idempotency_key=${idempotencyKey}
        limit 1
      `,
    );
    return rows[0] ? asReceipt(rows[0]) : null;
  }

  async recordPublication(input: PolicyPublicationInput<TValue>): Promise<PolicyCommandReceipt> {
    const { revision, command, receipt } = input;
    const scopeKey = policyScopeKey(command.scope);
    const fingerprint = receipt.commandFingerprint;
    return this.transaction(async (transaction) => {
      const currentRevision = await this.findHead(
        transaction,
        command.policyId,
        command.scope,
        true,
      );
      const existing = await this.execute(
        transaction,
        sql`
        select command_fingerprint, receipt from croco_feature_policy_command_receipts
        where policy_id=${command.policyId} and scope_key=${scopeKey} and idempotency_key=${command.idempotencyKey}
      `,
      );
      if (existing[0]) {
        if (String(existing[0].command_fingerprint) !== fingerprint) {
          throw new PolicyIdempotencyConflictProblem(command.policyId, command.idempotencyKey);
        }
        return asReceipt(existing[0]);
      }
      if (
        currentRevision !== command.expectedRevision ||
        revision.revision !== command.expectedRevision + 1
      ) {
        throw new PolicyRevisionConflictProblem(
          command.policyId,
          command.expectedRevision,
          currentRevision ?? 0,
        );
      }
      if (
        revision.policyId !== command.policyId ||
        policyScopeKey(revision.scope) !== scopeKey ||
        receipt.revision !== revision.revision ||
        receipt.hash !== revision.hash
      ) {
        throw new PolicyRevisionConflictProblem(
          command.policyId,
          command.expectedRevision + 1,
          revision.revision,
        );
      }
      await this.execute(transaction, this.revisionInsertValues(revision));
      await this.execute(
        transaction,
        sql`
        update croco_feature_policy_heads set revision=${revision.revision}, updated_at=${this.now()}
        where policy_id=${command.policyId} and scope_key=${scopeKey}
      `,
      );
      await this.execute(
        transaction,
        sql`
        insert into croco_feature_policy_command_receipts
          (id,policy_id,scope_key,idempotency_key,command_fingerprint,command,receipt,created_at)
        values (${receipt.id},${command.policyId},${scopeKey},${command.idempotencyKey},${fingerprint},
          ${json(asCommandJson(command))},${json(receipt)},${this.now()})
      `,
      );
      if (receipt.status === "published") {
        await this.setActiveInTransaction(transaction, command.policyId, command.scope, revision);
      }
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
        await this.execute(
          transaction,
          sql`
          insert into croco_feature_policy_schedules
            (id,policy_id,scope_key,revision,review_hash,effective_at,idempotency_key,state,metadata,created_at,updated_at)
          values (${policyScheduleId(schedule)},${command.policyId},${scopeKey},${revision.revision},${command.reviewHash},
            ${new Date(receipt.effectiveAt)},${publishCommand.idempotencyKey},'pending',${json({ command: publishCommand })},${this.now()},${this.now()})
        `,
        );
      }
      const action =
        revision.rollbackOf !== undefined
          ? "rollback"
          : receipt.status === "scheduled"
            ? "schedule"
            : "publish";
      await this.appendAuditInTransaction(transaction, {
        id: `policy:${action}:${revision.id}`,
        policyId: command.policyId,
        scope: command.scope,
        action,
        revisionId: revision.id,
        revision: revision.revision,
        actor: command.actor,
        reason: command.reason,
        occurredAt: receipt.recordedAt,
      });
      return receipt;
    });
  }

  async recordPause(input: PolicyPauseInput<TValue>): Promise<PolicyCommandReceipt> {
    const { revision, retainedDraft, command, receipt } = input;
    const scopeKey = policyScopeKey(command.scope);
    return this.transaction(async (transaction) => {
      const head = await this.findHead(transaction, command.policyId, command.scope, true);
      const existing = await this.execute(
        transaction,
        sql`
        select command_fingerprint,receipt from croco_feature_policy_command_receipts
        where policy_id=${command.policyId} and scope_key=${scopeKey} and idempotency_key=${command.idempotencyKey}
      `,
      );
      if (existing[0]) {
        if (String(existing[0].command_fingerprint) !== receipt.commandFingerprint) {
          throw new PolicyIdempotencyConflictProblem(command.policyId, command.idempotencyKey);
        }
        return asReceipt(existing[0]);
      }
      if (head !== command.expectedRevision || revision.revision !== command.expectedRevision + 1) {
        throw new PolicyRevisionConflictProblem(
          command.policyId,
          command.expectedRevision,
          head ?? 0,
        );
      }
      if (
        revision.state !== "paused" ||
        revision.policyId !== command.policyId ||
        policyScopeKey(revision.scope) !== scopeKey ||
        receipt.revision !== revision.revision ||
        receipt.hash !== revision.hash ||
        (retainedDraft &&
          (retainedDraft.revision !== revision.revision + 1 ||
            retainedDraft.policyId !== command.policyId ||
            policyScopeKey(retainedDraft.scope) !== scopeKey ||
            !["draft", "reviewed"].includes(retainedDraft.state)))
      ) {
        throw new FeaturePolicyPersistenceProblem(
          "unavailable",
          "Pause revision does not match its command",
        );
      }
      await this.execute(transaction, this.revisionInsertValues(revision));
      if (retainedDraft) await this.execute(transaction, this.revisionInsertValues(retainedDraft));
      await this.setActiveInTransaction(
        transaction,
        command.policyId,
        command.scope,
        revision,
        input.expectedActiveVersion,
      );
      await this.execute(
        transaction,
        sql`
        update croco_feature_policy_heads set revision=${(retainedDraft ?? revision).revision},updated_at=${this.now()}
        where policy_id=${command.policyId} and scope_key=${scopeKey}
      `,
      );
      await this.execute(
        transaction,
        sql`
        insert into croco_feature_policy_command_receipts
          (id,policy_id,scope_key,idempotency_key,command_fingerprint,command,receipt,created_at)
        values (${receipt.id},${command.policyId},${scopeKey},${command.idempotencyKey},${receipt.commandFingerprint},
          ${json(command)},${json(receipt)},${this.now()})
      `,
      );
      await this.appendAuditInTransaction(transaction, {
        id: `policy:pause:${revision.id}`,
        policyId: command.policyId,
        scope: command.scope,
        action: "pause",
        revisionId: revision.id,
        revision: revision.revision,
        actor: command.actor,
        reason: command.reason,
        occurredAt: receipt.recordedAt,
      });
      return receipt;
    });
  }

  private async appendAuditInTransaction(
    executor: FeaturePolicyPgExecutor,
    entry: PolicyAuditEntry,
  ): Promise<void> {
    await this.execute(
      executor,
      sql`
      insert into croco_feature_policy_audit
        (id,policy_id,scope_key,action,revision_id,revision,actor,reason,occurred_at)
      values (${entry.id},${entry.policyId},${policyScopeKey(entry.scope)},${entry.action},${entry.revisionId ?? null},
        ${entry.revision ?? null},${json(entry.actor)},${entry.reason},${new Date(entry.occurredAt)})
      on conflict (id) do nothing
    `,
    );
  }

  async appendAudit(entry: PolicyAuditEntry): Promise<void> {
    await this.appendAuditInTransaction(this.database, entry);
  }

  async listAudit(policyId: string, scope: PolicyScope): Promise<readonly PolicyAuditEntry[]> {
    const rows = await this.execute(
      this.database,
      sql`
      select * from croco_feature_policy_audit where policy_id=${policyId} and scope_key=${policyScopeKey(scope)}
      order by occurred_at, id
    `,
    );
    return rows.map(asAudit);
  }

  private async setActiveInTransaction(
    transaction: FeaturePolicyPgExecutor,
    policyId: string,
    scope: PolicyScope,
    revision: PolicyRevision<TValue>,
    expectedActiveRevision?: number,
  ): Promise<void> {
    const scopeKey = policyScopeKey(scope);
    const existing = await this.execute(
      transaction,
      sql`
        select active_revision from croco_feature_policy_activations
        where policy_id=${policyId} and scope_key=${scopeKey}
        limit 1 for update
      `,
    );
    const current = existing[0] ? Number(existing[0].active_revision) : null;
    if (expectedActiveRevision !== undefined && current !== expectedActiveRevision) {
      throw new PolicyRevisionConflictProblem(policyId, expectedActiveRevision, current ?? 0);
    }
    await this.execute(
      transaction,
      sql`
        insert into croco_feature_policy_activations
          (policy_id,scope_key,active_revision,active_hash,status,changed_at)
        values (${policyId},${scopeKey},${revision.revision},${revision.hash},${revision.state === "paused" ? "paused" : "active"},${this.now()})
        on conflict (policy_id,scope_key) do update set
          active_revision=excluded.active_revision, active_hash=excluded.active_hash,
          status=excluded.status, changed_at=excluded.changed_at
      `,
    );
  }

  async resolve(scope: PolicyScope, policyId: string, at: Date): Promise<PolicyResolution<TValue>> {
    const scopeKey = policyScopeKey(scope);
    const effective = await this.execute(
      this.database,
      sql`
        select r.*, r.fallback is not null as fallback_present,
          case when r.state='published'
            then (r.publication->>'effectiveAt')::timestamptz
            else (r.history->-1->>'occurredAt')::timestamptz
          end as effective_at
        from croco_feature_policy_revisions r
        where r.policy_id=${policyId} and r.scope_key=${scopeKey}
          and r.state in ('published','paused')
          and (r.state='paused' or (r.publication->>'publishedAt')::timestamptz <= ${at})
          and case when r.state='published'
            then (r.publication->>'effectiveAt')::timestamptz
            else (r.history->-1->>'occurredAt')::timestamptz
          end <= ${at}
        order by r.revision desc
        limit 1
      `,
    );
    if (effective[0]) {
      const revision = asRevision<TValue>(effective[0]);
      return asResolution<TValue>(
        effective[0],
        revision.state === "paused"
          ? revision.fallback === undefined
            ? "unavailable"
            : "paused"
          : "active",
      );
    }
    const scheduled = await this.execute(
      this.database,
      sql`
        select r.*, r.fallback is not null as fallback_present from croco_feature_policy_revisions r
        join croco_feature_policy_heads h
          on h.policy_id=r.policy_id and h.scope_key=r.scope_key and h.revision=r.revision
        join croco_feature_policy_schedules s
          on s.policy_id=r.policy_id and s.scope_key=r.scope_key and s.revision=r.revision
        where r.policy_id=${policyId} and r.scope_key=${scopeKey} and r.state='scheduled'
          and s.state in ('pending','claimed','failed')
        limit 1
      `,
    );
    if (scheduled[0]) return asResolution<TValue>(scheduled[0], "scheduled");
    return {
      policyId,
      scope: normalizePolicyScope(scope),
      status: "unavailable",
      reason: "No active policy revision",
    };
  }

  async schedule(input: PolicyScheduleInput): Promise<PolicyScheduleRecord> {
    const effectiveAt = new Date(input.effectiveAt);
    if (Number.isNaN(effectiveAt.getTime())) {
      throw new PolicyScheduleProblem(input.policyId, "effectiveAt must be an ISO timestamp");
    }
    const scopeKey = policyScopeKey(input.scope);
    const id = policyScheduleId(input);
    const now = this.now();
    const rows = await this.execute(
      this.database,
      sql`
        insert into croco_feature_policy_schedules
          (id,policy_id,scope_key,revision,review_hash,effective_at,idempotency_key,state,metadata,created_at,updated_at)
        values
          (${id},${input.policyId},${scopeKey},${input.revision},${input.reviewHash},${effectiveAt},${input.idempotencyKey},
           'pending',${json(input.metadata)},${now},${now})
        on conflict (policy_id,scope_key,idempotency_key) do nothing
        returning *
      `,
    );
    if (rows[0]) return asSchedule(rows[0]);
    const existing = await this.execute(
      this.database,
      sql`
        select * from croco_feature_policy_schedules
        where policy_id=${input.policyId} and scope_key=${scopeKey} and idempotency_key=${input.idempotencyKey}
        limit 1
      `,
    );
    if (!existing[0])
      throw new FeaturePolicyPersistenceProblem(
        "unavailable",
        "Policy schedule insert did not return a row",
      );
    const candidate = asSchedule(existing[0]);
    if (
      candidate.revision !== input.revision ||
      candidate.reviewHash !== input.reviewHash ||
      candidate.effectiveAt !== effectiveAt.toISOString()
    ) {
      throw new PolicyIdempotencyConflictProblem(input.policyId, input.idempotencyKey);
    }
    return candidate;
  }

  async getSchedule(scheduleId: string): Promise<PolicyScheduleRecord | null> {
    const rows = await this.execute(
      this.database,
      sql`select * from croco_feature_policy_schedules where id=${scheduleId} limit 1`,
    );
    return rows[0] ? asSchedule(rows[0]) : null;
  }

  async attachScheduleExecution(
    scheduleId: string,
    executionId: string,
    triggerId?: string,
  ): Promise<PolicyScheduleRecord> {
    const rows = await this.execute(
      this.database,
      sql`
        update croco_feature_policy_schedules set
          execution_id=${executionId}, trigger_id=coalesce(${nullable(triggerId)},trigger_id), updated_at=${this.now()}
        where id=${scheduleId} and state not in ('completed','cancelled')
        returning *
      `,
    );
    if (rows[0]) return asSchedule(rows[0]);
    const existing = await this.execute(
      this.database,
      sql`select * from croco_feature_policy_schedules where id=${scheduleId} limit 1`,
    );
    if (!existing[0]) throw new PolicyScheduleProblem(scheduleId, "schedule was not found");
    return asSchedule(existing[0]);
  }

  async listDueSchedules(now: Date, limit = 100): Promise<readonly PolicyScheduleRecord[]> {
    if (!Number.isSafeInteger(limit) || limit <= 0)
      throw new PolicyScheduleProblem("list", "limit must be positive");
    const rows = await this.execute(
      this.database,
      sql`
        select * from croco_feature_policy_schedules
        where effective_at <= ${now}
          and (state in ('pending','failed') or (state='claimed' and lease_until <= ${now}))
        order by effective_at asc, id asc
        limit ${limit}
      `,
    );
    return rows.map((row) => asSchedule(row));
  }

  async claimSchedule(
    scheduleId: string,
    workerId: string,
    now: Date,
    leaseMs: number,
  ): Promise<PolicyScheduleRecord | null> {
    if (!Number.isSafeInteger(leaseMs) || leaseMs <= 0)
      throw new PolicyScheduleProblem(scheduleId, "leaseMs must be positive");
    return this.transaction(async (transaction) => {
      const rows = await this.execute(
        transaction,
        sql`
          select * from croco_feature_policy_schedules
          where id=${scheduleId}
          limit 1 for update
        `,
      );
      if (!rows[0]) return null;
      const current = asSchedule(rows[0]);
      if (current.state === "completed" || current.state === "cancelled") return null;
      if (current.state === "claimed" && current.leaseUntil && new Date(current.leaseUntil) > now)
        return null;
      if (new Date(current.effectiveAt) > now) return null;
      const claimedUntil = new Date(now.getTime() + leaseMs);
      const updated = await this.execute(
        transaction,
        sql`
          update croco_feature_policy_schedules set
            state='claimed', claimed_by=${workerId}, lease_until=${claimedUntil}, updated_at=${now}
          where id=${scheduleId}
          returning *
        `,
      );
      return updated[0] ? asSchedule(updated[0]) : null;
    });
  }

  async completeSchedule(scheduleId: string, now: Date): Promise<PolicyScheduleRecord> {
    return this.updateScheduleState(scheduleId, "completed", now);
  }

  async failSchedule(scheduleId: string, now: Date, error: string): Promise<PolicyScheduleRecord> {
    return this.updateScheduleState(scheduleId, "failed", now, error);
  }

  async cancelSchedule(
    scheduleId: string,
    now: Date,
    reason: string,
  ): Promise<PolicyScheduleRecord> {
    return this.updateScheduleState(scheduleId, "cancelled", now, reason);
  }

  private async updateScheduleState(
    scheduleId: string,
    state: PolicyScheduleRecord["state"],
    now: Date,
    error?: string,
  ): Promise<PolicyScheduleRecord> {
    const rows = await this.execute(
      this.database,
      sql`
        update croco_feature_policy_schedules set
          state=${state}, lease_until=null, claimed_by=null, last_error=${nullable(error)}, updated_at=${now}
        where id=${scheduleId} and state not in ('completed','cancelled')
        returning *
      `,
    );
    if (rows[0]) return asSchedule(rows[0]);
    const existing = await this.execute(
      this.database,
      sql`select * from croco_feature_policy_schedules where id=${scheduleId} limit 1`,
    );
    if (!existing[0]) throw new PolicyScheduleProblem(scheduleId, "schedule was not found");
    return asSchedule(existing[0]);
  }

  async recordDecision(input: PolicyDecisionInput<TValue>): Promise<PolicyDecisionReference> {
    const id = input.id ?? this.idGenerator();
    const decision = {
      id,
      policyId: input.policyId,
      scope: normalizePolicyScope(input.scope),
      version: input.version,
      revision: input.revision,
      hash: input.hash,
      value: input.value,
      status: input.status,
      ...(input.reason ? { reason: input.reason } : {}),
      evaluatedAt: input.evaluatedAt ?? this.now().toISOString(),
    };
    await this.execute(
      this.database,
      sql`
        insert into croco_feature_policy_decisions
          (id,policy_id,scope_key,version,revision,hash,value,status,reason,evaluated_at)
        values
          (${id},${input.policyId},${policyScopeKey(input.scope)},${input.version},${input.revision},${input.hash},
           ${json(input.value)},${input.status},${nullable(input.reason)},${new Date(decision.evaluatedAt)})
      `,
    );
    return {
      policyId: input.policyId,
      scope: normalizePolicyScope(input.scope),
      version: input.version,
      hash: input.hash,
      decisionId: id,
    };
  }
}
