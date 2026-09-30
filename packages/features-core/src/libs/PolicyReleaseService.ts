import { InMemoryPolicyReleaseStore } from "./InMemoryPolicyReleaseStore";

import type {
  ParameterizedPolicy,
  PolicyActor,
  PolicyCommandReceipt,
  PolicyContext,
  PolicyDefinition,
  PolicyEvaluationResult,
  PolicyFieldDescriptor,
  PolicyResolution,
  PolicyRevision,
  PolicyRevisionState,
  PolicyScope,
  PolicySemanticDiff,
  PolicyValidationResult,
} from "./Policy";
import {
  normalizePolicyScope,
  policyRegistrationFingerprint,
  policyScopeKey,
  policySemanticDiff,
  policyValueHash,
  policyCommandFingerprint,
  validatePolicyValue,
} from "./Policy";
import {
  InvalidPolicyDefinitionProblem,
  PolicyAuthorizationProblem,
  PolicyIdempotencyConflictProblem,
  PolicyInvalidTransitionProblem,
  PolicyRegistrationConflictProblem,
  PolicyRegistrationMissingProblem,
  PolicyRevisionConflictProblem,
  PolicyRevisionNotFoundProblem,
  PolicyScheduleProblem,
  PolicySchemaVersionMismatchProblem,
  PolicyStaleReviewProblem,
  PolicyValidationFailedProblem,
} from "./problems/PolicyProblems";

import type { PolicyAuthorizationAction, PolicyReleaseStore } from "./PolicyReleaseStore";
export type {
  PolicyAuthorizationAction,
  PolicyAuditEntry,
  PolicyReleaseStore,
  PolicyScheduleLookup,
} from "./PolicyReleaseStore";

export type PolicyAuthorizationRequest = {
  readonly action: PolicyAuthorizationAction;
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly actor?: PolicyActor;
  readonly expectedRevision?: number;
  readonly reason?: string;
};

export interface PolicyAuthorizationPolicy {
  authorize(request: PolicyAuthorizationRequest): void | boolean | Promise<void | boolean>;
}

export type PolicyReleaseServiceOptions = {
  readonly store?: PolicyReleaseStore;
  readonly authorization?: PolicyAuthorizationPolicy;
  readonly clock?: { readonly now: () => Date };
};

export type PolicyActorInput = PolicyActor | string;

export type PolicyTarget = {
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly revisionId?: string;
};

export type CreatePolicyDraftCommand<TValue> = PolicyTarget & {
  readonly value: TValue;
  readonly actor: PolicyActorInput;
  readonly reason: string;
};

export type UpdatePolicyDraftCommand<TValue> = PolicyTarget & {
  readonly value: TValue;
  readonly expectedRevision: number;
  readonly actor: PolicyActorInput;
  readonly reason: string;
};

export type UpdatePolicyDraftFieldCommand = PolicyTarget & {
  readonly descriptorId: string;
  readonly value: unknown;
  readonly expectedRevision: number;
  readonly actor: PolicyActorInput;
  readonly reason: string;
};

export type PolicyTransitionCommand = PolicyTarget & {
  readonly expectedRevision: number;
  readonly actor: PolicyActorInput;
  readonly reason: string;
};

export type ReviewPolicyCommand = PolicyTransitionCommand;

export type SchedulePolicyCommand = PolicyTransitionCommand & {
  readonly idempotencyKey: string;
  readonly effectiveAt: string;
  readonly reviewHash: string;
};

export type PublishPolicyCommand = PolicyTransitionCommand & {
  readonly idempotencyKey: string;
  readonly reviewHash: string;
  readonly effectiveAt?: string;
};

export type TriggerScheduledPolicyCommand = Omit<
  PublishPolicyCommand,
  "reviewHash" | "effectiveAt"
> & {
  readonly reviewHash?: string;
};

export type PausePolicyCommand<_TValue> = PolicyTransitionCommand & {
  readonly idempotencyKey: string;
};

export type RollbackPolicyCommand = PolicyTarget & {
  readonly expectedRevision: number;
  readonly toVersion: number;
  readonly idempotencyKey: string;
  readonly actor: PolicyActorInput;
  readonly reason: string;
  readonly effectiveAt?: string;
};

export type ResolvePolicyInput = {
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly at?: string;
  readonly version?: number;
};

export type EvaluatePolicyInput<TContext extends PolicyContext = PolicyContext> = {
  readonly policyId: string;
  readonly scope: PolicyScope;
  readonly context: TContext;
  readonly at?: string;
  readonly version?: number;
};

type ErasedPolicy = {
  readonly id: string;
  readonly schemaVersion: string;
  readonly codeRegistrationId: string;
  readonly registrationFingerprint: string;
  readonly definition: PolicyDefinition<unknown>;
  readonly fieldDescriptors: readonly PolicyFieldDescriptor<unknown>[];
  readonly fallback?: unknown;
  readonly validate: (value: unknown) => PolicyValidationResult;
  readonly semanticDiff: (before: unknown, after: unknown) => readonly PolicySemanticDiff[];
  readonly evaluate: (value: unknown, context: PolicyContext) => unknown;
};

export class PolicyReleaseService {
  private readonly registrations = new Map<string, ErasedPolicy>();
  private readonly currentRegistrations = new Map<string, string>();
  private readonly store: PolicyReleaseStore;
  private readonly authorization: PolicyAuthorizationPolicy;
  private readonly clock: { readonly now: () => Date };

  constructor(options: PolicyReleaseServiceOptions = {}) {
    this.store = options.store ?? new InMemoryPolicyReleaseStore();
    this.authorization = options.authorization ?? { authorize: () => undefined };
    this.clock = options.clock ?? { now: () => new Date() };
  }

  registerPolicy<TValue, TContext extends PolicyContext = PolicyContext, TResult = unknown>(
    policy: ParameterizedPolicy<TValue, TContext, TResult>,
  ): PolicyDefinition<TValue> {
    validateRegistration(policy);
    const fingerprint = policyRegistrationFingerprint(policy);
    const key = registrationKey(policy.id, policy.schemaVersion);
    const existing = this.registrations.get(key);
    if (existing && existing.registrationFingerprint !== fingerprint) {
      throw new PolicyRegistrationConflictProblem(policy.id, policy.schemaVersion);
    }
    if (!existing) this.registrations.set(key, erasePolicy(policy, fingerprint));
    this.currentRegistrations.set(policy.id, key);
    return {
      id: policy.id,
      schemaVersion: policy.schemaVersion,
      schema: policy.schema,
      fieldDescriptors: policy.fieldDescriptors,
      codeRegistrationId: policy.codeRegistrationId,
      registrationFingerprint: fingerprint,
      reviewRequirements: policy.reviewRequirements,
    };
  }

  getRegistration<TValue>(
    policyId: string,
    schemaVersion?: string,
  ): PolicyDefinition<TValue> | null {
    const registration = this.findRegistration(policyId, schemaVersion);
    return (registration?.definition as PolicyDefinition<TValue> | undefined) ?? null;
  }

  async createDraft<TValue>(
    command: CreatePolicyDraftCommand<TValue>,
  ): Promise<PolicyRevision<TValue>> {
    const scope = this.scope(command.scope);
    const actor = this.actor(command.actor);
    const reason = this.reason(command.reason);
    const registration = this.requireRegistration(command.policyId);
    await this.authorize({ action: "create", policyId: command.policyId, scope, actor, reason });
    this.assertValid(registration, command.value);

    const latest = await this.store.get(scope, command.policyId);
    const revision = (latest?.revision ?? 0) + 1;
    const draft = this.createRevision(
      registration,
      command.policyId,
      scope,
      revision,
      command.value,
      "draft",
      actor,
      reason,
    );
    await this.store.create(draft as PolicyRevision<unknown>, {
      policyId: draft.policyId,
      scope: draft.scope,
      schemaVersion: draft.schemaVersion,
      codeRegistrationId: draft.codeRegistrationId,
      registrationFingerprint: draft.registrationFingerprint,
    });
    await this.audit("create", draft, actor, reason);
    return draft;
  }

  async updateDraft<TValue>(
    command: UpdatePolicyDraftCommand<TValue>,
  ): Promise<PolicyRevision<TValue>> {
    const scope = this.scope(command.scope);
    const actor = this.actor(command.actor);
    const reason = this.reason(command.reason);
    const registration = this.requireRegistration(command.policyId);
    await this.authorize({
      action: "edit",
      policyId: command.policyId,
      scope,
      actor,
      reason,
      expectedRevision: command.expectedRevision,
    });
    const current = await this.requireLatest<TValue>(command.policyId, scope);
    this.assertExpectedRevision(current, command.expectedRevision);
    if (current.state !== "draft" && current.state !== "reviewed") {
      throw new PolicyInvalidTransitionProblem(command.policyId, current.state, "draft");
    }
    this.assertRegistrationBinding(registration, current);
    this.assertValid(registration, command.value);
    const next = this.transition(registration, current, "draft", actor, reason, {
      value: clone(command.value),
      review: undefined,
      scheduledFor: undefined,
    });
    await this.store.save(next as PolicyRevision<unknown>, current.revision);
    await this.audit("edit", next, actor, reason);
    return next;
  }

  async updateDraftField<TValue>(
    command: UpdatePolicyDraftFieldCommand,
  ): Promise<PolicyRevision<TValue>> {
    const scope = this.scope(command.scope);
    await this.authorize({
      action: "edit",
      policyId: command.policyId,
      scope,
      actor: this.actor(command.actor),
      reason: this.reason(command.reason),
      expectedRevision: command.expectedRevision,
    });
    const current = await this.requireLatest<TValue>(command.policyId, scope);
    const registration = this.requireRegistration(command.policyId);
    this.assertExpectedRevision(current, command.expectedRevision);
    if (current.state !== "draft" && current.state !== "reviewed")
      throw new PolicyInvalidTransitionProblem(command.policyId, current.state, "draft");
    this.assertRegistrationBinding(registration, current);
    const descriptor = registration.fieldDescriptors.find(({ id }) => id === command.descriptorId);
    if (!descriptor)
      throw new InvalidPolicyDefinitionProblem(`Unknown policy field '${command.descriptorId}'`);
    let value: TValue;
    try {
      value = descriptor.write(current.value, command.value) as TValue;
    } catch {
      throw new InvalidPolicyDefinitionProblem(
        `Policy field '${command.descriptorId}' could not be written`,
      );
    }
    return this.updateDraft({ ...command, value });
  }

  async review<TValue>(command: ReviewPolicyCommand): Promise<PolicyRevision<TValue>> {
    const scope = this.scope(command.scope);
    const actor = this.actor(command.actor);
    const reason = this.reason(command.reason);
    const registration = this.requireRegistration(command.policyId);
    await this.authorize({
      action: "review",
      policyId: command.policyId,
      scope,
      actor,
      reason,
      expectedRevision: command.expectedRevision,
    });
    const current = await this.requireLatest<TValue>(command.policyId, scope);
    this.assertExpectedRevision(current, command.expectedRevision);
    this.assertState(current, "draft");
    this.assertRegistrationBinding(registration, current);
    const validation = this.assertValid(registration, current.value);
    const previous = await this.previousPublishedValue<TValue>(
      command.policyId,
      scope,
      current.revision,
    );
    const next = this.transition(registration, current, "reviewed", actor, reason, {
      review: {
        reviewedRevision: current.revision,
        reviewedHash: current.hash,
        reviewedValue: clone(current.value),
        validation: structuredClone(validation),
        semanticDiff: policySemanticDiff(
          registrationToPolicy(registration),
          previous,
          current.value,
        ),
        reviewedAt: this.now(),
        actor: clone(actor),
        reason,
      },
      scheduledFor: undefined,
    });
    await this.store.save(next as PolicyRevision<unknown>, current.revision);
    await this.audit("review", next, actor, reason);
    return next;
  }

  submitReview<TValue>(command: ReviewPolicyCommand): Promise<PolicyRevision<TValue>> {
    return this.review(command);
  }

  async schedule<TValue>(command: SchedulePolicyCommand): Promise<PolicyRevision<TValue>> {
    const scope = this.scope(command.scope);
    const actor = this.actor(command.actor);
    const reason = this.reason(command.reason);
    const registration = this.requireRegistration(command.policyId);
    const fingerprint = policyCommandFingerprint({
      ...command,
      actor,
      reason,
      scope,
      reviewHash: command.reviewHash ?? "",
    });
    await this.authorize({
      action: "schedule",
      policyId: command.policyId,
      scope,
      actor,
      reason,
      expectedRevision: command.expectedRevision,
    });
    const duplicate = await this.reconcileReceipt<TValue>(command, scope, "schedule", fingerprint);
    if (duplicate) return duplicate;
    const current = await this.requireLatest<TValue>(command.policyId, scope);
    this.assertExpectedRevision(current, command.expectedRevision);
    this.assertState(current, "reviewed");
    this.assertRegistrationBinding(registration, current);
    this.assertReviewCurrent(current, command.reviewHash);
    this.assertReviewRequirements(registration, current);
    const effectiveAt = this.instant(command.effectiveAt, command.policyId);
    if (Date.parse(effectiveAt) <= this.clock.now().getTime()) {
      throw new PolicyScheduleProblem(
        command.policyId,
        "effectiveAt must be later than the current time",
      );
    }
    const next = this.transition(registration, current, "scheduled", actor, reason, {
      scheduledFor: effectiveAt,
      scheduleIdempotencyKey: command.idempotencyKey,
    });
    return this.recordCommand("schedule", command, scope, fingerprint, next, actor, reason);
  }

  schedulePublish<TValue>(command: SchedulePolicyCommand): Promise<PolicyRevision<TValue>> {
    return this.schedule(command);
  }

  async cancelSchedule<TValue>(command: PolicyTransitionCommand): Promise<PolicyRevision<TValue>> {
    const scope = this.scope(command.scope);
    const actor = this.actor(command.actor);
    const reason = this.reason(command.reason);
    const registration = this.requireRegistration(command.policyId);
    await this.authorize({
      action: "schedule",
      policyId: command.policyId,
      scope,
      actor,
      reason,
      expectedRevision: command.expectedRevision,
    });
    const current = await this.requireLatest<TValue>(command.policyId, scope);
    this.assertExpectedRevision(current, command.expectedRevision);
    this.assertState(current, "scheduled");
    this.assertRegistrationBinding(registration, current);
    const next = this.transition(registration, current, "reviewed", actor, reason, {
      scheduledFor: undefined,
    });
    await this.store.save(next as PolicyRevision<unknown>, current.revision);
    await this.audit("schedule", next, actor, reason);
    return next;
  }

  async publish<TValue>(command: PublishPolicyCommand): Promise<PolicyRevision<TValue>> {
    const scope = this.scope(command.scope);
    const actor = this.actor(command.actor);
    const reason = this.reason(command.reason);
    const registration = this.requireRegistration(command.policyId);
    const effectiveAt = command.effectiveAt
      ? this.instant(command.effectiveAt, command.policyId)
      : this.now();
    const fingerprint = policyCommandFingerprint({ ...command, actor, reason, scope });
    await this.authorize({
      action: "publish",
      policyId: command.policyId,
      scope,
      actor,
      reason,
      expectedRevision: command.expectedRevision,
    });
    const duplicate = await this.reconcileReceipt<TValue>(command, scope, "publish", fingerprint);
    if (duplicate) return duplicate;
    const current = await this.requireLatest<TValue>(command.policyId, scope);
    this.assertExpectedRevision(current, command.expectedRevision);
    this.assertRegistrationBinding(registration, current);
    if (current.state === "published" && current.publication) {
      if (
        current.publication.idempotencyKey === command.idempotencyKey &&
        current.publication.commandFingerprint === fingerprint
      ) {
        return current;
      }
      throw new PolicyIdempotencyConflictProblem(command.policyId, command.idempotencyKey);
    }
    if (current.state === "reviewed" && Date.parse(effectiveAt) > this.clock.now().getTime()) {
      return this.schedule({
        ...command,
        effectiveAt,
        reviewHash: command.reviewHash,
        idempotencyKey: command.idempotencyKey,
      });
    }
    if (current.state === "scheduled") {
      const scheduledFor = current.scheduledFor;
      if (!scheduledFor || Date.parse(scheduledFor) > this.clock.now().getTime()) {
        throw new PolicyScheduleProblem(command.policyId, "scheduled effectiveAt has not arrived");
      }
    } else if (current.state !== "reviewed") {
      throw new PolicyInvalidTransitionProblem(command.policyId, current.state, "published");
    }
    this.assertReviewCurrent(current, command.reviewHash);
    this.assertReviewRequirements(registration, current);
    const next = this.transition(registration, current, "published", actor, reason, {
      publication: {
        version: current.revision + 1,
        reviewedRevision: current.review?.reviewedRevision ?? current.revision,
        reviewHash: command.reviewHash,
        actor: clone(actor),
        reason,
        idempotencyKey: command.idempotencyKey,
        commandFingerprint: fingerprint,
        effectiveAt,
        publishedAt: this.now(),
      },
      scheduledFor: undefined,
    });
    return this.recordCommand("publish", command, scope, fingerprint, next, actor, reason);
  }

  publishNow<TValue>(command: PublishPolicyCommand): Promise<PolicyRevision<TValue>> {
    return this.publish(command);
  }

  async triggerScheduled<TValue>(
    command: TriggerScheduledPolicyCommand,
  ): Promise<PolicyRevision<TValue>> {
    const scope = this.scope(command.scope);
    const current = await this.requireLatest<TValue>(command.policyId, scope);
    if (current.state !== "scheduled") {
      throw new PolicyInvalidTransitionProblem(command.policyId, current.state, "published");
    }
    return this.publish({
      ...command,
      reviewHash: command.reviewHash ?? current.review?.reviewedHash ?? current.hash,
      effectiveAt: current.scheduledFor,
    });
  }

  async pause<TValue>(command: PausePolicyCommand<TValue>): Promise<PolicyRevision<TValue>> {
    const scope = this.scope(command.scope);
    const actor = this.actor(command.actor);
    const reason = this.reason(command.reason);
    await this.authorize({
      action: "pause",
      policyId: command.policyId,
      scope,
      actor,
      reason,
      expectedRevision: command.expectedRevision,
    });
    const pauseCommand = {
      action: "pause" as const,
      policyId: command.policyId,
      scope,
      actor,
      reason,
      expectedRevision: command.expectedRevision,
      idempotencyKey: command.idempotencyKey,
    };
    if ("fallback" in command)
      throw new InvalidPolicyDefinitionProblem("Pause fallback must be declared in code");
    const fingerprint = policyCommandFingerprint(pauseCommand);
    const duplicate = await this.reconcileReceipt<TValue>(command, scope, "pause", fingerprint);
    if (duplicate) return duplicate;
    const latest = await this.requireLatest<TValue>(command.policyId, scope);
    this.assertExpectedRevision(latest, command.expectedRevision);
    const active = await this.activeRevision(command.policyId, scope);
    if (!active) throw new PolicyRevisionNotFoundProblem(command.policyId, "active");
    this.assertState(active, "published");
    const registration = this.requireRegistration(command.policyId, active.schemaVersion);
    this.assertRegistrationBinding(registration, active);
    const fallback = registration.fallback as TValue | undefined;
    if (fallback !== undefined) this.assertValid(registration, fallback);
    const next = this.transition(
      registration,
      { ...active, revision: latest.revision } as PolicyRevision<TValue>,
      "paused",
      actor,
      reason,
      {
        fallback: fallback === undefined ? undefined : clone(fallback),
        pauseReason: reason,
      },
    );
    const retainedDraft =
      latest.state === "draft" || latest.state === "reviewed"
        ? {
            ...clone(latest),
            id: `${latest.policyId}:${policyScopeKey(scope)}:${next.revision + 1}`,
            revision: next.revision + 1,
            version: next.revision + 1,
          }
        : undefined;
    const receipt = await this.store.recordPause({
      revision: next,
      retainedDraft,
      expectedActiveVersion: active.version,
      command: pauseCommand,
      receipt: {
        id: `${next.id}:${command.idempotencyKey}`,
        policyId: command.policyId,
        scope,
        revision: next.revision,
        version: next.version,
        hash: next.hash,
        status: "paused",
        idempotencyKey: command.idempotencyKey,
        commandFingerprint: fingerprint,
        effectiveAt: this.now(),
        recordedAt: this.now(),
      },
    });
    const recorded = await this.store.getRevision(scope, command.policyId, receipt.revision);
    if (!recorded) throw new PolicyRevisionNotFoundProblem(command.policyId, receipt.revision);
    await this.audit("pause", recorded, actor, reason);
    return recorded as PolicyRevision<TValue>;
  }

  async rollback<TValue>(command: RollbackPolicyCommand): Promise<PolicyRevision<TValue>> {
    const scope = this.scope(command.scope);
    const actor = this.actor(command.actor);
    const reason = this.reason(command.reason);
    const registration = this.requireRegistration(command.policyId);
    const effectiveAt = command.effectiveAt
      ? this.instant(command.effectiveAt, command.policyId)
      : this.now();
    const fingerprint = policyCommandFingerprint({
      ...command,
      actor,
      reason,
      scope,
      reviewHash: "rollback",
    });
    await this.authorize({
      action: "rollback",
      policyId: command.policyId,
      scope,
      actor,
      reason,
      expectedRevision: command.expectedRevision,
    });
    const duplicate = await this.reconcileReceipt<TValue>(command, scope, "rollback", fingerprint);
    if (duplicate) return duplicate;
    if (Date.parse(effectiveAt) > this.clock.now().getTime()) {
      throw new PolicyScheduleProblem(command.policyId, "Rollback must take effect immediately");
    }
    const current = await this.requireLatest<TValue>(command.policyId, scope);
    this.assertExpectedRevision(current, command.expectedRevision);
    this.assertRegistrationBinding(registration, current);
    const target = (await this.store.getRevision(
      scope,
      command.policyId,
      command.toVersion,
    )) as PolicyRevision<TValue> | null;
    if (!target) throw new PolicyRevisionNotFoundProblem(command.policyId, command.toVersion);
    this.assertRegistrationBinding(registration, target);
    if (target.state !== "published" || !target.publication) {
      throw new PolicyInvalidTransitionProblem(command.policyId, target.state, "published");
    }
    const next = this.transition(registration, current, "published", actor, reason, {
      value: clone(target.value) as TValue,
      review: target.review ? clone(target.review) : undefined,
      rollbackOf: target.version,
      publication: {
        version: current.revision + 1,
        reviewedRevision: target.revision,
        reviewHash: target.hash,
        actor: clone(actor),
        reason,
        idempotencyKey: command.idempotencyKey,
        commandFingerprint: fingerprint,
        effectiveAt,
        publishedAt: this.now(),
      },
      scheduledFor: undefined,
      fallback: undefined,
      pauseReason: undefined,
    });
    return this.recordCommand("rollback", command, scope, fingerprint, next, actor, reason);
  }

  async resolve<TValue>(input: ResolvePolicyInput): Promise<PolicyResolution<TValue>> {
    const scope = this.scope(input.scope);
    await this.authorize({ action: "read", policyId: input.policyId, scope });
    return this.resolveInternal<TValue>(input, scope);
  }

  async evaluate<TContext extends PolicyContext, TResult = unknown>(
    input: EvaluatePolicyInput<TContext>,
  ): Promise<PolicyEvaluationResult<TResult>> {
    const scope = this.scope(input.scope);
    await this.authorize({ action: "read", policyId: input.policyId, scope });
    const resolution = await this.resolveInternal<unknown>(input, scope);
    if (
      resolution.status !== "active" &&
      resolution.status !== "historical" &&
      resolution.status !== "paused"
    ) {
      return resolution as PolicyEvaluationResult<TResult>;
    }
    const revision =
      resolution.version === undefined
        ? null
        : await this.store.getRevision(scope, input.policyId, resolution.version);
    if (!revision)
      throw new PolicyRevisionNotFoundProblem(input.policyId, input.version ?? "active");
    const registration = this.requireRegistration(input.policyId, revision.schemaVersion);
    this.assertRegistrationBinding(registration, revision);
    const value = registration.evaluate(resolution.value, input.context);
    return { ...resolution, value: value as TResult };
  }

  async getRevision<TValue>(
    policyId: string,
    scope: PolicyScope,
    revision: number | string,
  ): Promise<PolicyRevision<TValue> | null> {
    const normalizedScope = this.scope(scope);
    await this.authorize({ action: "read", policyId, scope: normalizedScope });
    return (await this.store.getRevision(
      normalizedScope,
      policyId,
      Number(revision),
    )) as PolicyRevision<TValue> | null;
  }

  async getLatestRevision<TValue>(
    policyId: string,
    scope: PolicyScope,
  ): Promise<PolicyRevision<TValue> | null> {
    const normalizedScope = this.scope(scope);
    await this.authorize({ action: "read", policyId, scope: normalizedScope });
    return (await this.store.get(normalizedScope, policyId)) as PolicyRevision<TValue> | null;
  }

  async listRevisions<TValue>(
    policyId: string,
    scope: PolicyScope,
  ): Promise<readonly PolicyRevision<TValue>[]> {
    const normalizedScope = this.scope(scope);
    await this.authorize({ action: "read", policyId, scope: normalizedScope });
    return (await this.store.list(normalizedScope, policyId)) as readonly PolicyRevision<TValue>[];
  }

  async getCommandReceipt(
    policyId: string,
    scope: PolicyScope,
    idempotencyKey: string,
  ): Promise<PolicyCommandReceipt | null> {
    const normalizedScope = this.scope(scope);
    await this.authorize({ action: "read", policyId, scope: normalizedScope });
    return this.store.findCommandReceipt(normalizedScope, policyId, idempotencyKey);
  }

  private assertReviewRequirements(
    registration: ErasedPolicy,
    revision: PolicyRevision<unknown>,
  ): void {
    const requirements = registration.definition.reviewRequirements;
    if (requirements?.risk !== "financial" && !requirements?.independentReviewer) return;
    const editor = [...revision.history].reverse().find((entry) => entry.to === "draft")?.actor.id;
    if (!revision.review || revision.review.actor.id === editor) {
      throw new PolicyAuthorizationProblem(revision.policyId, "independent-review");
    }
  }

  private async activeRevision(
    policyId: string,
    scope: PolicyScope,
    at?: string,
  ): Promise<PolicyRevision<unknown> | null> {
    const resolution = await this.store.resolve(
      scope,
      policyId,
      at ? new Date(at) : this.clock.now(),
    );
    return resolution.version === undefined
      ? null
      : this.store.getRevision(scope, policyId, resolution.version);
  }

  private async resolveInternal<TValue>(
    input: ResolvePolicyInput,
    scope: PolicyScope,
  ): Promise<PolicyResolution<TValue>> {
    const active = (await this.activeRevision(
      input.policyId,
      scope,
      input.at,
    )) as PolicyRevision<TValue> | null;
    const revision = input.version
      ? ((await this.store.getRevision(
          scope,
          input.policyId,
          input.version,
        )) as PolicyRevision<TValue> | null)
      : active;
    if (!revision) {
      const latest = (await this.store.get(scope, input.policyId)) as PolicyRevision<TValue> | null;
      if (latest?.state === "scheduled") {
        this.assertRegistrationBinding(
          this.requireRegistration(input.policyId, latest.schemaVersion),
          latest,
        );
        return this.resolution(latest, "scheduled");
      }
      this.requireRegistration(input.policyId);
      return {
        policyId: input.policyId,
        scope,
        status: "unavailable",
        reason: "No active policy revision is available",
      };
    }
    const registration = this.requireRegistration(input.policyId, revision.schemaVersion);
    this.assertRegistrationBinding(registration, revision);
    if (revision.state === "paused") {
      return revision.fallback === undefined
        ? this.resolution(revision, "unavailable", revision.pauseReason ?? "Policy is paused")
        : this.resolution(revision, "paused", revision.pauseReason);
    }
    if (revision.state === "scheduled") return this.resolution(revision, "scheduled");
    if (revision.state !== "published") {
      return this.resolution(revision, "unavailable", `Policy revision is ${revision.state}`);
    }
    const status =
      input.version !== undefined && active?.version !== revision.version ? "historical" : "active";
    return this.resolution(revision, status);
  }

  private resolution<TValue>(
    revision: PolicyRevision<TValue>,
    status: "active" | "historical" | "paused" | "scheduled" | "unavailable",
    reason?: string,
  ): PolicyResolution<TValue> {
    return {
      policyId: revision.policyId,
      scope: clone(revision.scope),
      status,
      version: revision.version,
      hash: revision.hash,
      ...(status === "unavailable" && revision.fallback === undefined
        ? {}
        : { value: clone(revision.state === "paused" ? revision.fallback : revision.value) }),
      ...(reason ? { reason } : {}),
      reference: {
        policyId: revision.policyId,
        scope: clone(revision.scope),
        version: revision.version,
        hash: revision.hash,
      },
    };
  }

  private async previousPublishedValue<TValue>(
    policyId: string,
    scope: PolicyScope,
    beforeRevision: number,
  ): Promise<TValue | null> {
    const revisions = await this.store.list(scope, policyId);
    const published = revisions
      .filter(({ state, revision }) => state === "published" && revision < beforeRevision)
      .sort((left, right) => right.revision - left.revision)[0];
    return published ? (clone(published.value) as TValue) : null;
  }

  private async requireLatest<TValue>(
    policyId: string,
    scope: PolicyScope,
  ): Promise<PolicyRevision<TValue>> {
    const current = await this.store.get(scope, policyId);
    if (!current) throw new PolicyRevisionNotFoundProblem(policyId, "latest");
    return current as PolicyRevision<TValue>;
  }

  private requireRegistration(policyId: string, schemaVersion?: string): ErasedPolicy {
    const registration = this.findRegistration(policyId, schemaVersion);
    if (!registration) throw new PolicyRegistrationMissingProblem(policyId, schemaVersion);
    return registration;
  }

  private findRegistration(policyId: string, schemaVersion?: string): ErasedPolicy | undefined {
    if (schemaVersion) return this.registrations.get(registrationKey(policyId, schemaVersion));
    const current = this.currentRegistrations.get(policyId);
    return current === undefined ? undefined : this.registrations.get(current);
  }

  private assertRegistrationBinding(
    registration: ErasedPolicy,
    revision: Pick<
      PolicyRevision<unknown>,
      "policyId" | "schemaVersion" | "codeRegistrationId" | "registrationFingerprint"
    >,
  ): void {
    if (revision.policyId !== registration.id) {
      throw new PolicyRegistrationMissingProblem(revision.policyId, revision.schemaVersion);
    }
    if (revision.schemaVersion !== registration.schemaVersion) {
      throw new PolicySchemaVersionMismatchProblem(
        revision.policyId,
        registration.schemaVersion,
        revision.schemaVersion,
      );
    }
    if (
      revision.codeRegistrationId !== registration.codeRegistrationId ||
      revision.registrationFingerprint !== registration.registrationFingerprint
    ) {
      throw new PolicyRegistrationMissingProblem(revision.policyId, revision.schemaVersion);
    }
  }

  private assertValid(registration: ErasedPolicy, value: unknown): PolicyValidationResult {
    let result: PolicyValidationResult;
    try {
      result = registration.validate(value);
    } catch {
      throw new PolicyValidationFailedProblem(
        registration.id,
        ["features/policy/schema-threw"],
        undefined,
      );
    }
    if (!result.valid) {
      throw new PolicyValidationFailedProblem(
        registration.id,
        result.diagnostics.map(({ code }) => code),
        result.diagnostics.map(({ code, path }) => ({ code, path })),
      );
    }
    return result;
  }

  private assertExpectedRevision(revision: PolicyRevision<unknown>, expected: number): void {
    if (revision.revision !== expected) {
      throw new PolicyRevisionConflictProblem(revision.policyId, expected, revision.revision);
    }
  }

  private assertState(revision: PolicyRevision<unknown>, expected: PolicyRevisionState): void {
    if (revision.state !== expected) {
      throw new PolicyInvalidTransitionProblem(revision.policyId, revision.state, expected);
    }
  }

  private assertReviewCurrent(revision: PolicyRevision<unknown>, reviewHash: string): void {
    if (
      typeof reviewHash !== "string" ||
      reviewHash.length === 0 ||
      !revision.review ||
      revision.review.reviewedHash !== revision.hash ||
      reviewHash !== revision.review.reviewedHash
    ) {
      throw new PolicyStaleReviewProblem(
        revision.policyId,
        typeof reviewHash === "string" ? reviewHash : "",
        revision.hash,
      );
    }
  }

  private transition<TValue>(
    registration: ErasedPolicy,
    current: PolicyRevision<TValue>,
    state: PolicyRevisionState,
    actor: PolicyActor,
    reason: string,
    changes: Partial<PolicyRevision<TValue>> = {},
  ): PolicyRevision<TValue> {
    const revision = current.revision + 1;
    const value = (
      Object.prototype.hasOwnProperty.call(changes, "value") ? changes.value : current.value
    ) as TValue;
    return {
      ...current,
      ...changes,
      id: `${current.policyId}:${policyScopeKey(current.scope)}:${revision}`,
      scope: clone(current.scope),
      revision,
      version: revision,
      value: clone(value),
      hash: policyValueHash(registration.definition, current.scope, revision, value),
      state,
      history: [
        ...current.history,
        {
          from: current.state,
          to: state,
          revision,
          occurredAt: this.now(),
          actor: clone(actor),
          reason,
        },
      ],
    };
  }

  private createRevision<TValue>(
    registration: ErasedPolicy,
    policyId: string,
    scope: PolicyScope,
    revision: number,
    value: TValue,
    state: PolicyRevisionState,
    actor: PolicyActor,
    reason: string,
  ): PolicyRevision<TValue> {
    return {
      id: `${policyId}:${policyScopeKey(scope)}:${revision}`,
      policyId,
      scope: clone(scope),
      schemaVersion: registration.schemaVersion,
      codeRegistrationId: registration.codeRegistrationId,
      registrationFingerprint: registration.registrationFingerprint,
      revision,
      version: revision,
      value: clone(value),
      hash: policyValueHash(registration.definition, scope, revision, value),
      state,
      history: [
        {
          from: null,
          to: state,
          revision,
          occurredAt: this.now(),
          actor: clone(actor),
          reason,
        },
      ],
    };
  }

  private async recordCommand<TValue>(
    action: PolicyAuthorizationAction,
    command: {
      readonly policyId: string;
      readonly scope: PolicyScope;
      readonly idempotencyKey: string;
    },
    scope: PolicyScope,
    fingerprint: string,
    revision: PolicyRevision<TValue>,
    actor: PolicyActor,
    reason: string,
  ): Promise<PolicyRevision<TValue>> {
    const publicationCommand = {
      ...command,
      scope,
      actor,
      reason,
      expectedRevision: revision.revision - 1,
      reviewHash:
        action === "rollback" ? "rollback" : ((command as PublishPolicyCommand).reviewHash ?? ""),
    };
    const receipt = await this.store.recordPublication({
      revision,
      command: publicationCommand,
      receipt: {
        id: `${revision.id}:${command.idempotencyKey}`,
        policyId: command.policyId,
        scope,
        revision: revision.revision,
        version: revision.version,
        hash: revision.hash,
        status: action === "schedule" ? "scheduled" : "published",
        idempotencyKey: command.idempotencyKey,
        commandFingerprint: fingerprint,
        effectiveAt: revision.scheduledFor ?? revision.publication?.effectiveAt ?? this.now(),
        recordedAt: this.now(),
      },
    });
    const recorded = await this.store.getRevision(scope, command.policyId, receipt.revision);
    if (!recorded) throw new PolicyRevisionNotFoundProblem(command.policyId, receipt.revision);
    await this.audit(action, recorded, actor, reason);
    return recorded as PolicyRevision<TValue>;
  }

  private async reconcileReceipt<TValue>(
    command: {
      readonly policyId: string;
      readonly scope: PolicyScope;
      readonly idempotencyKey: string;
    },
    scope: PolicyScope,
    _action: PolicyAuthorizationAction,
    fingerprint: string,
  ): Promise<PolicyRevision<TValue> | null> {
    const receipt = await this.store.findCommandReceipt(
      scope,
      command.policyId,
      command.idempotencyKey,
    );
    if (!receipt) return null;
    if (receipt.commandFingerprint !== fingerprint) {
      throw new PolicyIdempotencyConflictProblem(command.policyId, command.idempotencyKey);
    }
    const revision = await this.store.getRevision(scope, command.policyId, receipt.revision);
    if (!revision) throw new PolicyRevisionNotFoundProblem(command.policyId, receipt.revision);
    return revision as PolicyRevision<TValue>;
  }

  private async audit(
    action: PolicyAuthorizationAction,
    revision: PolicyRevision<unknown>,
    actor: PolicyActor,
    reason: string,
  ): Promise<void> {
    await this.store.appendAudit?.({
      id: `policy:${action}:${revision.id}`,
      policyId: revision.policyId,
      scope: clone(revision.scope),
      action,
      revisionId: revision.id,
      revision: revision.revision,
      actor: clone(actor),
      reason,
      occurredAt: this.now(),
    });
  }

  private scope(scope: PolicyScope): PolicyScope {
    try {
      return normalizePolicyScope(scope);
    } catch (error) {
      throw new InvalidPolicyDefinitionProblem(
        error instanceof Error ? error.message : "Invalid policy scope",
      );
    }
  }

  private actor(actor: PolicyActorInput): PolicyActor {
    if (typeof actor === "string") {
      if (actor.trim().length === 0)
        throw new InvalidPolicyDefinitionProblem("actor must not be empty");
      return { id: actor.trim() };
    }
    if (!actor || typeof actor.id !== "string" || actor.id.trim().length === 0) {
      throw new InvalidPolicyDefinitionProblem("actor.id must not be empty");
    }
    return {
      id: actor.id.trim(),
      ...(actor.displayName ? { displayName: actor.displayName } : {}),
    };
  }

  private reason(reason: string): string {
    if (typeof reason !== "string" || reason.trim().length === 0) {
      throw new InvalidPolicyDefinitionProblem("reason must not be empty");
    }
    return reason.trim();
  }

  private instant(value: string, policyId: string): string {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
      throw new PolicyScheduleProblem(policyId, "effectiveAt must be a valid instant");
    }
    const instant = new Date(value).toISOString();
    if (instant !== value)
      throw new PolicyScheduleProblem(policyId, "effectiveAt must be canonical ISO-8601");
    return instant;
  }

  private now(): string {
    return this.clock.now().toISOString();
  }

  private async authorize(request: PolicyAuthorizationRequest): Promise<void> {
    const result = await this.authorization.authorize(request);
    if (result === false) throw new PolicyAuthorizationProblem(request.policyId, request.action);
  }
}

function validateRegistration<TValue, TContext extends PolicyContext, TResult>(
  policy: ParameterizedPolicy<TValue, TContext, TResult>,
): void {
  if (typeof policy.id !== "string" || policy.id.trim().length === 0) {
    throw new InvalidPolicyDefinitionProblem("policy.id must not be empty");
  }
  if (typeof policy.schemaVersion !== "string" || policy.schemaVersion.trim().length === 0) {
    throw new InvalidPolicyDefinitionProblem("policy.schemaVersion must not be empty");
  }
  if (policy.schema.version !== policy.schemaVersion) {
    throw new PolicySchemaVersionMismatchProblem(
      policy.id,
      policy.schemaVersion,
      policy.schema.version,
    );
  }
  if (
    typeof policy.codeRegistrationId !== "string" ||
    policy.codeRegistrationId.trim().length === 0
  ) {
    throw new InvalidPolicyDefinitionProblem("policy.codeRegistrationId must not be empty");
  }
  const fieldIds = policy.fieldDescriptors.map(({ id }) => id);
  if (fieldIds.some((id) => typeof id !== "string" || id.trim().length === 0)) {
    throw new InvalidPolicyDefinitionProblem("policy field descriptor ids must not be empty");
  }
  if (new Set(fieldIds).size !== fieldIds.length) {
    throw new InvalidPolicyDefinitionProblem("policy field descriptor ids must be unique");
  }
}

function erasePolicy<TValue, TContext extends PolicyContext, TResult>(
  policy: ParameterizedPolicy<TValue, TContext, TResult>,
  fingerprint: string,
): ErasedPolicy {
  const definition: PolicyDefinition<unknown> = {
    id: policy.id,
    schemaVersion: policy.schemaVersion,
    schema: policy.schema as unknown as PolicyDefinition<unknown>["schema"],
    fieldDescriptors:
      policy.fieldDescriptors as unknown as readonly PolicyFieldDescriptor<unknown>[],
    codeRegistrationId: policy.codeRegistrationId,
    registrationFingerprint: fingerprint,
    reviewRequirements: policy.reviewRequirements,
  };
  return {
    id: policy.id,
    schemaVersion: policy.schemaVersion,
    codeRegistrationId: policy.codeRegistrationId,
    registrationFingerprint: fingerprint,
    definition,
    fieldDescriptors:
      policy.fieldDescriptors as unknown as readonly PolicyFieldDescriptor<unknown>[],
    ...(policy.fallback !== undefined ? { fallback: clone(policy.fallback) } : {}),
    validate: (value) => validatePolicyValue(policy, value),
    semanticDiff: (before, after) =>
      policySemanticDiff(policy, before as TValue | null, after as TValue),
    evaluate: (value, context) => policy.evaluate(value as TValue, context as TContext),
  };
}

function registrationKey(policyId: string, schemaVersion: string): string {
  return `${policyId}\u0000${schemaVersion}`;
}

function registrationToPolicy(registration: ErasedPolicy): ParameterizedPolicy<unknown> {
  return {
    ...registration.definition,
    fallback: registration.fallback,
    validate: registration.validate,
    semanticDiff: registration.semanticDiff,
    evaluate: registration.evaluate,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
