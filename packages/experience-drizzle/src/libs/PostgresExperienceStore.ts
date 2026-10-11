import { isDeepStrictEqual } from "node:util";
import { sql } from "drizzle-orm";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { SQL } from "drizzle-orm";
import type {
  ExperienceConfig,
  ExperienceReceiptInput,
  ExperienceReserveInput,
  ExperienceSaveInput,
  ExperienceScope,
  ExperienceStore,
  StoredExperienceDecision,
} from "@croco/experience-core";

export interface ExperiencePgExecutor {
  execute(query: SQL): Promise<{ rows: Record<string, unknown>[] }>;
}
export interface ExperiencePgDatabase extends ExperiencePgExecutor {
  transaction<T>(work: (tx: ExperiencePgExecutor) => Promise<T>): Promise<T>;
}

export class ExperienceStoreProblem extends Problem {
  constructor(detail: string) {
    super("experience/store-invalid", ProblemCategory.ValidationError, detail);
  }
}

const MAX_CONFIGS_PER_PLACEMENT = 100;

function scopeKey(scope: ExperienceScope): string {
  if (!scope.appId || !scope.environment || !scope.tenantId)
    throw new ExperienceStoreProblem("A complete experience scope is required");
  return JSON.stringify([scope.appId, scope.environment, scope.tenantId]);
}

function timestamp(value: string): Date {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new ExperienceStoreProblem("An explicit timestamp is required");
  return date;
}

function assertReceipt(input: ExperienceReceiptInput, row: Record<string, unknown>): void {
  const decision = row.decision as StoredExperienceDecision["decision"];
  const handle = row.handle as StoredExperienceDecision["handle"];
  if (
    decision.subject.kind !== input.subject.kind ||
    decision.subject.id !== input.subject.id ||
    !isDeepStrictEqual(handle, input.handle)
  )
    throw new ExperienceStoreProblem(
      "Experience receipt does not match the subject or reservation",
    );
}

/** PostgreSQL adapter for a Drizzle node-postgres execute/transaction boundary. */
export class PostgresExperienceStore implements ExperienceStore {
  constructor(private readonly database: ExperiencePgDatabase) {}

  async listConfigs(
    scope: ExperienceScope,
    placementId: string,
  ): Promise<readonly ExperienceConfig[]> {
    if (!placementId) throw new ExperienceStoreProblem("Placement id is required");
    const result = await this.database.execute(sql`
      SELECT revisions.config FROM croco_experience_current current_config
      JOIN croco_experience_config_revisions revisions
        ON revisions.scope_key = current_config.scope_key
       AND revisions.config_id = current_config.config_id
       AND revisions.revision = current_config.revision
      WHERE current_config.scope_key = ${scopeKey(scope)}
        AND current_config.placement_id = ${placementId}
      ORDER BY current_config.config_id
      LIMIT ${MAX_CONFIGS_PER_PLACEMENT + 1}
    `);
    if (result.rows.length > MAX_CONFIGS_PER_PLACEMENT)
      throw new ExperienceStoreProblem("Placement exceeds the configuration limit");
    return result.rows.map((row) => row.config as ExperienceConfig);
  }

  async saveConfig(input: ExperienceSaveInput): Promise<ExperienceConfig> {
    const { config, expectedRevision, actorId, reason, idempotencyKey } = input;
    const key = scopeKey(config.scope);
    if (
      !config.id ||
      !config.placementId ||
      !actorId.trim() ||
      !reason.trim() ||
      !idempotencyKey.trim() ||
      !Number.isSafeInteger(config.revision) ||
      config.revision < 1 ||
      (expectedRevision !== null &&
        (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1))
    )
      throw new ExperienceStoreProblem(
        "Configuration identity, revision, and audit evidence are required",
      );
    return this.database.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}), hashtext(${config.id}))`);
      const prior = await tx.execute(sql`
        SELECT config FROM croco_experience_config_revisions
        WHERE scope_key = ${key} AND config_id = ${config.id} AND idempotency_key = ${idempotencyKey}
      `);
      if (prior.rows[0]) {
        const stored = prior.rows[0].config as ExperienceConfig;
        if (!isDeepStrictEqual(stored, config))
          throw new ExperienceStoreProblem(
            "Idempotency key already names a different configuration",
          );
        return stored;
      }
      const current = await tx.execute(sql`
        SELECT revision, placement_id FROM croco_experience_current
        WHERE scope_key = ${key} AND config_id = ${config.id} FOR UPDATE
      `);
      const revision = current.rows[0]?.revision;
      if (
        (revision === undefined
          ? expectedRevision !== null
          : Number(revision) !== expectedRevision) ||
        config.revision !== (revision === undefined ? 1 : Number(revision) + 1) ||
        (current.rows[0] && current.rows[0].placement_id !== config.placementId)
      )
        throw new ExperienceStoreProblem("Configuration revision or placement changed");
      await tx.execute(sql`
        INSERT INTO croco_experience_config_revisions
          (scope_key, config_id, revision, placement_id, config, actor_id, reason, idempotency_key)
        VALUES (${key}, ${config.id}, ${config.revision}, ${config.placementId},
          ${JSON.stringify(config)}::jsonb, ${actorId}, ${reason}, ${idempotencyKey})
      `);
      await tx.execute(sql`
        INSERT INTO croco_experience_current (scope_key, config_id, placement_id, revision, status)
        VALUES (${key}, ${config.id}, ${config.placementId}, ${config.revision}, ${config.status})
        ON CONFLICT (scope_key, config_id) DO UPDATE SET
          revision = EXCLUDED.revision, status = EXCLUDED.status
      `);
      return config;
    });
  }

  async reserve(input: ExperienceReserveInput): Promise<boolean> {
    const { decision, handle } = input.receipt;
    const key = scopeKey(decision.scope);
    const selectedAt = timestamp(decision.selectedAt);
    const expiresAt = timestamp(decision.expiresAt);
    if (
      !decision.decisionId ||
      !decision.configId ||
      !decision.placementId ||
      !decision.subject.id ||
      !decision.subject.kind ||
      !handle.token ||
      !handle.exposureId ||
      !handle.surfaceInstanceId ||
      handle.decisionId !== decision.decisionId ||
      expiresAt <= selectedAt
    )
      throw new ExperienceStoreProblem("Invalid decision reservation");
    const frequency = input.frequency;
    if (
      frequency &&
      (!Number.isSafeInteger(frequency.maxDisplays) ||
        frequency.maxDisplays < 1 ||
        !Number.isSafeInteger(frequency.windowSeconds) ||
        frequency.windowSeconds < 1)
    )
      throw new ExperienceStoreProblem("Invalid frequency policy");
    return this.database.transaction(async (tx) => {
      const subjectKey = JSON.stringify([
        decision.placementId,
        decision.subject.kind,
        decision.subject.id,
      ]);
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${key}), hashtext(${subjectKey}))`,
      );
      const current = await tx.execute(sql`
        SELECT revision, status FROM croco_experience_current
        WHERE scope_key = ${key} AND config_id = ${decision.configId}
          AND placement_id = ${decision.placementId} FOR UPDATE
      `);
      if (
        current.rows[0]?.status !== "published" ||
        Number(current.rows[0]?.revision) !== decision.policyVersion
      )
        return false;
      const dismissal = await tx.execute(sql`
        SELECT 1 FROM croco_experience_dismissals
        WHERE scope_key = ${key} AND config_id = ${decision.configId}
          AND subject_kind = ${decision.subject.kind} AND subject_id = ${decision.subject.id}
      `);
      if (dismissal.rows.length > 0) return false;
      if (frequency) {
        const since = new Date(selectedAt.getTime() - frequency.windowSeconds * 1000);
        const prior = await tx.execute(sql`
          SELECT count(*)::integer AS count FROM croco_experience_decisions
          WHERE scope_key = ${key} AND config_id = ${decision.configId}
            AND subject_kind = ${decision.subject.kind} AND subject_id = ${decision.subject.id}
            AND (
              (displayed_at IS NOT NULL AND displayed_at >= ${since})
              OR (displayed_at IS NULL AND expires_at > ${selectedAt})
            )
        `);
        if (Number(prior.rows[0]?.count) >= frequency.maxDisplays) return false;
      }
      await tx.execute(sql`
        INSERT INTO croco_experience_decisions
          (decision_id, scope_key, placement_id, config_id, revision, subject_kind, subject_id,
           decision, handle, token, exposure_id, surface_instance_id, selected_at, expires_at)
        VALUES (${decision.decisionId}, ${key}, ${decision.placementId}, ${decision.configId},
          ${decision.policyVersion}, ${decision.subject.kind}, ${decision.subject.id},
          ${JSON.stringify(decision)}::jsonb, ${JSON.stringify(handle)}::jsonb, ${handle.token},
          ${handle.exposureId}, ${handle.surfaceInstanceId}, ${selectedAt}, ${expiresAt})
      `);
      return true;
    });
  }

  async readDecision(
    scope: ExperienceScope,
    decisionId: string,
  ): Promise<StoredExperienceDecision | undefined> {
    const result = await this.database.execute(sql`
      SELECT decision, handle FROM croco_experience_decisions
      WHERE scope_key = ${scopeKey(scope)} AND decision_id = ${decisionId}
    `);
    const row = result.rows[0];
    return row
      ? {
          decision: row.decision as StoredExperienceDecision["decision"],
          handle: row.handle as StoredExperienceDecision["handle"],
        }
      : undefined;
  }

  async recordExposure(input: ExperienceReceiptInput): Promise<"recorded" | "duplicate"> {
    const at = timestamp(input.at);
    return this.database.transaction(async (tx) => {
      const key = scopeKey(input.scope);
      const initial = await tx.execute(sql`
        SELECT decision FROM croco_experience_decisions
        WHERE scope_key = ${key} AND decision_id = ${input.handle.decisionId}
      `);
      const initialDecision = initial.rows[0]?.decision as
        | StoredExperienceDecision["decision"]
        | undefined;
      if (!initialDecision)
        throw new ExperienceStoreProblem("Experience reservation is unavailable");
      const subjectKey = JSON.stringify([
        initialDecision.placementId,
        initialDecision.subject.kind,
        initialDecision.subject.id,
      ]);
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${key}), hashtext(${subjectKey}))`,
      );
      const result = await tx.execute(sql`
        SELECT decision, handle, selected_at, expires_at, displayed_at, clock_timestamp() AS observed_at
        FROM croco_experience_decisions
        WHERE scope_key = ${key} AND decision_id = ${input.handle.decisionId}
        FOR UPDATE
      `);
      const row = result.rows[0];
      if (!row) throw new ExperienceStoreProblem("Experience reservation is unavailable");
      assertReceipt(input, row);
      if (row.displayed_at) return "duplicate";
      if (
        at < new Date(String(row.selected_at)) ||
        at >= new Date(String(row.expires_at)) ||
        new Date(String(row.observed_at)) >= new Date(String(row.expires_at))
      )
        throw new ExperienceStoreProblem("Experience reservation expired before display");
      await tx.execute(sql`
        UPDATE croco_experience_decisions SET displayed_at = ${at}
        WHERE decision_id = ${input.handle.decisionId}
      `);
      return "recorded";
    });
  }

  async dismiss(input: ExperienceReceiptInput): Promise<void> {
    const at = timestamp(input.at);
    await this.database.transaction(async (tx) => {
      const key = scopeKey(input.scope);
      const initial = await tx.execute(sql`
        SELECT decision FROM croco_experience_decisions
        WHERE scope_key = ${key} AND decision_id = ${input.handle.decisionId}
      `);
      const initialDecision = initial.rows[0]?.decision as
        | StoredExperienceDecision["decision"]
        | undefined;
      if (!initialDecision)
        throw new ExperienceStoreProblem("Experience reservation is unavailable");
      const subjectKey = JSON.stringify([
        initialDecision.placementId,
        input.subject.kind,
        input.subject.id,
      ]);
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${key}), hashtext(${subjectKey}))`,
      );
      const result = await tx.execute(sql`
        SELECT decision, handle, selected_at, expires_at, displayed_at FROM croco_experience_decisions
        WHERE scope_key = ${key} AND decision_id = ${input.handle.decisionId} FOR UPDATE
      `);
      const row = result.rows[0];
      if (!row) throw new ExperienceStoreProblem("Experience reservation is unavailable");
      assertReceipt(input, row);
      if (
        at < new Date(String(row.selected_at)) ||
        (!row.displayed_at && at >= new Date(String(row.expires_at)))
      )
        throw new ExperienceStoreProblem("Experience reservation expired before dismissal");
      const decision = row.decision as StoredExperienceDecision["decision"];
      await tx.execute(sql`
        INSERT INTO croco_experience_dismissals
          (scope_key, config_id, subject_kind, subject_id, dismissed_at)
        VALUES (${key}, ${decision.configId}, ${input.subject.kind}, ${input.subject.id}, ${at})
        ON CONFLICT (scope_key, config_id, subject_kind, subject_id) DO NOTHING
      `);
    });
  }
}
