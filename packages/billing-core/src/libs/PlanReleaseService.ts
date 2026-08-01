import type { PlanRegistry } from "./PlanRegistry";
import type {
  CreatePlanDraftCommand,
  PlanRelease,
  PlanReleaseActor,
  PlanReleaseEventPublisher,
  PlanReleaseEventDeliveryResult,
  PlanReleaseImpactAnalyzer,
  PlanReleaseImpactFact,
  PlanReleaseImpactPreview,
  PlanReleaseValidationEvidence,
  PlanReleaseState,
  PlanReleaseStore,
  PlanReleaseTransitionCommand,
  PublishPlanReleaseCommand,
  SubmitPlanReviewCommand,
  SupersedePlanReleaseCommand,
  UpdatePlanDraftCommand,
} from "./PlanRelease";
import {
  createPlanVersionSemanticDiff,
  planReleaseCommandFingerprint,
  planVersionDefinitionFingerprint,
} from "./PlanRelease";
import type { PlanReleaseValidator } from "./PlanRelease";
import type { PlanVersionDefinition, PlanVersionRef } from "../types";
import { PlanReleaseTransitionedEvent } from "./events/PlanReleaseTransitionedEvent";
import {
  InvalidPlanVersionDefinitionProblem,
  PlanVersionAlreadyPublishedProblem,
  PlanVersionConflictProblem,
  UnknownPlanVersionProblem,
} from "./problems/BillingProblems";
import {
  InvalidPlanReleaseScheduleProblem,
  InvalidPlanReleaseTransitionProblem,
  OverlappingPlanEffectivePeriodProblem,
  PlanReleaseProviderCapabilityProblem,
  PlanReleasePublishConflictProblem,
  PlanReleaseValidationFailedProblem,
  StalePlanReleaseRevisionProblem,
} from "./problems/PlanReleaseProblems";

export type PlanReleaseServiceDependencies = {
  readonly store: PlanReleaseStore;
  readonly planRegistry: PlanRegistry;
  readonly validator: PlanReleaseValidator;
  readonly impactAnalyzer: PlanReleaseImpactAnalyzer;
  readonly eventPublisher: PlanReleaseEventPublisher;
  readonly clock?: { readonly now: () => Date };
};

export class PlanReleaseService {
  private readonly clock: { readonly now: () => Date };

  constructor(private readonly dependencies: PlanReleaseServiceDependencies) {
    this.clock = dependencies.clock ?? { now: () => new Date() };
  }

  async createDraft(command: CreatePlanDraftCommand): Promise<PlanRelease> {
    validateCommandContext(command.actor, command.reason);
    validateEffectivePeriod(command.definition);
    const release: PlanRelease = {
      ref: command.definition.ref,
      state: "draft",
      revision: 1,
      definition: cloneDefinition(command.definition),
      history: [transitionRecord(null, "draft", 1, command.actor, command.reason, this.now())],
    };
    const event = this.createEvent(release, null, command.actor, command.reason);
    await this.dependencies.store.create(release, event);
    await this.deliverPendingEvents(release.ref);
    return release;
  }

  async updateDraft(command: UpdatePlanDraftCommand): Promise<PlanRelease> {
    validateCommandContext(command.actor, command.reason);
    validateEffectivePeriod(command.definition);
    const current = await this.requireRelease(command.definition.ref);
    this.assertRevision(current, command.expectedRevision);
    this.assertNoPublicationIntent(current);
    if (current.state === "published" || current.state === "superseded") {
      throw new PlanVersionAlreadyPublishedProblem(current.ref);
    }
    this.assertTransition(current, "draft", "draft");
    if (current.definition.ref !== command.definition.ref) {
      throw new InvalidPlanVersionDefinitionProblem("draft reference cannot be changed");
    }

    return this.saveTransition(current, "draft", command.actor, command.reason, {
      definition: cloneDefinition(command.definition),
      review: undefined,
      scheduledFor: undefined,
    });
  }

  async submitReview(command: SubmitPlanReviewCommand): Promise<PlanRelease> {
    const current = await this.requireTransition(command, "draft", "in_review");
    const definitionFingerprint = planVersionDefinitionFingerprint(current.definition);
    const validation = await this.dependencies.validator.validate({
      definition: current.definition,
      definitionFingerprint,
      draftRevision: current.revision,
    });
    if (
      validation.planVersionRef !== current.ref ||
      validation.definitionFingerprint !== definitionFingerprint ||
      validation.draftRevision !== current.revision ||
      validation.graphVersion.trim().length === 0 ||
      validation.snapshotId.trim().length === 0 ||
      !isCanonicalInstant(validation.checkedAt)
    ) {
      throw new PlanReleaseValidationFailedProblem(current.ref, [
        "validation-snapshot-definition-mismatch",
      ]);
    }
    const errors = validation.diagnostics.filter(
      (diagnostic) =>
        diagnostic.severity === "error" && diagnostic.source === "credential-free-structural",
    );
    if (errors.length > 0) {
      throw new PlanReleaseValidationFailedProblem(
        current.ref,
        errors.map(({ code }) => code).sort(),
      );
    }
    const previous = await this.previousPublishedVersion(current.definition);
    const impact = await this.dependencies.impactAnalyzer.analyze({
      previous,
      proposed: current.definition,
      audience: command.audience,
      validation,
    });
    const providerDiagnosticErrors = validation.diagnostics.filter(
      (diagnostic) =>
        diagnostic.severity === "error" && diagnostic.source === "remote-provider-preflight",
    );
    const failedProviderFacts = impact.providerPreflightFacts.filter(
      ({ outcome }) => outcome === "fail",
    );
    if (providerDiagnosticErrors.length > 0 || failedProviderFacts.length > 0) {
      throw new PlanReleaseProviderCapabilityProblem(
        current.ref,
        [
          ...new Set([
            ...providerDiagnosticErrors.map(({ code }) => code),
            ...failedProviderFacts.map(({ code }) => code),
          ]),
        ].sort(),
      );
    }

    return this.saveTransition(current, "in_review", command.actor, command.reason, {
      review: {
        reviewedDraftRevision: current.revision,
        reviewedDefinition: cloneDefinition(current.definition),
        validation: structuredClone(validation),
        semanticDiff: createPlanVersionSemanticDiff(previous, current.definition),
        impact: structuredClone(impact),
        reviewedAt: this.now(),
        actor: structuredClone(command.actor),
        reason: command.reason,
      },
      scheduledFor: undefined,
    });
  }

  async returnToDraft(command: PlanReleaseTransitionCommand): Promise<PlanRelease> {
    const current = await this.requireTransition(command, "in_review", "draft");
    return this.saveTransition(current, "draft", command.actor, command.reason, {
      review: undefined,
      scheduledFor: undefined,
    });
  }

  async schedulePublish(command: PlanReleaseTransitionCommand): Promise<PlanRelease> {
    const current = await this.requireTransition(command, "in_review", "scheduled");
    const effectiveAt = Date.parse(current.definition.effectiveAt);
    if (effectiveAt <= this.clock.now().getTime()) {
      throw new InvalidPlanReleaseScheduleProblem(
        current.ref,
        "effectiveAt must be later than the current time",
      );
    }
    await this.assertNoPublishedEffectivePeriodOverlap(current);
    return this.saveTransition(
      current,
      "scheduled",
      command.actor,
      command.reason,
      { scheduledFor: current.definition.effectiveAt },
      true,
    );
  }

  async publishNow(command: PublishPlanReleaseCommand): Promise<PlanRelease> {
    validateCommandContext(command.actor, command.reason);
    if (command.idempotencyKey.trim().length === 0) {
      throw new PlanReleasePublishConflictProblem(command.ref, command.idempotencyKey);
    }
    const fingerprint = planReleaseCommandFingerprint(command);
    let current = await this.requireRelease(command.ref);
    const existingPublication = current.publication;
    if (existingPublication) {
      if (
        existingPublication.idempotencyKey === command.idempotencyKey &&
        existingPublication.commandFingerprint === fingerprint
      ) {
        await this.deliverPendingEvents(current.ref);
        return current;
      }
      throw new PlanReleasePublishConflictProblem(command.ref, command.idempotencyKey);
    }

    const existingIntent = current.publicationIntent;
    if (existingIntent) {
      if (
        existingIntent.idempotencyKey !== command.idempotencyKey ||
        existingIntent.commandFingerprint !== fingerprint
      ) {
        throw new PlanReleasePublishConflictProblem(command.ref, command.idempotencyKey);
      }
    } else {
      this.assertRevision(current, command.expectedRevision);
    }
    if (current.state !== "in_review" && current.state !== "scheduled") {
      throw new InvalidPlanReleaseTransitionProblem(current.ref, current.state, "published");
    }
    if (
      current.state === "scheduled" &&
      Date.parse(current.definition.effectiveAt) > this.clock.now().getTime()
    ) {
      throw new InvalidPlanReleaseScheduleProblem(
        current.ref,
        "scheduled effectiveAt has not arrived",
      );
    }
    this.assertReviewedDefinition(current);
    await this.assertNoPublishedEffectivePeriodOverlap(current);

    if (!existingIntent) {
      const reserved: PlanRelease = {
        ...current,
        revision: current.revision + 1,
        publicationIntent: {
          reviewedDraftRevision: current.review?.reviewedDraftRevision ?? current.revision,
          validationSnapshotId: current.review?.validation.snapshotId ?? "",
          actor: structuredClone(command.actor),
          reason: command.reason,
          idempotencyKey: command.idempotencyKey,
          commandFingerprint: fingerprint,
          reservedAt: this.now(),
        },
      };
      try {
        await this.dependencies.store.save(reserved, current.revision, {
          enforceNoEffectivePeriodOverlap: true,
        });
        current = reserved;
      } catch (error) {
        if (!(error instanceof StalePlanReleaseRevisionProblem)) throw error;
        const reconciled = await this.requireRelease(current.ref);
        if (
          reconciled.publicationIntent?.idempotencyKey !== command.idempotencyKey ||
          reconciled.publicationIntent.commandFingerprint !== fingerprint
        ) {
          throw new PlanReleasePublishConflictProblem(command.ref, command.idempotencyKey);
        }
        current = reconciled;
      }
    }

    try {
      await this.dependencies.planRegistry.publishPlanVersion(current.definition);
    } catch (error) {
      if (!(error instanceof PlanVersionAlreadyPublishedProblem)) {
        if (
          error instanceof InvalidPlanVersionDefinitionProblem ||
          error instanceof PlanVersionConflictProblem
        ) {
          await this.recordDeterministicPublicationFailure(
            current,
            error.code,
            error.detail ?? error.message,
          );
        }
        throw error;
      }
      const published = await this.dependencies.planRegistry.getPlanVersion(current.ref);
      if (!published || !definitionsEqual(published, current.definition)) {
        throw error;
      }
    }

    const published = transition(current, "published", command.actor, command.reason, this.now(), {
      scheduledFor: current.scheduledFor,
      publicationIntent: undefined,
      publication: {
        reviewedDraftRevision:
          current.publicationIntent?.reviewedDraftRevision ??
          current.review?.reviewedDraftRevision ??
          current.revision,
        validationSnapshotId:
          current.publicationIntent?.validationSnapshotId ??
          current.review?.validation.snapshotId ??
          "",
        actor: structuredClone(command.actor),
        reason: command.reason,
        idempotencyKey: command.idempotencyKey,
        commandFingerprint: fingerprint,
        publishedAt: this.now(),
      },
    });

    const event = this.createEvent(published, current.state, command.actor, command.reason);
    try {
      await this.dependencies.store.save(published, current.revision, { event });
    } catch (error) {
      if (!(error instanceof StalePlanReleaseRevisionProblem)) throw error;
      const reconciled = await this.requireRelease(current.ref);
      if (
        reconciled.publication?.idempotencyKey !== command.idempotencyKey ||
        reconciled.publication.commandFingerprint !== fingerprint
      ) {
        throw new PlanReleasePublishConflictProblem(command.ref, command.idempotencyKey);
      }
      await this.deliverPendingEvents(reconciled.ref);
      return reconciled;
    }
    await this.deliverPendingEvents(published.ref);
    return published;
  }

  async abandon(command: PlanReleaseTransitionCommand): Promise<PlanRelease> {
    validateCommandContext(command.actor, command.reason);
    const current = await this.requireRelease(command.ref);
    this.assertRevision(current, command.expectedRevision);
    this.assertNoPublicationIntent(current);
    if (
      current.state !== "draft" &&
      current.state !== "in_review" &&
      current.state !== "scheduled"
    ) {
      throw new InvalidPlanReleaseTransitionProblem(current.ref, current.state, "abandoned");
    }
    return this.saveTransition(current, "abandoned", command.actor, command.reason);
  }

  async cancelPublish(command: PlanReleaseTransitionCommand): Promise<PlanRelease> {
    validateCommandContext(command.actor, command.reason);
    const current = await this.requireRelease(command.ref);
    this.assertRevision(current, command.expectedRevision);
    const intent = current.publicationIntent;
    if (!intent) {
      throw new InvalidPlanReleaseTransitionProblem(current.ref, current.state, current.state);
    }
    const cancelled: PlanRelease = {
      ...current,
      revision: current.revision + 1,
      publicationIntent: undefined,
      publicationFailures: [
        ...(current.publicationFailures ?? []),
        {
          idempotencyKey: intent.idempotencyKey,
          commandFingerprint: intent.commandFingerprint,
          code: "billing/plan-release-publication-cancelled",
          detail: command.reason,
          failedAt: this.now(),
          actor: structuredClone(command.actor),
          reason: command.reason,
        },
      ],
    };
    await this.dependencies.store.save(cancelled, current.revision);
    return cancelled;
  }

  async supersede(command: SupersedePlanReleaseCommand): Promise<PlanRelease> {
    const current = await this.requireTransition(command, "published", "superseded");
    const replacement = await this.requireRelease(command.replacementRef);
    if (
      replacement.state !== "published" ||
      replacement.definition.planId !== current.definition.planId
    ) {
      throw new InvalidPlanReleaseTransitionProblem(current.ref, current.state, "superseded");
    }
    return this.saveTransition(current, "superseded", command.actor, command.reason, {
      supersededBy: command.replacementRef,
    });
  }

  private async requireTransition(
    command: PlanReleaseTransitionCommand,
    from: PlanReleaseState,
    to: PlanReleaseState,
  ): Promise<PlanRelease> {
    validateCommandContext(command.actor, command.reason);
    const current = await this.requireRelease(command.ref);
    this.assertRevision(current, command.expectedRevision);
    this.assertNoPublicationIntent(current);
    this.assertTransition(current, from, to);
    return current;
  }

  private assertTransition(
    release: PlanRelease,
    from: PlanReleaseState,
    to: PlanReleaseState,
  ): void {
    if (release.state !== from) {
      if (release.state === "published" || release.state === "superseded") {
        throw new PlanVersionAlreadyPublishedProblem(release.ref);
      }
      throw new InvalidPlanReleaseTransitionProblem(release.ref, release.state, to);
    }
  }

  private assertRevision(release: PlanRelease, expectedRevision: number): void {
    if (release.revision !== expectedRevision) {
      throw new StalePlanReleaseRevisionProblem(release.ref, expectedRevision, release.revision);
    }
  }

  private assertNoPublicationIntent(release: PlanRelease): void {
    if (release.publicationIntent) {
      throw new PlanReleasePublishConflictProblem(
        release.ref,
        release.publicationIntent.idempotencyKey,
      );
    }
  }

  private async requireRelease(ref: PlanVersionRef): Promise<PlanRelease> {
    const release = await this.dependencies.store.get(ref);
    if (!release) throw new UnknownPlanVersionProblem(ref);
    return release;
  }

  private async previousPublishedVersion(
    definition: PlanVersionDefinition,
  ): Promise<PlanVersionDefinition | null> {
    const effectiveAt = Date.parse(definition.effectiveAt);
    return this.dependencies.planRegistry.getPlanAtDate(
      definition.planId,
      new Date(effectiveAt - 1),
    );
  }

  private assertReviewedDefinition(release: PlanRelease): void {
    const review = release.review;
    if (!review || !definitionsEqual(review.reviewedDefinition, release.definition)) {
      throw new PlanReleaseValidationFailedProblem(release.ref, ["review-snapshot-drift"]);
    }
  }

  private async assertNoPublishedEffectivePeriodOverlap(release: PlanRelease): Promise<void> {
    const published = await this.dependencies.planRegistry.getAllPlanVersions(
      release.definition.planId,
    );
    const publishedConflict = published.find(
      (candidate) =>
        candidate.ref !== release.ref && effectivePeriodsConflict(candidate, release.definition),
    );
    if (publishedConflict) {
      throw new OverlappingPlanEffectivePeriodProblem(release.ref, publishedConflict.ref);
    }
  }

  private async saveTransition(
    current: PlanRelease,
    to: PlanReleaseState,
    actor: PlanReleaseActor,
    reason: string,
    changes: Partial<PlanRelease> = {},
    enforceNoEffectivePeriodOverlap = false,
  ): Promise<PlanRelease> {
    const next = transition(current, to, actor, reason, this.now(), changes);
    const event = this.createEvent(next, current.state, actor, reason);
    await this.dependencies.store.save(next, current.revision, {
      event,
      enforceNoEffectivePeriodOverlap,
    });
    await this.deliverPendingEvents(next.ref);
    return next;
  }

  private async recordDeterministicPublicationFailure(
    current: PlanRelease,
    code: string,
    detail: string,
  ): Promise<void> {
    const intent = current.publicationIntent;
    if (!intent) return;
    await this.dependencies.store.save(
      {
        ...current,
        revision: current.revision + 1,
        publicationIntent: undefined,
        publicationFailures: [
          ...(current.publicationFailures ?? []),
          {
            idempotencyKey: intent.idempotencyKey,
            commandFingerprint: intent.commandFingerprint,
            code,
            detail,
            failedAt: this.now(),
            actor: structuredClone(intent.actor),
            reason: intent.reason,
          },
        ],
      },
      current.revision,
    );
  }

  private createEvent(
    release: PlanRelease,
    from: PlanReleaseState | null,
    actor: PlanReleaseActor,
    reason: string,
  ): PlanReleaseTransitionedEvent {
    return new PlanReleaseTransitionedEvent(
      release.ref,
      from,
      release.state,
      release.revision,
      actor.id,
      reason,
      `plan-release:${release.ref}:${release.revision}`,
    );
  }

  async deliverPendingEvents(ref?: PlanVersionRef): Promise<PlanReleaseEventDeliveryResult> {
    const pending = await this.dependencies.store.listPendingEvents(ref);
    let published = 0;
    const failures: PlanReleaseEventDeliveryResult["failures"][number][] = [];
    for (const event of pending) {
      try {
        await this.dependencies.eventPublisher.publishIdempotently(event);
        await this.dependencies.store.markEventPublished(event.eventId);
        published += 1;
      } catch (error) {
        failures.push({
          eventId: event.eventId,
          detail: error instanceof Error ? error.message : "Unknown event publication failure",
        });
      }
    }
    return {
      attempted: pending.length,
      published,
      pending: pending.length - published,
      failures,
    };
  }

  private now(): string {
    return this.clock.now().toISOString();
  }
}

export class DeterministicPlanReleaseImpactAnalyzer implements PlanReleaseImpactAnalyzer {
  async analyze(input: {
    readonly previous: PlanVersionDefinition | null;
    readonly proposed: PlanVersionDefinition;
    readonly audience: PlanReleaseImpactPreview["audience"];
    readonly validation: PlanReleaseValidationEvidence;
  }): Promise<PlanReleaseImpactPreview> {
    const diff = createPlanVersionSemanticDiff(input.previous, input.proposed);
    const calculatedFacts: PlanReleaseImpactFact[] = diff.map(({ field }) => ({
      code: `plan-change:${field}`,
      message: `Plan release changes ${field.replace(/_/g, " ")}.`,
      references: [input.proposed.ref, field],
    }));
    const providerCapabilitiesRequired = [
      ...new Set([
        "checkout",
        ...(input.proposed.providerBindings.some(
          (binding) => (binding.meterBindings?.length ?? 0) > 0,
        )
          ? ["usage"]
          : []),
      ]),
    ].sort();

    return {
      audience: structuredClone(input.audience),
      calculatedFacts,
      providerPreflightFacts: input.validation.diagnostics
        .filter(({ source }) => source === "remote-provider-preflight")
        .map((diagnostic) => ({
          code: diagnostic.code,
          message: diagnostic.message,
          references: [diagnostic.contractId ?? input.proposed.ref],
          outcome: diagnostic.severity === "error" ? "fail" : "pass",
        })),
      estimates: [],
      providerCapabilitiesRequired,
    };
  }
}

function transition(
  current: PlanRelease,
  to: PlanReleaseState,
  actor: PlanReleaseActor,
  reason: string,
  occurredAt: string,
  changes: Partial<PlanRelease> = {},
): PlanRelease {
  const revision = current.revision + 1;
  return {
    ...current,
    ...changes,
    state: to,
    revision,
    history: [
      ...current.history,
      transitionRecord(current.state, to, revision, actor, reason, occurredAt),
    ],
  };
}

function transitionRecord(
  from: PlanReleaseState | null,
  to: PlanReleaseState,
  revision: number,
  actor: PlanReleaseActor,
  reason: string,
  occurredAt: string,
): PlanRelease["history"][number] {
  return { from, to, revision, occurredAt, actor: structuredClone(actor), reason };
}

function validateCommandContext(actor: PlanReleaseActor, reason: string): void {
  if (actor.id.trim().length === 0 || reason.trim().length === 0) {
    throw new InvalidPlanVersionDefinitionProblem("release actor and reason must not be empty");
  }
}

function validateEffectivePeriod(definition: PlanVersionDefinition): void {
  const start = Date.parse(definition.effectiveAt);
  const end = definition.effectiveUntil
    ? Date.parse(definition.effectiveUntil)
    : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(start) || Number.isNaN(end) || end <= start) {
    throw new InvalidPlanVersionDefinitionProblem("effective period must be valid and increasing");
  }
}

function isCanonicalInstant(value: string): boolean {
  const instant = new Date(value);
  return !Number.isNaN(instant.getTime()) && instant.toISOString() === value;
}

function effectivePeriodsConflict(
  left: PlanVersionDefinition,
  right: PlanVersionDefinition,
): boolean {
  const leftStart = Date.parse(left.effectiveAt);
  const rightStart = Date.parse(right.effectiveAt);
  if (leftStart === rightStart) return true;
  if (leftStart < rightStart && left.effectiveUntil === undefined) return false;
  if (rightStart < leftStart && right.effectiveUntil === undefined) return false;

  const leftEnd = left.effectiveUntil ? Date.parse(left.effectiveUntil) : Number.POSITIVE_INFINITY;
  const rightEnd = right.effectiveUntil
    ? Date.parse(right.effectiveUntil)
    : Number.POSITIVE_INFINITY;
  return leftStart < rightEnd && rightStart < leftEnd;
}

function cloneDefinition(definition: PlanVersionDefinition): PlanVersionDefinition {
  return structuredClone(definition);
}

function definitionsEqual(left: PlanVersionDefinition, right: PlanVersionDefinition): boolean {
  return (
    createPlanVersionSemanticDiff(left, right).length === 0 &&
    left.ref === right.ref &&
    left.planId === right.planId &&
    left.versionId === right.versionId &&
    left.name === right.name
  );
}
