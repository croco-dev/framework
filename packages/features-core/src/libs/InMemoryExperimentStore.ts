import {
  assertExperimentOwnership,
  experimentActive,
  experimentAssignmentKey,
  experimentKey,
  ExperimentProblem,
} from "./Experiment";
import { stableStringify } from "./Policy";
import type {
  ExperimentConfigureCommand,
  ExperimentConfigureReceipt,
  ExperimentAssignment,
  ExperimentCommand,
  ExperimentCommandReceipt,
  ExperimentExposure,
  ExperimentRecord,
  ExperimentScope,
  ExperimentStore,
  ExperimentSubject,
  ExperimentTarget,
  ExperimentAdmission,
} from "./Experiment";

/** Single-process reference store. Durable multi-worker deployments must inject a transactional store. */
export class InMemoryExperimentStore implements ExperimentStore {
  private readonly configurationReceipts = new Map<string, ExperimentConfigureReceipt>();
  private readonly records = new Map<string, ExperimentRecord>();
  private readonly assignments = new Map<string, ExperimentAssignment>();
  private readonly winners = new Map<string, string>();
  private readonly receipts = new Map<string, ExperimentCommandReceipt>();
  private readonly exposures = new Map<string, ExperimentExposure>();
  async configure(
    command: ExperimentConfigureCommand,
    record: ExperimentRecord,
    fingerprint: string,
    now: string,
  ): Promise<ExperimentConfigureReceipt> {
    const key = stableStringify([experimentKey(command), command.idempotencyKey]);
    const prior = this.configurationReceipts.get(key);
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new ExperimentProblem(
          "idempotency-conflict",
          "Configuration key reused with different payload",
        );
      return structuredClone(prior);
    }
    if (this.receipts.has(key))
      throw new ExperimentProblem("idempotency-conflict", "Command key already used");
    const source = this.records.get(experimentKey(command));
    if (!source) throw new ExperimentProblem("missing", "Source experiment does not exist");
    if (source.codeRevision !== record.codeRevision)
      throw new ExperimentProblem(
        "conflict",
        "Configured revision must preserve its code registration",
      );
    if (source.version !== command.expectedRevision || this.records.has(experimentKey(record)))
      throw new ExperimentProblem(
        "conflict",
        "Source version changed or target revision already exists",
      );
    const receipt = {
      command: structuredClone(command),
      record: structuredClone(record),
      fingerprint,
      occurredAt: now,
    };
    this.records.set(experimentKey(record), structuredClone(record));
    this.configurationReceipts.set(key, receipt);
    return structuredClone(receipt);
  }
  async register(record: ExperimentRecord): Promise<ExperimentRecord> {
    const key = experimentKey(record);
    const existing = this.records.get(key);
    if (
      existing &&
      (existing.definitionHash !== record.definitionHash ||
        existing.codeRevision !== record.codeRevision)
    )
      throw new ExperimentProblem("conflict", "A definition revision is immutable");
    if (!existing) this.records.set(key, structuredClone(record));
    return structuredClone(existing ?? record);
  }
  async get(target: ExperimentTarget): Promise<ExperimentRecord | null> {
    return structuredClone(this.records.get(experimentKey(target)) ?? null);
  }
  async list(scope: ExperimentScope): Promise<readonly ExperimentRecord[]> {
    return structuredClone(
      [...this.records.values()].filter(
        (record) => stableStringify(record.scope) === stableStringify(scope),
      ),
    );
  }
  async command(
    command: ExperimentCommand,
    fingerprint: string,
    now: string,
  ): Promise<ExperimentCommandReceipt> {
    const key = experimentKey(command);
    const receiptKey = stableStringify([key, command.idempotencyKey]);
    if (this.configurationReceipts.has(receiptKey))
      throw new ExperimentProblem("idempotency-conflict", "Command key already used");
    const prior = this.receipts.get(receiptKey);
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new ExperimentProblem(
          "idempotency-conflict",
          "Command key reused with different payload",
        );
      return structuredClone(prior);
    }
    const current = this.records.get(key);
    if (!current) throw new ExperimentProblem("missing", "Experiment is not registered");
    if (current.version !== command.expectedRevision)
      throw new ExperimentProblem("conflict", "Experiment version changed");
    if (
      current.state === "stopped" ||
      (command.action === "start" && current.state !== "draft" && current.state !== "paused") ||
      (command.action === "pause" && current.state !== "running")
    )
      throw new ExperimentProblem("conflict", "Invalid experiment state transition");
    const record: ExperimentRecord = {
      ...current,
      version: current.version + 1,
      state:
        command.action === "start" ? "running" : command.action === "pause" ? "paused" : "stopped",
    };
    const receipt: ExperimentCommandReceipt = {
      command: structuredClone(command),
      fingerprint,
      record,
      occurredAt: now,
    };
    this.records.set(key, record);
    this.receipts.set(receiptKey, receipt);
    return structuredClone(receipt);
  }
  async assign(candidate: ExperimentAssignment, now: string): Promise<ExperimentAdmission> {
    const record = this.records.get(experimentKey(candidate));
    if (!record || !experimentActive(record, now))
      return { status: "not_assigned", reason: "experiment_inactive" };
    const key = experimentAssignmentKey(candidate, candidate.subject);
    const winnerId = this.winners.get(key);
    const winner = winnerId ? this.assignments.get(winnerId) : undefined;
    if (winner) return { status: "admitted", assignment: structuredClone(winner) };
    if (this.assignments.has(candidate.id))
      throw new ExperimentProblem("conflict", "Assignment id collision");
    this.assignments.set(candidate.id, structuredClone(candidate));
    this.winners.set(key, candidate.id);
    return { status: "admitted", assignment: structuredClone(candidate) };
  }
  async getAssignment(id: string): Promise<ExperimentAssignment | null> {
    return structuredClone(this.assignments.get(id) ?? null);
  }
  async admit(
    id: string,
    scope: ExperimentScope,
    subject: ExperimentSubject,
    now: string,
  ): Promise<ExperimentAdmission> {
    const assignment = this.assignments.get(id);
    if (!assignment) throw new ExperimentProblem("missing", "Assignment does not exist");
    assertExperimentOwnership(assignment, scope, subject);
    const record = this.records.get(experimentKey(assignment));
    return record && experimentActive(record, now)
      ? { status: "admitted", assignment: structuredClone(assignment) }
      : { status: "not_assigned", reason: "experiment_inactive" };
  }
  async recordExposure(
    exposure: ExperimentExposure,
    scope: ExperimentScope,
    subject: ExperimentSubject,
  ): Promise<ExperimentExposure> {
    const assignment = this.assignments.get(exposure.assignmentId);
    if (!assignment) throw new ExperimentProblem("missing", "Assignment does not exist");
    assertExperimentOwnership(assignment, scope, subject);
    const key = stableStringify([exposure.assignmentId, exposure.deliveryInstanceId]);
    const prior = this.exposures.get(key);
    if (prior && (prior.kind !== exposure.kind || prior.occurredAt !== exposure.occurredAt))
      throw new ExperimentProblem(
        "idempotency-conflict",
        "Delivery key reused with different exposure",
      );
    if (!prior) this.exposures.set(key, structuredClone(exposure));
    return structuredClone(prior ?? exposure);
  }
}
