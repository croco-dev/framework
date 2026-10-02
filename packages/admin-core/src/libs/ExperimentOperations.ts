import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  DetailedEvaluation,
  ExperimentDefinition,
  ExperimentInput,
  ExperimentRecord,
  ExperimentRuntime,
  ExperimentScope,
  ExperimentSubject,
  ExperimentTarget,
} from "@croco/features-core";

export type ExperimentAdminPermission =
  | "experiment.read"
  | "experiment.preview"
  | "experiment.operate"
  | "experiment.configure";
/** Construct only from server authentication and authorization, never request JSON. */
export type ExperimentAdminAccess = Readonly<{
  scope: ExperimentScope & { tenantId: string | null };
  actor: string;
  permissions: readonly ExperimentAdminPermission[];
}>;
export type ExperimentAdminSample = Readonly<{
  id: string;
  label: string;
  subject: ExperimentSubject;
  context?: Readonly<Record<string, unknown>>;
}>;
export type ExperimentAdminSnapshot = Readonly<{
  target: ExperimentTarget;
  definition: Omit<ExperimentDefinition, "salt">;
  state: ExperimentRecord["state"];
  version: number;
  samples: readonly Readonly<{ id: string; label: string }>[];
  canPreview: boolean;
  canOperate: boolean;
  canConfigure: boolean;
  eligibilityOptions: readonly string[];
}>;
export type ExperimentAdminCommand = ExperimentTarget &
  Readonly<{
    action: "start" | "pause" | "stop";
    expectedRevision: number;
    reason: string;
    idempotencyKey: string;
  }>;
export type ExperimentAdminConfiguration = Omit<
  ExperimentDefinition,
  "salt" | "id" | "allocatorVersion"
>;
export type ExperimentAdminConfigureCommand = Omit<ExperimentAdminCommand, "action"> &
  Readonly<{ configuration: ExperimentAdminConfiguration }>;
export class ExperimentAdminProblem extends Problem {
  constructor() {
    super(
      "features/experiment/admin-denied",
      ProblemCategory.Forbidden,
      "Experiment scope or permission denied",
    );
  }
}

/** Server-owned samples are authorized again by the runtime before evaluation. */
export class ExperimentOperations {
  constructor(
    private readonly runtime: ExperimentRuntime,
    private readonly samples: (access: ExperimentAdminAccess) => readonly ExperimentAdminSample[],
    private readonly eligibilityOptions: readonly string[],
  ) {}

  async read(
    target: ExperimentTarget,
    access: ExperimentAdminAccess,
  ): Promise<ExperimentAdminSnapshot> {
    this.authorize(target, access, "experiment.read");
    const record = await this.runtime.get(target, access.actor);
    if (!record) throw new ExperimentAdminProblem();
    return this.snapshot(record, access);
  }

  async preview(
    target: ExperimentTarget,
    sampleId: string,
    access: ExperimentAdminAccess,
  ): Promise<DetailedEvaluation> {
    this.authorize(target, access, "experiment.preview");
    const sample = this.samples(access).find((entry) => entry.id === sampleId);
    if (!sample) throw new ExperimentAdminProblem();
    const input: ExperimentInput = {
      ...target,
      actor: access.actor,
      subject: sample.subject,
      context: sample.context,
    };
    const result = await this.runtime.preview(input);
    // Provider metadata may contain private identifiers; only the decision is public.
    return result.status === "evaluated"
      ? {
          status: result.status,
          value: result.value,
          reason: result.reason,
          appRevision: result.appRevision,
        }
      : { status: result.status, reason: result.reason };
  }

  async command(
    command: ExperimentAdminCommand,
    access: ExperimentAdminAccess,
  ): Promise<ExperimentAdminSnapshot> {
    this.authorize(command, access, "experiment.operate");
    if (
      typeof command.reason !== "string" ||
      !command.reason.trim() ||
      typeof command.idempotencyKey !== "string" ||
      !command.idempotencyKey.trim() ||
      !Number.isSafeInteger(command.expectedRevision) ||
      command.expectedRevision < 0
    )
      throw new ExperimentAdminProblem();
    const receipt = await this.runtime.command({
      experimentId: command.experimentId,
      experimentRevision: command.experimentRevision,
      scope: access.scope,
      action: command.action,
      expectedRevision: command.expectedRevision,
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
      actor: access.actor,
    });
    return this.snapshot(receipt.record, access);
  }

  async configure(
    command: ExperimentAdminConfigureCommand,
    access: ExperimentAdminAccess,
  ): Promise<ExperimentAdminSnapshot> {
    this.authorize(command, access, "experiment.configure");
    if (!this.eligibilityOptions.includes(command.configuration.eligibility))
      throw new ExperimentAdminProblem();
    const source = await this.runtime.get(command, access.actor);
    if (!source) throw new ExperimentAdminProblem();
    const configuration = command.configuration;
    const receipt = await this.runtime.configure({
      experimentId: command.experimentId,
      experimentRevision: command.experimentRevision,
      scope: access.scope,
      action: "configure",
      expectedRevision: command.expectedRevision,
      actor: access.actor,
      reason: command.reason,
      idempotencyKey: command.idempotencyKey,
      definition: {
        id: source.definition.id,
        salt: source.definition.salt,
        allocatorVersion: source.definition.allocatorVersion,
        revision: configuration.revision,
        unit: configuration.unit,
        loginPolicy: configuration.loginPolicy,
        allocation: configuration.allocation,
        variants: configuration.variants,
        hypothesis: configuration.hypothesis,
        observationPlan: configuration.observationPlan,
        eligibility: configuration.eligibility,
        startsAt: configuration.startsAt,
        endsAt: configuration.endsAt,
      },
    });
    return this.snapshot(receipt.record, access);
  }

  private authorize(
    target: ExperimentTarget,
    access: ExperimentAdminAccess,
    permission: ExperimentAdminPermission,
  ): void {
    if (
      access.scope.tenantId === undefined ||
      target.scope.tenantId === undefined ||
      !access.actor.trim() ||
      access.scope.app !== target.scope.app ||
      access.scope.environment !== target.scope.environment ||
      access.scope.tenantId !== target.scope.tenantId ||
      !access.permissions.includes("experiment.read") ||
      !access.permissions.includes(permission)
    )
      throw new ExperimentAdminProblem();
  }

  private snapshot(
    record: ExperimentRecord,
    access: ExperimentAdminAccess,
  ): ExperimentAdminSnapshot {
    const definition = record.definition;
    return {
      target: {
        experimentId: record.experimentId,
        experimentRevision: record.experimentRevision,
        scope: record.scope,
      },
      definition: {
        id: definition.id,
        revision: definition.revision,
        unit: definition.unit,
        loginPolicy: definition.loginPolicy,
        allocatorVersion: definition.allocatorVersion,
        allocation: definition.allocation,
        variants: definition.variants.map(({ id, value, weight }) => ({ id, value, weight })),
        hypothesis: definition.hypothesis,
        observationPlan: definition.observationPlan,
        eligibility: definition.eligibility,
        startsAt: definition.startsAt,
        endsAt: definition.endsAt,
      },
      state: record.state,
      version: record.version,
      samples: this.samples(access).map(({ id, label }) => ({ id, label })),
      canPreview: access.permissions.includes("experiment.preview"),
      canOperate: access.permissions.includes("experiment.operate"),
      canConfigure: access.permissions.includes("experiment.configure"),
      eligibilityOptions: this.eligibilityOptions,
    };
  }
}
