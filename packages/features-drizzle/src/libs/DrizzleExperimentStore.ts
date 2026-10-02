import { sql } from "drizzle-orm";
import {
  assertExperimentOwnership,
  experimentActive,
  experimentKey,
  ExperimentProblem,
  PolicyProblem,
  normalizePolicyScope,
  policyScopeKey,
  stableStringify,
} from "@croco/features-core";
import type {
  ExperimentAdmission,
  ExperimentAssignment,
  ExperimentCommand,
  ExperimentCommandReceipt,
  ExperimentConfigureCommand,
  ExperimentConfigureReceipt,
  ExperimentExposure,
  ExperimentRecord,
  ExperimentScope,
  ExperimentStore,
  ExperimentSubject,
  ExperimentTarget,
} from "@croco/features-core";
import type { FeaturePolicyPgDatabase, FeaturePolicyPgExecutor } from "./DrizzlePolicyReleaseStore";

const json = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`;

/** PostgreSQL owns admission and command serialization, including across application restarts. */
export class DrizzleExperimentStore implements ExperimentStore {
  private readonly database: FeaturePolicyPgDatabase;

  constructor(database: FeaturePolicyPgDatabase) {
    this.database = {
      execute: (query) => this.persist(() => database.execute(query)),
      transaction: (work) => this.persist(() => database.transaction(work)),
    };
  }

  private async persist<T>(operation: () => PromiseLike<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ExperimentProblem || error instanceof PolicyProblem) throw error;
      let cause: unknown = error;
      while (cause instanceof Error) {
        if ("code" in cause && cause.code === "23505") {
          throw new ExperimentProblem("conflict", "Experiment persistence identity conflict", {
            cause: error instanceof Error ? error : undefined,
          });
        }
        cause = cause.cause;
      }
      throw new ExperimentProblem("unavailable", "Experiment persistence failed", {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async register(record: ExperimentRecord): Promise<ExperimentRecord> {
    const normalized = { ...record, scope: normalizePolicyScope(record.scope) };
    return this.database.transaction(async (tx) => {
      const key = experimentKey(normalized);
      await tx.execute(sql`insert into croco_feature_experiments
        (target_key, experiment_id, experiment_revision, scope_key, record)
        values (${key}, ${record.experimentId}, ${record.experimentRevision},
          ${policyScopeKey(record.scope)}, ${json(normalized)}) on conflict (target_key) do nothing`);
      const existing = await this.required(tx, record, true);
      if (
        existing.codeRevision !== record.codeRevision ||
        existing.definitionHash !== record.definitionHash ||
        stableStringify(existing.definition) !== stableStringify(record.definition)
      ) {
        throw new ExperimentProblem("conflict", "Experiment revision definition is immutable");
      }
      return existing;
    });
  }

  async get(target: ExperimentTarget): Promise<ExperimentRecord | null> {
    return this.read(this.database, target);
  }

  async list(scope: ExperimentScope): Promise<readonly ExperimentRecord[]> {
    const result = await this.database.execute(sql`select record from croco_feature_experiments
      where scope_key = ${policyScopeKey(scope)} order by experiment_id, experiment_revision`);
    return result.rows.map((row) => row.record as ExperimentRecord);
  }

  async command(
    command: ExperimentCommand,
    fingerprint: string,
    now: string,
  ): Promise<ExperimentCommandReceipt> {
    return this.database.transaction(async (tx) => {
      const record = await this.required(tx, command, true);
      const key = experimentKey(command);
      const previous =
        await tx.execute(sql`select fingerprint, receipt from croco_feature_experiment_commands
        where target_key = ${key} and idempotency_key = ${command.idempotencyKey}`);
      const prior = previous.rows[0];
      if (prior) {
        if (
          prior.fingerprint !== fingerprint ||
          stableStringify((prior.receipt as ExperimentCommandReceipt).command) !==
            stableStringify(command)
        ) {
          throw new ExperimentProblem(
            "idempotency-conflict",
            "Command key was already used with different input",
          );
        }
        return prior.receipt as ExperimentCommandReceipt;
      }
      if (record.version !== command.expectedRevision)
        throw new ExperimentProblem("conflict", "Experiment version changed");
      const allowed =
        command.action === "start"
          ? record.state === "draft" || record.state === "paused"
          : command.action === "pause"
            ? record.state === "running"
            : record.state !== "stopped";
      if (!allowed)
        throw new ExperimentProblem("conflict", "Experiment state does not allow this command");
      const next: ExperimentRecord = {
        ...record,
        state:
          command.action === "start"
            ? "running"
            : command.action === "pause"
              ? "paused"
              : "stopped",
        version: record.version + 1,
      };
      const receipt: ExperimentCommandReceipt = {
        command,
        fingerprint,
        record: next,
        occurredAt: now,
      };
      await tx.execute(
        sql`update croco_feature_experiments set record = ${json(next)} where target_key = ${key}`,
      );
      await tx.execute(sql`insert into croco_feature_experiment_commands (target_key, idempotency_key, fingerprint, receipt)
        values (${key}, ${command.idempotencyKey}, ${fingerprint}, ${json(receipt)})`);
      await tx.execute(sql`insert into croco_feature_experiment_audit (target_key, idempotency_key, receipt)
        values (${key}, ${command.idempotencyKey}, ${json(receipt)})`);
      return receipt;
    });
  }

  async configure(
    command: ExperimentConfigureCommand,
    record: ExperimentRecord,
    fingerprint: string,
    now: string,
  ): Promise<ExperimentConfigureReceipt> {
    return this.database.transaction(async (tx) => {
      const source = await this.required(tx, command, true);
      const key = experimentKey(command);
      const previous =
        await tx.execute(sql`select fingerprint, receipt from croco_feature_experiment_commands
        where target_key = ${key} and idempotency_key = ${command.idempotencyKey}`);
      const prior = previous.rows[0];
      if (prior) {
        const receipt = prior.receipt as ExperimentConfigureReceipt;
        if (
          prior.fingerprint !== fingerprint ||
          stableStringify(receipt.command) !== stableStringify(command)
        ) {
          throw new ExperimentProblem(
            "idempotency-conflict",
            "Command key was already used with different input",
          );
        }
        return receipt;
      }
      if (source.version !== command.expectedRevision)
        throw new ExperimentProblem("conflict", "Experiment version changed");
      if (
        record.codeRevision !== source.codeRevision ||
        record.experimentId !== command.experimentId ||
        record.experimentRevision === command.experimentRevision ||
        policyScopeKey(record.scope) !== policyScopeKey(command.scope) ||
        record.state !== "draft" ||
        record.version !== 0 ||
        stableStringify(record.definition) !== stableStringify(command.definition)
      ) {
        throw new ExperimentProblem(
          "invalid",
          "Configured revision must be a new draft for the same experiment and scope",
        );
      }
      const normalized = { ...record, scope: normalizePolicyScope(record.scope) };
      const inserted = await tx.execute(sql`insert into croco_feature_experiments
        (target_key, experiment_id, experiment_revision, scope_key, record)
        values (${experimentKey(record)}, ${record.experimentId}, ${record.experimentRevision},
          ${policyScopeKey(record.scope)}, ${json(normalized)}) on conflict (target_key) do nothing returning target_key`);
      if (!inserted.rows[0])
        throw new ExperimentProblem("conflict", "Configured experiment revision already exists");
      const receipt: ExperimentConfigureReceipt = {
        command,
        fingerprint,
        record: normalized,
        occurredAt: now,
      };
      await tx.execute(sql`insert into croco_feature_experiment_commands (target_key, idempotency_key, fingerprint, receipt)
        values (${key}, ${command.idempotencyKey}, ${fingerprint}, ${json(receipt)})`);
      await tx.execute(sql`insert into croco_feature_experiment_audit (target_key, idempotency_key, receipt)
        values (${key}, ${command.idempotencyKey}, ${json(receipt)})`);
      return receipt;
    });
  }

  async assign(candidate: ExperimentAssignment, now: string): Promise<ExperimentAdmission> {
    return this.database.transaction(async (tx) => {
      const record = await this.required(tx, candidate, true);
      if (!experimentActive(record, now))
        return {
          status: "not_assigned",
          reason: "Experiment is not running in its admission window",
        };
      if (
        (candidate.subject.kind !== record.definition.unit &&
          !(
            record.definition.unit === "anonymous" &&
            record.definition.loginPolicy === "switch-unit" &&
            candidate.subject.kind === "user"
          )) ||
        (record.definition.unit === "tenant" &&
          candidate.subject.id !== candidate.scope.tenantId) ||
        !candidate.subject.id.trim() ||
        !record.definition.variants.some(
          (variant) => variant.id === candidate.variant && variant.value === candidate.value,
        )
      ) {
        throw new ExperimentProblem(
          "invalid",
          "Assignment does not match the registered experiment",
        );
      }
      const normalized = { ...candidate, scope: normalizePolicyScope(candidate.scope) };
      const key = experimentKey(candidate);
      await tx.execute(sql`insert into croco_feature_experiment_assignments
        (id, target_key, subject_kind, subject_id, assignment)
        values (${candidate.id}, ${key}, ${candidate.subject.kind}, ${candidate.subject.id}, ${json(normalized)})
        on conflict (target_key, subject_kind, subject_id) do nothing`);
      const winner =
        await tx.execute(sql`select assignment from croco_feature_experiment_assignments
        where target_key = ${key} and subject_kind = ${candidate.subject.kind} and subject_id = ${candidate.subject.id}`);
      const row = winner.rows[0];
      if (!row) throw new ExperimentProblem("missing", "Assignment winner is missing");
      return { status: "admitted", assignment: row.assignment as ExperimentAssignment };
    });
  }

  async getAssignment(id: string): Promise<ExperimentAssignment | null> {
    const result = await this.database.execute(
      sql`select assignment from croco_feature_experiment_assignments where id = ${id}`,
    );
    return result.rows[0] ? (result.rows[0].assignment as ExperimentAssignment) : null;
  }

  async admit(
    id: string,
    scope: ExperimentScope,
    subject: ExperimentSubject,
    now: string,
  ): Promise<ExperimentAdmission> {
    return this.database.transaction(async (tx) => {
      const assignment = await this.ownedAssignment(tx, id, scope, subject);
      const record = await this.required(tx, assignment, true);
      return experimentActive(record, now)
        ? { status: "admitted", assignment }
        : { status: "not_assigned", reason: "Experiment is not running in its admission window" };
    });
  }

  async recordExposure(
    exposure: ExperimentExposure,
    scope: ExperimentScope,
    subject: ExperimentSubject,
  ): Promise<ExperimentExposure> {
    return this.database.transaction(async (tx) => {
      await this.ownedAssignment(tx, exposure.assignmentId, scope, subject);
      await tx.execute(sql`insert into croco_feature_experiment_exposures (id, assignment_id, delivery_instance_id, exposure)
        values (${exposure.id}, ${exposure.assignmentId}, ${exposure.deliveryInstanceId}, ${json(exposure)})
        on conflict (assignment_id, delivery_instance_id) do nothing`);
      const result = await tx.execute(sql`select exposure from croco_feature_experiment_exposures
        where assignment_id = ${exposure.assignmentId} and delivery_instance_id = ${exposure.deliveryInstanceId}`);
      const row = result.rows[0];
      if (!row) throw new ExperimentProblem("missing", "Exposure winner is missing");
      const winner = row.exposure as ExperimentExposure;
      if (winner.kind !== exposure.kind || winner.occurredAt !== exposure.occurredAt) {
        throw new ExperimentProblem(
          "idempotency-conflict",
          "Delivery was already recorded with different exposure input",
        );
      }
      return winner;
    });
  }

  private async ownedAssignment(
    tx: FeaturePolicyPgExecutor,
    id: string,
    scope: ExperimentScope,
    subject: ExperimentSubject,
  ): Promise<ExperimentAssignment> {
    const result = await tx.execute(
      sql`select assignment from croco_feature_experiment_assignments where id = ${id}`,
    );
    const row = result.rows[0];
    if (!row) throw new ExperimentProblem("missing", "Assignment is missing");
    const assignment = row.assignment as ExperimentAssignment;
    assertExperimentOwnership(assignment, scope, subject);
    return assignment;
  }

  private async read(
    tx: FeaturePolicyPgExecutor,
    target: ExperimentTarget,
    lock = false,
  ): Promise<ExperimentRecord | null> {
    const result = await tx.execute(
      sql`select record from croco_feature_experiments where target_key = ${experimentKey(target)} ${lock ? sql`for update` : sql``}`,
    );
    return result.rows[0] ? (result.rows[0].record as ExperimentRecord) : null;
  }

  private async required(
    tx: FeaturePolicyPgExecutor,
    target: ExperimentTarget,
    lock: boolean,
  ): Promise<ExperimentRecord> {
    const record = await this.read(tx, target, lock);
    if (!record) throw new ExperimentProblem("missing", "Experiment is not registered");
    return record;
  }
}
