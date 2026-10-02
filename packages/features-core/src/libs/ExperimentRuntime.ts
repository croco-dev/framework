import { randomUUID } from "node:crypto";
import { normalizePolicyScope } from "./Policy";
import {
  experimentAssignmentKey,
  experimentBucket,
  experimentHash,
  experimentKey,
  ExperimentProblem,
  assertExperimentOwnership,
} from "./Experiment";
import type {
  ExperimentConfigureCommand,
  ExperimentConfigureReceipt,
  DetailedEvaluation,
  ExperimentAssignment,
  ExperimentAuthorization,
  ExperimentCommand,
  ExperimentCommandReceipt,
  ExperimentDefinition,
  ExperimentExposure,
  ExperimentInput,
  ExperimentRecord,
  ExperimentRegistration,
  ExperimentScope,
  ExperimentStore,
  ExperimentTarget,
  ExperimentVariant,
} from "./Experiment";

export type ExperimentAssignmentResult =
  | { readonly status: "assigned"; readonly assignment: ExperimentAssignment }
  | {
      readonly status: "not_assigned" | "unavailable" | "evaluation_failed";
      readonly reason: string;
    };
export type ExperimentRuntimeOptions = {
  readonly store: ExperimentStore;
  readonly authorization: ExperimentAuthorization;
  readonly clock?: { now(): Date };
};

type TrustedRegistration = ExperimentRegistration & { readonly codeRevision: string };

export class ExperimentRuntime {
  private readonly registrations = new Map<string, TrustedRegistration>();
  private readonly scopedPredicates = new Map<string, ExperimentRegistration["eligibility"]>();
  private readonly eligibilityPredicates = new Map<string, ExperimentRegistration["eligibility"]>();
  private readonly clock: { now(): Date };
  constructor(private readonly options: ExperimentRuntimeOptions) {
    this.clock = options.clock ?? { now: () => new Date() };
  }

  async register(
    registration: ExperimentRegistration,
    scope: ExperimentScope,
    actor: string,
  ): Promise<ExperimentRecord> {
    scope = normalizePolicyScope(scope);
    const definition = registration.definition;
    this.validateDefinition(definition);
    if (
      definition.variants.some(
        (variant) => typeof registration.handlers[variant.id] !== "function",
      ) ||
      Object.keys(registration.handlers).some(
        (id) => !definition.variants.some((variant) => variant.id === id),
      )
    )
      throw new ExperimentProblem(
        "invalid",
        "Exactly the registered variants must have private handlers",
      );
    await this.authorize({ action: "register", scope, actor, experimentId: definition.id });
    const target = { experimentId: definition.id, experimentRevision: definition.revision, scope };
    const record = await this.options.store.register({
      ...target,
      codeRevision: definition.revision,
      definition: structuredClone(definition),
      definitionHash: experimentHash(definition),
      state: "draft",
      version: 0,
    });
    this.scopedPredicates.set(
      experimentHash([scope, definition.id, definition.revision, definition.eligibility]),
      registration.eligibility,
    );
    this.registrations.set(experimentKey(target), {
      ...registration,
      codeRevision: definition.revision,
      definition: structuredClone(definition),
      handlers: { ...registration.handlers },
    });
    return record;
  }
  getEligibilityIds(): readonly string[] {
    return [
      ...new Set([
        ...this.eligibilityPredicates.keys(),
        ...[...this.registrations.values()].map(
          (registration) => registration.definition.eligibility,
        ),
      ]),
    ].sort();
  }
  registerEligibility(id: string, predicate: ExperimentRegistration["eligibility"]): void {
    if (!id?.trim() || typeof predicate !== "function")
      throw new ExperimentProblem(
        "invalid",
        "Eligibility requires a code registered id and predicate",
      );
    const existing = this.eligibilityPredicates.get(id);
    if (existing && existing !== predicate)
      throw new ExperimentProblem("conflict", "Eligibility id already registered");
    this.eligibilityPredicates.set(id, predicate);
  }
  async configure(command: ExperimentConfigureCommand): Promise<ExperimentConfigureReceipt> {
    const scope = normalizePolicyScope(command.scope);
    await this.authorize({ ...command, scope, action: "configure" });
    const source = await this.registration(command);
    const definition = command.definition;
    this.validateDefinition(definition);
    if (
      command.action !== "configure" ||
      !command.reason?.trim() ||
      !command.idempotencyKey?.trim() ||
      !Number.isSafeInteger(command.expectedRevision) ||
      command.expectedRevision < 0 ||
      definition.id !== source.definition.id ||
      definition.revision === source.definition.revision ||
      definition.salt !== source.definition.salt
    )
      throw new ExperimentProblem(
        "invalid",
        "Configuration requires a new revision, source identity, reason, and command key",
      );
    if (
      definition.variants.length !== source.definition.variants.length ||
      definition.variants.some(
        (variant) =>
          !source.definition.variants.some(
            (registered) => registered.id === variant.id && registered.value === variant.value,
          ),
      )
    )
      throw new ExperimentProblem(
        "invalid",
        "Configuration cannot introduce unregistered variants",
      );
    const eligibility =
      this.scopedPredicates.get(
        experimentHash([scope, definition.id, source.codeRevision, definition.eligibility]),
      ) ?? this.eligibilityPredicates.get(definition.eligibility);
    if (!eligibility)
      throw new ExperimentProblem("invalid", "Eligibility predicate is not registered");
    const record: ExperimentRecord = {
      codeRevision: source.codeRevision,
      experimentId: definition.id,
      experimentRevision: definition.revision,
      scope,
      definition: structuredClone(definition),
      definitionHash: experimentHash(definition),
      state: "draft",
      version: 0,
    };
    const normalized = { ...command, scope };
    const receipt = await this.options.store.configure(
      normalized,
      record,
      experimentHash(normalized),
      this.now(),
    );
    this.registrations.set(experimentKey(record), {
      ...source,
      definition: structuredClone(definition),
      eligibility,
    });
    return receipt;
  }
  /** Rebind persisted operator revisions to a trusted code template after process restart. */
  async restore(
    sourceTarget: ExperimentTarget,
    actor: string,
  ): Promise<readonly ExperimentRecord[]> {
    const scope = normalizePolicyScope(sourceTarget.scope);
    await this.authorize({ ...sourceTarget, scope, actor, action: "register" });
    const source = await this.registration(sourceTarget);
    const records = (await this.options.store.list(scope)).filter(
      (record) =>
        record.experimentId === sourceTarget.experimentId &&
        record.codeRevision === source.codeRevision,
    );
    const bindings: [string, TrustedRegistration][] = [];
    for (const record of records) {
      bindings.push([experimentKey(record), this.bindPersisted(record, source, scope)]);
    }
    for (const [key, registration] of bindings) this.registrations.set(key, registration);
    return records;
  }
  async get(target: ExperimentTarget, actor: string): Promise<ExperimentRecord | null> {
    await this.authorize({ action: "read", ...target, actor });
    return this.options.store.get(target);
  }
  async list(scope: ExperimentScope, actor: string): Promise<readonly ExperimentRecord[]> {
    scope = normalizePolicyScope(scope);
    await this.authorize({ action: "read", scope, actor, experimentId: "*" });
    return this.options.store.list(scope);
  }
  async command(command: ExperimentCommand): Promise<ExperimentCommandReceipt> {
    const normalized = { ...command, scope: normalizePolicyScope(command.scope) };
    if (
      !["start", "pause", "stop"].includes(command.action) ||
      !command.reason?.trim() ||
      !command.idempotencyKey?.trim() ||
      !Number.isSafeInteger(command.expectedRevision) ||
      command.expectedRevision < 0
    )
      throw new ExperimentProblem(
        "invalid",
        "Command requires action, reason, key, and expected revision",
      );
    await this.authorize({ ...normalized, action: command.action });
    await this.registration(command);
    return this.options.store.command(normalized, experimentHash(normalized), this.now());
  }
  start(command: Omit<ExperimentCommand, "action">): Promise<ExperimentCommandReceipt> {
    return this.command({ ...command, action: "start" });
  }
  pause(command: Omit<ExperimentCommand, "action">): Promise<ExperimentCommandReceipt> {
    return this.command({ ...command, action: "pause" });
  }
  stop(command: Omit<ExperimentCommand, "action">): Promise<ExperimentCommandReceipt> {
    return this.command({ ...command, action: "stop" });
  }

  /** Read-only preview uses only an explicitly side-effect-free provider capability. */
  async preview(input: ExperimentInput): Promise<DetailedEvaluation> {
    await this.authorize({ ...input, action: "preview" });
    const registration = await this.registration(input);
    if (!this.validSubject(input, registration.definition))
      return { status: "not_assigned", reason: "stable_unit_required" };
    const eligibility = await this.checkEligibility(registration, input);
    if (eligibility.status !== "eligible")
      return {
        status: eligibility.status === "ineligible" ? "not_assigned" : "unavailable",
        reason: eligibility.reason,
      };
    const variant = this.localVariant(registration.definition, input);
    if (variant && registration.provider) return this.providerEvaluation(registration, input, true);
    return variant
      ? {
          status: "evaluated",
          appRevision: registration.definition.revision,
          value: variant.value,
          reason: "local_preview",
        }
      : { status: "not_assigned", reason: "outside_allocation" };
  }
  async evaluateDetailed(input: ExperimentInput): Promise<DetailedEvaluation> {
    const result = await this.assign(input);
    return result.status === "assigned"
      ? {
          status: "evaluated",
          appRevision: result.assignment.experimentRevision,
          value: result.assignment.value,
          reason: "assigned",
          providerMetadata: result.assignment.providerRef,
        }
      : result;
  }
  async assign(input: ExperimentInput): Promise<ExperimentAssignmentResult> {
    input = { ...input, scope: normalizePolicyScope(input.scope) };
    await this.authorize({ ...input, action: "assign" });
    const registration = await this.registration(input);
    const definition = registration.definition;
    if (!this.validSubject(input, definition))
      return { status: "not_assigned", reason: "stable_unit_required" };
    const id = experimentAssignmentKey(input, input.subject);
    const existing = await this.options.store.getAssignment(id);
    if (existing) {
      const eligibility = await this.checkEligibility(registration, input);
      if (eligibility.status !== "eligible")
        return {
          status: eligibility.status === "ineligible" ? "not_assigned" : "unavailable",
          reason: eligibility.reason,
        };
      const admission = await this.options.store.admit(id, input.scope, input.subject, this.now());
      return admission.status === "admitted"
        ? { status: "assigned", assignment: admission.assignment }
        : admission;
    }
    const eligibility = await this.checkEligibility(registration, input);
    if (eligibility.status !== "eligible")
      return {
        status: eligibility.status === "ineligible" ? "not_assigned" : "unavailable",
        reason: eligibility.reason,
      };
    let variant = this.localVariant(definition, input);
    if (!variant) return { status: "not_assigned", reason: "outside_allocation" };
    let providerRef: Readonly<Record<string, string>> | undefined;
    if (registration.provider) {
      const result = await this.providerEvaluation(registration, input, false);
      if (result.status !== "evaluated") return result;
      variant = definition.variants.find((item) => item.value === result.value);
      providerRef = { ...result.providerMetadata, appRevision: result.appRevision };
    }
    if (!variant) return { status: "not_assigned", reason: "outside_allocation" };
    const assignment: ExperimentAssignment = {
      experimentId: input.experimentId,
      experimentRevision: input.experimentRevision,
      scope: input.scope,
      id,
      subject: input.subject,
      variant: variant.id,
      value: variant.value,
      assignedAt: this.now(),
      ...(providerRef ? { providerRef } : {}),
      ...(eligibility.snapshotRef ? { eligibilitySnapshotRef: eligibility.snapshotRef } : {}),
    };
    const result = await this.options.store.assign(assignment, this.now());
    return result.status === "admitted"
      ? { status: "assigned", assignment: result.assignment }
      : result;
  }

  /** Admission is linearized with pause in the store. Admitted handlers may finish after pause. */
  async treat(
    input: ExperimentInput & { readonly assignmentId: string },
  ): Promise<
    | { readonly status: "treated"; readonly value: unknown }
    | { readonly status: "not_assigned"; readonly reason: string }
  > {
    await this.authorize({ ...input, action: "treat" });
    const original = await this.original(input.assignmentId, input);
    const registration = await this.registration(original);
    const eligibility = await this.checkEligibility(registration, input);
    if (eligibility.status !== "eligible")
      return { status: "not_assigned", reason: eligibility.reason };
    const admission = await this.options.store.admit(
      original.id,
      input.scope,
      input.subject,
      this.now(),
    );
    if (admission.status !== "admitted") return admission;
    const handler = registration.handlers[admission.assignment.variant];
    if (!handler)
      throw new ExperimentProblem("conflict", "Assignment handler registration is unavailable");
    return { status: "treated", value: await handler(input.context ?? {}) };
  }
  async recordExposure(
    input: ExperimentInput & {
      readonly assignmentId: string;
      readonly deliveryInstanceId: string;
      readonly occurredAt: string;
      readonly kind: "display" | "treatment";
    },
  ): Promise<ExperimentExposure> {
    await this.authorize({ ...input, action: "exposure" });
    const original = await this.original(input.assignmentId, input);
    if (
      !input.deliveryInstanceId?.trim() ||
      !["display", "treatment"].includes(input.kind) ||
      !Number.isFinite(Date.parse(input.occurredAt))
    )
      throw new ExperimentProblem(
        "invalid",
        "Exposure requires delivery identity, kind, and timestamp",
      );
    if (Date.parse(input.occurredAt) < Date.parse(original.assignedAt))
      throw new ExperimentProblem("invalid", "Exposure cannot precede its assignment");
    return this.options.store.recordExposure(
      {
        id: randomUUID(),
        assignmentId: input.assignmentId,
        deliveryInstanceId: input.deliveryInstanceId,
        occurredAt: input.occurredAt,
        kind: input.kind,
      },
      input.scope,
      input.subject,
    );
  }
  private async checkEligibility(
    registration: ExperimentRegistration,
    input: ExperimentInput,
  ): Promise<Awaited<ReturnType<ExperimentRegistration["eligibility"]>>> {
    try {
      return await registration.eligibility(input, this.now());
    } catch {
      return { status: "unavailable", reason: "eligibility_unavailable" };
    }
  }
  private async original(id: string, input: ExperimentInput): Promise<ExperimentAssignment> {
    const original = await this.options.store.getAssignment(id);
    if (!original) throw new ExperimentProblem("missing", "Assignment does not exist");
    assertExperimentOwnership(original, input.scope, input.subject);
    if (experimentKey(original) !== experimentKey(input))
      throw new ExperimentProblem("forbidden", "Assignment experiment mismatch");
    return original;
  }
  private localVariant(
    definition: ExperimentDefinition,
    input: ExperimentInput,
  ): ExperimentVariant | undefined {
    const bucket = experimentBucket(definition, input.scope, input.subject);
    if (bucket >= definition.allocation) return undefined;
    let boundary = 0;
    return definition.variants.find((variant) => {
      boundary += variant.weight;
      return bucket < boundary;
    });
  }
  private validSubject(input: ExperimentInput, definition: ExperimentDefinition): boolean {
    return (
      !!input.subject &&
      typeof input.subject.id === "string" &&
      !!input.subject.id.trim() &&
      (input.subject.kind === definition.unit ||
        (definition.unit === "anonymous" &&
          definition.loginPolicy === "switch-unit" &&
          input.subject.kind === "user")) &&
      (definition.unit !== "tenant" || input.subject.id === input.scope.tenantId)
    );
  }
  private async providerEvaluation(
    registration: ExperimentRegistration,
    input: ExperimentInput,
    preview: boolean,
  ): Promise<DetailedEvaluation> {
    const provider = registration.provider;
    const evaluate = preview ? provider?.previewDetailed : provider?.evaluateDetailed;
    if (!evaluate) return { status: "unavailable", reason: "provider_preview_unsupported" };
    let result: DetailedEvaluation;
    try {
      result = await evaluate.call(provider, { ...input, definition: registration.definition });
    } catch {
      return { status: "evaluation_failed", reason: "provider_failure" };
    }
    if (result.status !== "evaluated") return result;
    if (result.appRevision !== registration.definition.revision)
      return { status: "unavailable", reason: "provider_revision_unverified" };
    if (
      !registration.definition.variants.some(
        (variant) => variant.value === result.value && variant.weight > 0,
      )
    )
      return { status: "unavailable", reason: "provider_variant_drift" };
    return result;
  }
  private bindPersisted(
    record: ExperimentRecord,
    source: TrustedRegistration,
    scope: ExperimentScope,
  ): TrustedRegistration {
    const definition = record.definition;
    this.validateDefinition(definition);
    const eligibility =
      this.scopedPredicates.get(
        experimentHash([scope, definition.id, source.codeRevision, definition.eligibility]),
      ) ?? this.eligibilityPredicates.get(definition.eligibility);
    if (
      experimentHash(normalizePolicyScope(record.scope)) !== experimentHash(scope) ||
      record.codeRevision !== source.codeRevision ||
      record.experimentId !== source.definition.id ||
      definition.id !== source.definition.id ||
      definition.revision !== record.experimentRevision ||
      experimentHash(definition) !== record.definitionHash ||
      definition.salt !== source.definition.salt ||
      definition.allocatorVersion !== source.definition.allocatorVersion ||
      definition.variants.length !== source.definition.variants.length ||
      definition.variants.some(
        (variant) =>
          !source.definition.variants.some(
            (registered) => registered.id === variant.id && registered.value === variant.value,
          ),
      ) ||
      !eligibility
    )
      throw new ExperimentProblem(
        "conflict",
        "Persisted experiment does not match trusted code registration",
      );
    return { ...source, definition: structuredClone(definition), eligibility };
  }
  private async registration(target: ExperimentTarget): Promise<TrustedRegistration> {
    const key = experimentKey(target);
    const registration = this.registrations.get(key);
    if (registration) return registration;
    const record = await this.options.store.get(target);
    if (!record)
      throw new ExperimentProblem("missing", "Experiment code registration is unavailable");
    const source = this.registrations.get(
      experimentKey({ ...target, experimentRevision: record.codeRevision }),
    );
    if (
      !source ||
      source.codeRevision !== record.codeRevision ||
      source.definition.revision !== record.codeRevision
    )
      throw new ExperimentProblem("missing", "Experiment code registration is unavailable");
    if (experimentKey(record) !== key)
      throw new ExperimentProblem("conflict", "Persisted experiment target does not match request");
    const bound = this.bindPersisted(record, source, normalizePolicyScope(target.scope));
    this.registrations.set(key, bound);
    return bound;
  }
  private async authorize(
    request: Parameters<ExperimentAuthorization["authorize"]>[0],
  ): Promise<void> {
    const scope = normalizePolicyScope(request.scope);
    if (
      !request.actor?.trim() ||
      (await this.options.authorization.authorize({ ...request, scope })) !== true
    )
      throw new ExperimentProblem("forbidden", "Experiment action is not authorized");
  }
  private now(): string {
    return this.clock.now().toISOString();
  }
  private validateDefinition(definition: ExperimentDefinition): void {
    for (const field of [
      definition.id,
      definition.revision,
      definition.salt,
      definition.hypothesis,
      definition.observationPlan,
      definition.eligibility,
    ])
      if (typeof field !== "string" || !field.trim())
        throw new ExperimentProblem("invalid", "Definition fields must not be empty");
    if (
      definition.allocatorVersion !== "sha256-v1" ||
      !["user", "tenant", "anonymous"].includes(definition.unit) ||
      !["preserve-unit", "switch-unit"].includes(definition.loginPolicy) ||
      !Number.isSafeInteger(definition.allocation) ||
      definition.allocation < 0 ||
      definition.allocation > 10000 ||
      !definition.variants.length
    )
      throw new ExperimentProblem(
        "invalid",
        "Invalid allocator, unit, login policy, or allocation",
      );
    const ids = new Set<string>();
    const values = new Set<string | boolean | number>();
    for (const variant of definition.variants) {
      if (
        !variant.id?.trim() ||
        ids.has(variant.id) ||
        values.has(variant.value) ||
        !["string", "boolean", "number"].includes(typeof variant.value) ||
        (typeof variant.value === "number" && !Number.isFinite(variant.value)) ||
        !Number.isSafeInteger(variant.weight) ||
        variant.weight < 0
      )
        throw new ExperimentProblem("invalid", "Invalid or duplicate variant");
      ids.add(variant.id);
      values.add(variant.value);
    }
    if (
      definition.variants.reduce((sum, variant) => sum + variant.weight, 0) !==
      definition.allocation
    )
      throw new ExperimentProblem("invalid", "Variant weights must sum to allocation basis points");
    for (const date of [definition.startsAt, definition.endsAt])
      if (
        date !== undefined &&
        (!Number.isFinite(Date.parse(date)) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(date))
      )
        throw new ExperimentProblem("invalid", "Experiment times require explicit timezone");
    if (
      definition.startsAt &&
      definition.endsAt &&
      Date.parse(definition.startsAt) >= Date.parse(definition.endsAt)
    )
      throw new ExperimentProblem("invalid", "Experiment end must follow start");
  }
}
