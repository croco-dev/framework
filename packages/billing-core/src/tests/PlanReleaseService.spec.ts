import { describe, expect, it } from "vitest";

import { buildContractGraph } from "@croco/protocols-core";

import {
  createPlanVersionSemanticDiff,
  DeterministicPlanReleaseImpactAnalyzer,
  InMemoryPlanRegistry,
  InMemoryPlanReleaseStore,
  InvalidPlanVersionDefinitionProblem,
  InvalidPlanReleaseScheduleProblem,
  InvalidPlanReleaseTransitionProblem,
  OverlappingPlanEffectivePeriodProblem,
  PlanReleaseProviderCapabilityProblem,
  PlanReleasePublishConflictProblem,
  PlanReleaseService,
  PlanReleaseValidationFailedProblem,
  PlanVersionAlreadyPublishedProblem,
  StalePlanReleaseRevisionProblem,
  planVersionRef,
} from "../index";
import type {
  PlanReleaseEventPublisher,
  PlanReleaseImpactAnalyzer,
  PlanReleaseImpactPreview,
  PlanReleaseLifecycleEvent,
  PlanReleaseStore,
  PlanRegistry,
  PlanReleaseValidationEvidence,
  PlanReleaseValidator,
  PlanVersionDefinition,
  PlanVersionRef,
} from "../index";

const ACTOR = { id: "operator-1", displayName: "Operator" };

function createDefinition(
  overrides: Partial<PlanVersionDefinition> & { readonly ref?: PlanVersionRef } = {},
): PlanVersionDefinition {
  return {
    ref: planVersionRef("pro@2027-01"),
    planId: "pro",
    versionId: "2027-01",
    effectiveAt: "2027-01-01T00:00:00.000Z",
    effectiveUntil: "2028-01-01T00:00:00.000Z",
    name: "Pro",
    amount: 9_900,
    currency: "USD",
    interval: "month",
    intervalCount: 1,
    rating: { mode: "provider", provider: "polar" },
    quantityPolicy: {
      minimumQuantity: 1,
      includedSeats: 2,
      seatQuota: 100,
      billableMembershipRoles: ["owner", "admin", "member"],
    },
    seatUnitAmount: 1_000,
    usageTiers: [
      { meterKey: "api.calls", upTo: null, unitAmount: 2 },
      { meterKey: "api.calls", upTo: 1_000, unitAmount: 0 },
    ],
    entitlements: [
      { featureKey: "analytics", type: "boolean" },
      {
        featureKey: "api",
        type: "metered",
        meterKey: "api.calls",
        quota: 1_000,
        overagePolicy: "WARN",
      },
    ],
    trial: { days: 14, requiresPaymentMethod: true },
    providerBindings: [
      {
        provider: "polar",
        productId: "polar-pro-2027",
        priceIds: ["price-recurring", "price-seat"],
        meterBindings: [{ meterKey: "api.calls", meterId: "polar-api-calls" }],
      },
    ],
    ...overrides,
  };
}

function validation(
  diagnostics: PlanReleaseValidationEvidence["diagnostics"] = [],
): PlanReleaseValidationEvidence {
  return {
    graphVersion: "croco.contract-graph.v1",
    snapshotId: "sha256:reviewed-contract",
    planVersionRef: planVersionRef("pro@2027-01"),
    definitionFingerprint: "sha256:definition",
    draftRevision: 1,
    checkedAt: "2026-08-01T00:00:00.000Z",
    diagnostics,
  };
}

function createHarness(
  options: {
    readonly validation?: PlanReleaseValidationEvidence;
    readonly impactAnalyzer?: PlanReleaseImpactAnalyzer;
    readonly now?: () => Date;
    readonly preserveValidationBinding?: boolean;
    readonly eventPublisher?: PlanReleaseEventPublisher;
    readonly validator?: PlanReleaseValidator;
    readonly planRegistry?: PlanRegistry;
    readonly store?: PlanReleaseStore;
  } = {},
) {
  const store = options.store ?? new InMemoryPlanReleaseStore();
  const planRegistry = options.planRegistry ?? new InMemoryPlanRegistry();
  const events: PlanReleaseLifecycleEvent[] = [];
  const validator: PlanReleaseValidator = options.validator ?? {
    async validate(input) {
      const evidence = options.validation ?? validation();
      return options.preserveValidationBinding
        ? evidence
        : {
            ...evidence,
            planVersionRef: input.definition.ref,
            definitionFingerprint: input.definitionFingerprint,
            draftRevision: input.draftRevision,
          };
    },
  };
  const eventPublisher: PlanReleaseEventPublisher = options.eventPublisher ?? {
    async publishIdempotently(event) {
      events.push(event);
    },
  };
  const service = new PlanReleaseService({
    store,
    planRegistry,
    validator,
    impactAnalyzer: options.impactAnalyzer ?? new DeterministicPlanReleaseImpactAnalyzer(),
    eventPublisher,
    clock: { now: options.now ?? (() => new Date("2026-08-01T00:00:00.000Z")) },
  });
  return { events, planRegistry, service, store };
}

async function reviewDraft(
  service: PlanReleaseService,
  definition: PlanVersionDefinition = createDefinition(),
) {
  const draft = await service.createDraft({ definition, actor: ACTOR, reason: "initial draft" });
  return service.submitReview({
    ref: draft.ref,
    expectedRevision: draft.revision,
    actor: ACTOR,
    reason: "ready for review",
    audience: "new_subscriptions",
  });
}

describe("PlanReleaseService", () => {
  it("mutates drafts only through optimistic revisions and preserves transition evidence", async () => {
    const { events, service } = createHarness();
    const draft = await service.createDraft({
      definition: createDefinition(),
      actor: ACTOR,
      reason: "create",
    });
    const updated = await service.updateDraft({
      definition: createDefinition({ amount: 12_900 }),
      expectedRevision: draft.revision,
      actor: ACTOR,
      reason: "adjust price",
    });

    expect(updated).toMatchObject({ state: "draft", revision: 2, definition: { amount: 12_900 } });
    expect(updated.history).toEqual([
      expect.objectContaining({ from: null, to: "draft", revision: 1, reason: "create" }),
      expect.objectContaining({ from: "draft", to: "draft", revision: 2, reason: "adjust price" }),
    ]);
    expect(events.map(({ to }) => to)).toEqual(["draft", "draft"]);

    await expect(
      service.updateDraft({
        definition: createDefinition({ amount: 15_900 }),
        expectedRevision: draft.revision,
        actor: ACTOR,
        reason: "stale edit",
      }),
    ).rejects.toBeInstanceOf(StalePlanReleaseRevisionProblem);
  });

  it("supports the explicit review, return, schedule, abandon, publish, and supersede transitions", async () => {
    const { service } = createHarness();
    const reviewed = await reviewDraft(service);
    const returned = await service.returnToDraft({
      ref: reviewed.ref,
      expectedRevision: reviewed.revision,
      actor: ACTOR,
      reason: "needs revision",
    });
    expect(returned).toMatchObject({ state: "draft", review: undefined });

    const reviewedAgain = await service.submitReview({
      ref: returned.ref,
      expectedRevision: returned.revision,
      actor: ACTOR,
      reason: "reviewed again",
      audience: "grandfathered_subscriptions",
    });
    const scheduled = await service.schedulePublish({
      ref: reviewedAgain.ref,
      expectedRevision: reviewedAgain.revision,
      actor: ACTOR,
      reason: "schedule",
    });
    expect(scheduled).toMatchObject({
      state: "scheduled",
      scheduledFor: "2027-01-01T00:00:00.000Z",
    });

    const abandonedDefinition = createDefinition({
      ref: planVersionRef("starter@2027-01"),
      planId: "starter",
      providerBindings: [{ provider: "polar", productId: "starter", priceIds: ["starter-price"] }],
    });
    const abandonedDraft = await service.createDraft({
      definition: abandonedDefinition,
      actor: ACTOR,
      reason: "experiment",
    });
    const abandoned = await service.abandon({
      ref: abandonedDraft.ref,
      expectedRevision: abandonedDraft.revision,
      actor: ACTOR,
      reason: "not viable",
    });
    expect(abandoned.state).toBe("abandoned");

    const replacement = await reviewDraft(
      service,
      createDefinition({
        ref: planVersionRef("pro@2028-01"),
        versionId: "2028-01",
        effectiveAt: "2028-01-01T00:00:00.000Z",
        effectiveUntil: "2029-01-01T00:00:00.000Z",
        providerBindings: [
          { provider: "polar", productId: "polar-pro-2028", priceIds: ["price-2028"] },
        ],
      }),
    );
    const publishedReplacement = await service.publishNow({
      ref: replacement.ref,
      expectedRevision: replacement.revision,
      actor: ACTOR,
      reason: "publish replacement",
      idempotencyKey: "publish-pro-2028",
    });

    const original = await reviewDraft(
      service,
      createDefinition({
        ref: planVersionRef("legacy@2027-01"),
        planId: "legacy",
        providerBindings: [{ provider: "polar", productId: "legacy", priceIds: ["legacy-price"] }],
      }),
    );
    const publishedOriginal = await service.publishNow({
      ref: original.ref,
      expectedRevision: original.revision,
      actor: ACTOR,
      reason: "publish original",
      idempotencyKey: "publish-legacy",
    });
    await expect(
      service.supersede({
        ref: publishedOriginal.ref,
        expectedRevision: publishedOriginal.revision,
        replacementRef: publishedReplacement.ref,
        actor: ACTOR,
        reason: "wrong family",
      }),
    ).rejects.toBeInstanceOf(InvalidPlanReleaseTransitionProblem);
  });

  it("records the exact reviewed snapshot and publishes a retry exactly once", async () => {
    const { events, planRegistry, service } = createHarness();
    const reviewed = await reviewDraft(service);
    const command = {
      ref: reviewed.ref,
      expectedRevision: reviewed.revision,
      actor: ACTOR,
      reason: "approved",
      idempotencyKey: "publish-pro-2027",
    } as const;
    const [first, retry] = await Promise.all([
      service.publishNow(command),
      service.publishNow(command),
    ]);

    expect(first.state).toBe("published");
    expect(retry.publication).toEqual(first.publication);
    expect(first.publication).toMatchObject({
      reviewedDraftRevision: 1,
      validationSnapshotId: "sha256:reviewed-contract",
      actor: ACTOR,
      reason: "approved",
      idempotencyKey: "publish-pro-2027",
    });
    await expect(planRegistry.getAllPlanVersions("pro")).resolves.toHaveLength(1);
    expect(events.filter(({ to }) => to === "published")).toHaveLength(1);

    await expect(
      service.publishNow({ ...command, idempotencyKey: "different-key" }),
    ).rejects.toBeInstanceOf(PlanReleasePublishConflictProblem);
    await expect(
      service.returnToDraft({
        ref: first.ref,
        expectedRevision: first.revision,
        actor: ACTOR,
        reason: "mutate published",
      }),
    ).rejects.toBeInstanceOf(PlanVersionAlreadyPublishedProblem);
  });

  it("allows only one of two conflicting concurrent publish identities to win", async () => {
    const { planRegistry, service } = createHarness();
    const reviewed = await reviewDraft(service);
    const base = {
      ref: reviewed.ref,
      expectedRevision: reviewed.revision,
      actor: ACTOR,
      reason: "concurrent approval",
    } as const;
    const outcomes = await Promise.allSettled([
      service.publishNow({ ...base, idempotencyKey: "publish-a" }),
      service.publishNow({ ...base, idempotencyKey: "publish-b" }),
    ]);

    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(outcomes.find(({ status }) => status === "rejected")).toMatchObject({
      reason: expect.any(PlanReleasePublishConflictProblem),
    });
    await expect(planRegistry.getAllPlanVersions("pro")).resolves.toHaveLength(1);
  });

  it("publishes a scheduled review only after its effective instant arrives", async () => {
    let currentTime = new Date("2026-08-01T00:00:00.000Z");
    const { service } = createHarness({ now: () => currentTime });
    const reviewed = await reviewDraft(service);
    const scheduled = await service.schedulePublish({
      ref: reviewed.ref,
      expectedRevision: reviewed.revision,
      actor: ACTOR,
      reason: "schedule",
    });
    const command = {
      ref: scheduled.ref,
      expectedRevision: scheduled.revision,
      actor: ACTOR,
      reason: "scheduled worker",
      idempotencyKey: "scheduled-pro-2027",
    } as const;

    await expect(service.publishNow(command)).rejects.toBeInstanceOf(
      InvalidPlanReleaseScheduleProblem,
    );
    currentTime = new Date("2027-01-01T00:00:00.000Z");
    await expect(service.publishNow(command)).resolves.toMatchObject({ state: "published" });
  });

  it("supersedes a published version only with a published replacement in the same family", async () => {
    const { service } = createHarness();
    const originalReview = await reviewDraft(service);
    const original = await service.publishNow({
      ref: originalReview.ref,
      expectedRevision: originalReview.revision,
      actor: ACTOR,
      reason: "publish original",
      idempotencyKey: "publish-original",
    });
    const replacementReview = await reviewDraft(
      service,
      createDefinition({
        ref: planVersionRef("pro@2028-01"),
        versionId: "2028-01",
        effectiveAt: "2028-01-01T00:00:00.000Z",
        effectiveUntil: "2029-01-01T00:00:00.000Z",
        providerBindings: [
          { provider: "polar", productId: "polar-pro-2028", priceIds: ["price-2028"] },
        ],
      }),
    );
    const replacement = await service.publishNow({
      ref: replacementReview.ref,
      expectedRevision: replacementReview.revision,
      actor: ACTOR,
      reason: "publish replacement",
      idempotencyKey: "publish-replacement",
    });
    const superseded = await service.supersede({
      ref: original.ref,
      expectedRevision: original.revision,
      replacementRef: replacement.ref,
      actor: ACTOR,
      reason: "roll forward",
    });

    expect(superseded).toMatchObject({
      state: "superseded",
      supersededBy: replacement.ref,
      publication: { idempotencyKey: "publish-original" },
    });
  });

  it("rejects structural and provider validation failures before review", async () => {
    const structural = createHarness({
      validation: validation([
        {
          code: "CROCO_BILLING_METER_UNBOUND",
          severity: "error",
          target: "monetization",
          message: "meter is unbound",
          source: "credential-free-structural",
        },
      ]),
    });
    const structuralDraft = await structural.service.createDraft({
      definition: createDefinition(),
      actor: ACTOR,
      reason: "create",
    });
    await expect(
      structural.service.submitReview({
        ref: structuralDraft.ref,
        expectedRevision: structuralDraft.revision,
        actor: ACTOR,
        reason: "review",
        audience: "new_subscriptions",
      }),
    ).rejects.toBeInstanceOf(PlanReleaseValidationFailedProblem);

    const provider = createHarness({
      validation: validation([
        {
          code: "polar/meter-missing",
          severity: "error",
          target: "provider",
          message: "remote meter is missing",
          source: "remote-provider-preflight",
        },
      ]),
    });
    const providerDraft = await provider.service.createDraft({
      definition: createDefinition(),
      actor: ACTOR,
      reason: "create",
    });
    await expect(
      provider.service.submitReview({
        ref: providerDraft.ref,
        expectedRevision: providerDraft.revision,
        actor: ACTOR,
        reason: "review",
        audience: "new_subscriptions",
      }),
    ).rejects.toBeInstanceOf(PlanReleaseProviderCapabilityProblem);
  });

  it("binds ContractGraph validation evidence to the exact draft revision and definition", async () => {
    const definition = createDefinition();
    const graph = buildContractGraph([], {
      monetization: {
        meters: [
          {
            key: "api.calls",
            aggregation: "COUNT",
            unit: "call",
            billing: "required",
          },
        ],
        planVersions: [
          {
            ref: definition.ref,
            planId: definition.planId,
            versionId: definition.versionId,
            rating: definition.rating,
            providerBindings: definition.providerBindings,
          },
        ],
        providers: [
          {
            providerName: "polar",
            capabilities: {
              checkout: { supported: true },
              usage: { supported: true },
            },
          },
        ],
      },
    });
    const validator: PlanReleaseValidator = {
      async validate(input) {
        expect(graph.monetization?.verification).toEqual({
          mode: "credential-free-structural",
          remoteProviderConfigurationInspected: false,
        });
        expect(graph.monetization?.nodes).toContainEqual(
          expect.objectContaining({ kind: "plan-version", ref: input.definition.ref }),
        );
        return {
          graphVersion: graph.version,
          snapshotId: "sha256:contract-graph-fixture",
          planVersionRef: input.definition.ref,
          definitionFingerprint: input.definitionFingerprint,
          draftRevision: input.draftRevision,
          checkedAt: "2026-08-01T00:00:00.000Z",
          diagnostics: graph.diagnostics.map((diagnostic) => ({
            code: diagnostic.code,
            severity: diagnostic.severity === "error" ? "error" : "warning",
            target: diagnostic.target,
            message: diagnostic.message,
            source: "credential-free-structural" as const,
          })),
        };
      },
    };
    const integrated = createHarness({ validator });
    await expect(reviewDraft(integrated.service, definition)).resolves.toMatchObject({
      state: "in_review",
      review: { validation: { snapshotId: "sha256:contract-graph-fixture" } },
    });

    const stale = createHarness({
      validation: validation(),
      preserveValidationBinding: true,
    });
    const draft = await stale.service.createDraft({
      definition,
      actor: ACTOR,
      reason: "create",
    });
    await expect(
      stale.service.submitReview({
        ref: draft.ref,
        expectedRevision: draft.revision,
        actor: ACTOR,
        reason: "stale evidence",
        audience: "new_subscriptions",
      }),
    ).rejects.toBeInstanceOf(PlanReleaseValidationFailedProblem);
  });

  it("rejects provider errors even when a custom impact analyzer omits provider facts", async () => {
    const impactAnalyzer: PlanReleaseImpactAnalyzer = {
      async analyze({ audience }) {
        return {
          audience,
          calculatedFacts: [],
          providerPreflightFacts: [],
          estimates: [],
          providerCapabilitiesRequired: [],
        };
      },
    };
    const harness = createHarness({
      impactAnalyzer,
      validation: validation([
        {
          code: "polar/capability-missing",
          severity: "error",
          target: "provider",
          message: "required capability is missing",
          source: "remote-provider-preflight",
        },
      ]),
    });
    const draft = await harness.service.createDraft({
      definition: createDefinition(),
      actor: ACTOR,
      reason: "create",
    });
    await expect(
      harness.service.submitReview({
        ref: draft.ref,
        expectedRevision: draft.revision,
        actor: ACTOR,
        reason: "review",
        audience: "new_subscriptions",
      }),
    ).rejects.toBeInstanceOf(PlanReleaseProviderCapabilityProblem);
  });

  it("keeps calculated facts, provider facts, and estimates distinct in impact evidence", async () => {
    const impactAnalyzer: PlanReleaseImpactAnalyzer = {
      async analyze({ audience }): Promise<PlanReleaseImpactPreview> {
        return {
          audience,
          calculatedFacts: [{ code: "price-change", message: "price rises", references: ["pro"] }],
          providerPreflightFacts: [
            {
              code: "polar-ready",
              message: "mapping exists",
              references: ["polar"],
              outcome: "pass",
            },
          ],
          estimates: [
            {
              code: "conversion-estimate",
              message: "estimated conversion impact",
              references: ["cohort-a"],
              confidence: "low",
            },
          ],
          providerCapabilitiesRequired: ["checkout"],
        };
      },
    };
    const { service } = createHarness({ impactAnalyzer });
    const reviewed = await reviewDraft(service);
    expect(reviewed.review?.impact).toEqual({
      audience: "new_subscriptions",
      calculatedFacts: [expect.objectContaining({ code: "price-change" })],
      providerPreflightFacts: [expect.objectContaining({ code: "polar-ready" })],
      estimates: [expect.objectContaining({ code: "conversion-estimate", confidence: "low" })],
      providerCapabilitiesRequired: ["checkout"],
    });
  });

  it("rejects past schedules and overlapping effective windows", async () => {
    const { service } = createHarness();
    const first = await reviewDraft(service);
    await service.schedulePublish({
      ref: first.ref,
      expectedRevision: first.revision,
      actor: ACTOR,
      reason: "schedule first",
    });

    const overlapping = await reviewDraft(
      service,
      createDefinition({
        ref: planVersionRef("pro@2027-06"),
        versionId: "2027-06",
        effectiveAt: "2027-06-01T00:00:00.000Z",
        effectiveUntil: "2028-06-01T00:00:00.000Z",
        providerBindings: [
          { provider: "polar", productId: "polar-pro-2027-06", priceIds: ["price-2027-06"] },
        ],
      }),
    );
    await expect(
      service.schedulePublish({
        ref: overlapping.ref,
        expectedRevision: overlapping.revision,
        actor: ACTOR,
        reason: "overlap",
      }),
    ).rejects.toBeInstanceOf(OverlappingPlanEffectivePeriodProblem);

    const past = await reviewDraft(
      service,
      createDefinition({
        ref: planVersionRef("past@2026-01"),
        planId: "past",
        versionId: "2026-01",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        effectiveUntil: "2026-07-01T00:00:00.000Z",
        providerBindings: [{ provider: "polar", productId: "past", priceIds: ["past-price"] }],
      }),
    );
    await expect(
      service.schedulePublish({
        ref: past.ref,
        expectedRevision: past.revision,
        actor: ACTOR,
        reason: "past",
      }),
    ).rejects.toBeInstanceOf(InvalidPlanReleaseScheduleProblem);
  });

  it("atomically rejects concurrent overlapping schedules for distinct releases", async () => {
    const { service } = createHarness();
    const first = await reviewDraft(service);
    const second = await reviewDraft(
      service,
      createDefinition({
        ref: planVersionRef("pro@2027-06"),
        versionId: "2027-06",
        effectiveAt: "2027-06-01T00:00:00.000Z",
        effectiveUntil: "2028-06-01T00:00:00.000Z",
        providerBindings: [
          { provider: "polar", productId: "polar-pro-2027-06", priceIds: ["price-2027-06"] },
        ],
      }),
    );
    const outcomes = await Promise.allSettled([
      service.schedulePublish({
        ref: first.ref,
        expectedRevision: first.revision,
        actor: ACTOR,
        reason: "schedule first",
      }),
      service.schedulePublish({
        ref: second.ref,
        expectedRevision: second.revision,
        actor: ACTOR,
        reason: "schedule second",
      }),
    ]);
    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(outcomes.find(({ status }) => status === "rejected")).toMatchObject({
      reason: expect.any(OverlappingPlanEffectivePeriodProblem),
    });
  });

  it("reserves publication before registry effects and blocks competing transitions", async () => {
    let continuePublish: (() => void) | undefined;
    let publicationStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      publicationStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      continuePublish = resolve;
    });
    class DelayedPlanRegistry extends InMemoryPlanRegistry {
      override async publishPlanVersion(definition: PlanVersionDefinition): Promise<void> {
        publicationStarted?.();
        await gate;
        return super.publishPlanVersion(definition);
      }
    }
    const { service } = createHarness({ planRegistry: new DelayedPlanRegistry() });
    const reviewed = await reviewDraft(service);
    const publishing = service.publishNow({
      ref: reviewed.ref,
      expectedRevision: reviewed.revision,
      actor: ACTOR,
      reason: "publish",
      idempotencyKey: "reserved-publish",
    });
    await started;
    await expect(
      service.abandon({
        ref: reviewed.ref,
        expectedRevision: reviewed.revision,
        actor: ACTOR,
        reason: "race publication",
      }),
    ).rejects.toBeInstanceOf(StalePlanReleaseRevisionProblem);
    continuePublish?.();
    await expect(publishing).resolves.toMatchObject({ state: "published" });
  });

  it("reconciles a registry write after a transient final release-store failure", async () => {
    class FailFinalSaveOnceStore extends InMemoryPlanReleaseStore {
      private failFinalSave = true;

      override async save(...args: Parameters<InMemoryPlanReleaseStore["save"]>): Promise<void> {
        if (args[0].state === "published" && this.failFinalSave) {
          this.failFinalSave = false;
          throw new Error("release store unavailable");
        }
        return super.save(...args);
      }
    }
    const store = new FailFinalSaveOnceStore();
    const { planRegistry, service } = createHarness({ store });
    const reviewed = await reviewDraft(service);
    const command = {
      ref: reviewed.ref,
      expectedRevision: reviewed.revision,
      actor: ACTOR,
      reason: "publish with retry",
      idempotencyKey: "publish-after-store-recovery",
    } as const;

    await expect(service.publishNow(command)).rejects.toThrow("release store unavailable");
    await expect(planRegistry.getAllPlanVersions("pro")).resolves.toHaveLength(1);
    await expect(service.publishNow(command)).resolves.toMatchObject({
      state: "published",
      publication: { idempotencyKey: command.idempotencyKey },
    });
    await expect(planRegistry.getAllPlanVersions("pro")).resolves.toHaveLength(1);
  });

  it("records deterministic registry rejection and releases the publication reservation", async () => {
    const { service, store } = createHarness();
    const invalid = await reviewDraft(service, createDefinition({ amount: -1 }));
    await expect(
      service.publishNow({
        ref: invalid.ref,
        expectedRevision: invalid.revision,
        actor: ACTOR,
        reason: "invalid registry publish",
        idempotencyKey: "invalid-publish",
      }),
    ).rejects.toBeInstanceOf(InvalidPlanVersionDefinitionProblem);

    const recovered = await store.get(invalid.ref);
    expect(recovered).toMatchObject({
      state: "in_review",
      publicationIntent: undefined,
      publicationFailures: [
        expect.objectContaining({
          idempotencyKey: "invalid-publish",
          code: "billing/invalid-plan-version-definition",
        }),
      ],
    });
    if (!recovered) throw new Error("expected recovered release");
    const returned = await service.returnToDraft({
      ref: recovered.ref,
      expectedRevision: recovered.revision,
      actor: ACTOR,
      reason: "correct invalid definition",
    });
    await expect(
      service.updateDraft({
        definition: createDefinition(),
        expectedRevision: returned.revision,
        actor: ACTOR,
        reason: "correct amount",
      }),
    ).resolves.toMatchObject({ state: "draft", definition: { amount: 9_900 } });
  });

  it("allows an operator to cancel an ambiguous publication reservation", async () => {
    class AmbiguousPlanRegistry extends InMemoryPlanRegistry {
      override async publishPlanVersion(): Promise<void> {
        throw new Error("ambiguous registry failure");
      }
    }
    const { service, store } = createHarness({ planRegistry: new AmbiguousPlanRegistry() });
    const reviewed = await reviewDraft(service);
    await expect(
      service.publishNow({
        ref: reviewed.ref,
        expectedRevision: reviewed.revision,
        actor: ACTOR,
        reason: "ambiguous publish",
        idempotencyKey: "ambiguous-publish",
      }),
    ).rejects.toThrow("ambiguous registry failure");
    const reserved = await store.get(reviewed.ref);
    expect(reserved?.publicationIntent).toMatchObject({ idempotencyKey: "ambiguous-publish" });
    if (!reserved) throw new Error("expected reserved release");
    const cancelled = await service.cancelPublish({
      ref: reserved.ref,
      expectedRevision: reserved.revision,
      actor: ACTOR,
      reason: "registry confirmed no write",
    });
    expect(cancelled).toMatchObject({
      state: "in_review",
      publicationIntent: undefined,
      publicationFailures: [
        expect.objectContaining({ code: "billing/plan-release-publication-cancelled" }),
      ],
    });
  });

  it("keeps failed lifecycle events in the outbox and redelivers them idempotently", async () => {
    let shouldFail = true;
    const delivered: PlanReleaseLifecycleEvent[] = [];
    const eventPublisher: PlanReleaseEventPublisher = {
      async publishIdempotently(event) {
        if (shouldFail) throw new Error("publisher unavailable");
        delivered.push(event);
      },
    };
    const { service, store } = createHarness({ eventPublisher });
    const draft = await service.createDraft({
      definition: createDefinition(),
      actor: ACTOR,
      reason: "create",
    });
    await expect(store.listPendingEvents(draft.ref)).resolves.toHaveLength(1);
    shouldFail = false;
    await expect(service.deliverPendingEvents(draft.ref)).resolves.toEqual({
      attempted: 1,
      published: 1,
      pending: 0,
      failures: [],
    });
    await expect(store.listPendingEvents(draft.ref)).resolves.toEqual([]);
    expect(delivered.map(({ eventId }) => eventId)).toEqual([`plan-release:${draft.ref}:1`]);
  });

  it("replays a double-digit event backlog in numeric revision order", async () => {
    let shouldFail = true;
    const revisions: number[] = [];
    const eventPublisher: PlanReleaseEventPublisher = {
      async publishIdempotently(event) {
        if (shouldFail) throw new Error("publisher unavailable");
        revisions.push(event.revision);
      },
    };
    const { service } = createHarness({ eventPublisher });
    let draft = await service.createDraft({
      definition: createDefinition(),
      actor: ACTOR,
      reason: "revision 1",
    });
    for (let revision = 2; revision <= 10; revision += 1) {
      draft = await service.updateDraft({
        definition: createDefinition({ amount: 9_900 + revision }),
        expectedRevision: draft.revision,
        actor: ACTOR,
        reason: `revision ${revision}`,
      });
    }
    shouldFail = false;
    await service.deliverPendingEvents(draft.ref);
    expect(revisions).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("allows an immutable open-ended published version to gain a future successor", async () => {
    const planRegistry = new InMemoryPlanRegistry();
    await planRegistry.publishPlanVersion(
      createDefinition({ effectiveUntil: undefined, effectiveAt: "2026-01-01T00:00:00.000Z" }),
    );
    const { service } = createHarness({ planRegistry });
    const successor = await reviewDraft(
      service,
      createDefinition({
        ref: planVersionRef("pro@2028-01"),
        versionId: "2028-01",
        effectiveAt: "2028-01-01T00:00:00.000Z",
        effectiveUntil: "2029-01-01T00:00:00.000Z",
        providerBindings: [
          { provider: "polar", productId: "polar-pro-2028", priceIds: ["price-2028"] },
        ],
      }),
    );
    await expect(
      service.publishNow({
        ref: successor.ref,
        expectedRevision: successor.revision,
        actor: ACTOR,
        reason: "publish successor",
        idempotencyKey: "publish-open-ended-successor",
      }),
    ).resolves.toMatchObject({ state: "published" });
    await expect(
      planRegistry.getPlanAtDate("pro", new Date("2028-06-01T00:00:00.000Z")),
    ).resolves.toMatchObject({
      ref: successor.ref,
    });
    await expect(
      planRegistry.getPlanAtDate("pro", new Date("2030-01-01T00:00:00.000Z")),
    ).resolves.toBeNull();
  });
});

describe("createPlanVersionSemanticDiff", () => {
  it("is stable across declaration order and excludes presentation metadata", () => {
    const before = createDefinition();
    const reordered = createDefinition({
      name: "Renamed for presentation only",
      providerBindings: [
        {
          provider: "polar",
          productId: "polar-pro-2027",
          priceIds: ["price-seat", "price-recurring"],
          meterBindings: [{ meterKey: "api.calls", meterId: "polar-api-calls" }],
        },
      ],
      usageTiers: [...(before.usageTiers ?? [])].reverse(),
      entitlements: [...(before.entitlements ?? [])].reverse(),
      quantityPolicy: {
        ...before.quantityPolicy,
        billableMembershipRoles: [...before.quantityPolicy.billableMembershipRoles].reverse(),
      },
    });
    expect(createPlanVersionSemanticDiff(before, reordered)).toEqual([]);

    const changed = createDefinition({
      amount: 12_900,
      seatUnitAmount: 1_500,
      effectiveUntil: "2029-01-01T00:00:00.000Z",
    });
    expect(createPlanVersionSemanticDiff(before, changed).map(({ field }) => field)).toEqual([
      "effective_dates",
      "recurring_price",
      "seat_price",
    ]);
  });

  it("emits the complete semantic field vocabulary in deterministic order", () => {
    const before = createDefinition();
    const after = createDefinition({
      amount: 11_900,
      seatUnitAmount: 2_000,
      effectiveUntil: "2029-01-01T00:00:00.000Z",
      quantityPolicy: {
        ...before.quantityPolicy,
        includedSeats: 5,
        seatQuota: 200,
      },
      usageTiers: [{ meterKey: "api.calls", upTo: null, unitAmount: 3 }],
      entitlements: [{ featureKey: "exports", type: "boolean" }],
      trial: { days: 30, requiresPaymentMethod: false },
      providerBindings: [{ provider: "polar", productId: "polar-pro-v2", priceIds: ["price-v2"] }],
    });

    expect(createPlanVersionSemanticDiff(before, after).map(({ field }) => field)).toEqual([
      "effective_dates",
      "entitlements",
      "provider_binding",
      "quota",
      "recurring_price",
      "seat_inclusion",
      "seat_price",
      "trial",
      "usage_tiers",
    ]);
  });

  it("normalizes valid same-product provider binding permutations", () => {
    const before = createDefinition({
      providerBindings: [
        { provider: "polar", productId: "product", priceIds: ["price-a"] },
        { provider: "polar", productId: "product", priceIds: ["price-b"] },
      ],
    });
    const reordered = createDefinition({
      providerBindings: [...before.providerBindings].reverse(),
    });
    expect(createPlanVersionSemanticDiff(before, reordered)).toEqual([]);
  });
});
