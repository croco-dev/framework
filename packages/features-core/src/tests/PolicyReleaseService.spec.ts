import { describe, expect, it, vi } from "vitest";
import {
  InMemoryPolicyReleaseStore,
  PolicyReleaseService,
  PolicyAuthorizationProblem,
  PolicyIdempotencyConflictProblem,
  PolicyInvalidTransitionProblem,
  PolicyRegistrationMissingProblem,
  PolicyRevisionConflictProblem,
  PolicyStaleReviewProblem,
  PolicyValidationFailedProblem,
} from "../index";
import type { ParameterizedPolicy } from "../index";
const scope = { app: "checkout", environment: "production", tenantId: "tenant-a" };
const actor = { id: "operator" };
const target = { policyId: "limit", scope, actor, reason: "Approved operating limit" };
const policy: ParameterizedPolicy<number> = {
  id: "limit",
  schemaVersion: "1",
  codeRegistrationId: "limit:v1",
  schema: { version: "1", validate: (value) => typeof value === "number" && value >= 0 },
  fieldDescriptors: [
    {
      id: "limit",
      label: "Limit",
      input: "number",
      read: (value) => value,
      write: (_value, next) => next as number,
    },
  ],
  evaluate: (value, context) => Number(context.amount) <= value,
};
function setup() {
  let time = new Date("2026-01-01T00:00:00.000Z");
  const store = new InMemoryPolicyReleaseStore();
  const service = new PolicyReleaseService({ store, clock: { now: () => time } });
  service.registerPolicy(policy);
  return {
    service,
    store,
    advance: () => {
      time = new Date("2026-01-01T01:00:00.000Z");
    },
  };
}
async function reviewed(service: PolicyReleaseService) {
  const draft = await service.createDraft({ ...target, value: 100 });
  return service.review({ ...target, expectedRevision: draft.revision });
}
type TypedContext = { readonly amount: number };
type TypedDecision = { readonly allowed: boolean };
const typedPolicy: ParameterizedPolicy<number, TypedContext, TypedDecision> = {
  ...policy,
  evaluate: (value, context) => ({ allowed: context.amount <= value }),
};

describe("PolicyReleaseService", () => {
  it("registers and evaluates a policy with a typed context and result", async () => {
    const service = new PolicyReleaseService();
    const definition = service.registerPolicy(typedPolicy);
    expect(definition.id).toBe("limit");
    const review = await reviewed(service);
    await service.publish({
      ...target,
      expectedRevision: review.revision,
      reviewHash: review.hash,
      idempotencyKey: "typed",
    });
    const result = await service.evaluate<TypedContext, TypedDecision>({
      ...target,
      context: { amount: 50 },
    });
    expect(result.value?.allowed).toBe(true);
  });
  it("publishes immutable revisions and replays caller commands after time advances", async () => {
    const { service, store, advance } = setup();
    const review = await reviewed(service);
    expect(review.review?.reviewedHash).toBe(review.hash);
    const command = {
      ...target,
      expectedRevision: review.revision,
      reviewHash: review.hash,
      idempotencyKey: "publish-1",
    };
    const published = await service.publish(command);
    advance();
    expect(await service.publish(command)).toEqual(published);
    expect((await store.getRevision(scope, "limit", review.revision))?.state).toBe("reviewed");
    expect(await service.evaluate({ ...target, context: { amount: 50 } })).toMatchObject({
      status: "active",
      value: true,
      version: published.version,
    });
    await expect(service.publish({ ...command, reason: "different" })).rejects.toBeInstanceOf(
      PolicyIdempotencyConflictProblem,
    );
    expect(
      await service.resolve({ policyId: "limit", scope: { ...scope, tenantId: "other" } }),
    ).toMatchObject({ status: "unavailable" });
  });
  it("invalidates review on field edits and rejects stale writes and unreviewed publication", async () => {
    const { service } = setup();
    const review = await reviewed(service);
    const edited = await service.updateDraftField({
      ...target,
      expectedRevision: review.revision,
      descriptorId: "limit",
      value: 200,
    });
    expect(edited).toMatchObject({ state: "draft", value: 200 });
    expect(edited.review).toBeUndefined();
    await expect(
      service.updateDraft({ ...target, expectedRevision: review.revision, value: 300 }),
    ).rejects.toBeInstanceOf(PolicyRevisionConflictProblem);
    await expect(
      service.publish({
        ...target,
        expectedRevision: edited.revision,
        reviewHash: review.hash,
        idempotencyKey: "stale",
      }),
    ).rejects.toBeInstanceOf(PolicyInvalidTransitionProblem);
  });
  it("does not append a revision when atomic publication fails", async () => {
    const { service, store } = setup();
    const review = await reviewed(service);
    store.recordPublication = async () => {
      throw new PolicyRevisionConflictProblem("limit", 2, 3);
    };
    await expect(
      service.publish({
        ...target,
        expectedRevision: review.revision,
        reviewHash: review.hash,
        idempotencyKey: "conflict",
      }),
    ).rejects.toBeInstanceOf(PolicyRevisionConflictProblem);
    expect(await store.list(scope, "limit")).toHaveLength(2);
  });
  it("returns a reasoned unavailable state on pause without a declared fallback", async () => {
    const { service } = setup();
    const review = await reviewed(service);
    const published = await service.publish({
      ...target,
      expectedRevision: review.revision,
      reviewHash: review.hash,
      idempotencyKey: "pub",
    });
    await service.pause({
      ...target,
      expectedRevision: published.revision,
      idempotencyKey: "pause",
      reason: "Incident",
    });
    expect(await service.resolve(target)).toMatchObject({
      status: "unavailable",
      reason: "Incident",
    });
  });
  it("schedules reviewed values, publishes when due and rolls back to an immutable version", async () => {
    const { service, advance } = setup();
    const review = await reviewed(service);
    const scheduled = await service.schedule({
      ...target,
      expectedRevision: review.revision,
      reviewHash: review.hash,
      effectiveAt: "2026-01-01T01:00:00.000Z",
      idempotencyKey: "schedule",
    });
    expect(scheduled.state).toBe("scheduled");
    advance();
    const published = await service.publish({
      ...target,
      expectedRevision: scheduled.revision,
      reviewHash: scheduled.hash,
      idempotencyKey: "due",
    });
    const rolledBack = await service.rollback({
      ...target,
      expectedRevision: published.revision,
      toVersion: published.version,
      idempotencyKey: "rollback",
    });
    expect(rolledBack.rollbackOf).toBe(published.version);
    expect(rolledBack.revision).toBe(published.revision + 1);
    expect(await service.resolve({ ...target, version: published.version })).toMatchObject({
      status: "historical",
      value: 100,
    });
  });
  it("evaluates an explicit pause fallback through the registered policy", async () => {
    const service = new PolicyReleaseService();
    service.registerPolicy({ ...policy, fallback: 0 });
    const review = await reviewed(service);
    const published = await service.publish({
      ...target,
      expectedRevision: review.revision,
      reviewHash: review.hash,
      idempotencyKey: "pub",
    });
    await service.pause({
      ...target,
      expectedRevision: published.revision,
      idempotencyKey: "pause",
    });
    expect(await service.evaluate({ ...target, context: { amount: 50 } })).toMatchObject({
      status: "paused",
      value: false,
    });
  });
  it("rejects values and missing code registrations, and authorizes scope before reads", async () => {
    const { service, store } = setup();
    await expect(service.createDraft({ ...target, value: -1 })).rejects.toBeInstanceOf(
      PolicyValidationFailedProblem,
    );
    await reviewed(service);
    const restarted = new PolicyReleaseService({ store });
    await expect(restarted.resolve(target)).rejects.toBeInstanceOf(
      PolicyRegistrationMissingProblem,
    );
    const denied = new PolicyReleaseService({
      store,
      authorization: { authorize: (request) => request.scope.tenantId !== "tenant-a" },
    });
    denied.registerPolicy(policy);
    await expect(denied.resolve(target)).rejects.toBeInstanceOf(PolicyAuthorizationProblem);
  });
  it("denies field writes before storage and callbacks, and sanitizes callback failures", async () => {
    const store = new InMemoryPolicyReleaseStore();
    const write = vi.fn(() => {
      throw new Error("secret-value");
    });
    const service = new PolicyReleaseService({
      store,
      authorization: { authorize: ({ action }) => action !== "edit" },
    });
    service.registerPolicy({
      ...policy,
      fieldDescriptors: [{ ...policy.fieldDescriptors[0]!, write }],
    });
    const draft = await service.createDraft({ ...target, value: 100 });
    const get = vi.spyOn(store, "get");
    const command = {
      ...target,
      expectedRevision: draft.revision,
      descriptorId: "limit",
      value: 200,
    };
    await expect(service.updateDraftField(command)).rejects.toBeInstanceOf(
      PolicyAuthorizationProblem,
    );
    expect(get).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    const allowed = new PolicyReleaseService({ store });
    allowed.registerPolicy({
      ...policy,
      fieldDescriptors: [{ ...policy.fieldDescriptors[0]!, write }],
    });
    await expect(allowed.updateDraftField(command)).rejects.toThrow("could not be written");
    await expect(allowed.updateDraftField(command)).rejects.not.toThrow("secret-value");
  });

  it("pauses active publication while preserving an editable newer draft and replays receipts", async () => {
    const { service, store, advance } = setup();
    const review = await reviewed(service);
    const published = await service.publish({
      ...target,
      expectedRevision: review.revision,
      reviewHash: review.hash,
      idempotencyKey: "pub",
    });
    const draft = await service.createDraft({ ...target, value: 200 });
    const command = { ...target, expectedRevision: draft.revision, idempotencyKey: "pause" };
    const [paused, concurrent] = await Promise.all([
      service.pause(command),
      service.pause(command),
    ]);
    expect(concurrent).toEqual(paused);
    advance();
    expect(await service.pause(command)).toEqual(paused);
    expect(await service.resolve(target)).toMatchObject({
      status: "unavailable",
      version: paused.version,
    });
    expect(await service.resolve({ ...target, version: published.version })).toMatchObject({
      status: "historical",
      value: 100,
    });
    const retained = await service.getLatestRevision<number>("limit", scope);
    expect(retained).toMatchObject({ state: "draft", value: 200 });
    expect(retained?.history).toEqual(draft.history);
    await expect(
      service.updateDraft({ ...target, expectedRevision: retained!.revision, value: 300 }),
    ).resolves.toMatchObject({ value: 300 });
    expect(await store.findCommandReceipt(scope, "limit", "pause")).toMatchObject({
      status: "paused",
      revision: paused.revision,
    });
    await expect(service.pause({ ...command, reason: "different" })).rejects.toBeInstanceOf(
      PolicyIdempotencyConflictProblem,
    );
    await expect(service.pause({ ...command, fallback: 123 } as typeof command)).rejects.toThrow(
      "declared in code",
    );
  });

  it("resolves historical schemas and evaluates the revision selected by the first resolution", async () => {
    const { service, store } = setup();
    const review = await reviewed(service);
    const published = await service.publish({
      ...target,
      expectedRevision: review.revision,
      reviewHash: review.hash,
      idempotencyKey: "v1",
    });
    service.registerPolicy({
      ...policy,
      schemaVersion: "2",
      codeRegistrationId: "limit:v2",
      schema: { ...policy.schema, version: "2" },
      evaluate: () => "wrong evaluator",
    });
    const draft = await service.createDraft({ ...target, value: 200 });
    expect(draft.schemaVersion).toBe("2");
    const nextReview = await service.review({ ...target, expectedRevision: draft.revision });
    const next = await service.publish({
      ...target,
      expectedRevision: nextReview.revision,
      reviewHash: nextReview.hash,
      idempotencyKey: "v2",
    });
    expect(await service.resolve({ ...target, version: published.version })).toMatchObject({
      status: "historical",
      value: 100,
    });
    expect(await service.evaluate({ ...target, context: { amount: 50 } })).toMatchObject({
      value: "wrong evaluator",
      version: next.version,
    });
    const resolve = vi
      .spyOn(store, "resolve")
      .mockResolvedValueOnce({
        ...target,
        status: "active",
        version: published.version,
        hash: published.hash,
      })
      .mockResolvedValue({ ...target, status: "active", version: next.version, hash: next.hash });
    expect(await service.evaluate({ ...target, context: { amount: 50 } })).toMatchObject({
      value: true,
      version: published.version,
    });
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("requires an independent reviewer for code-declared financial policies", async () => {
    const service = new PolicyReleaseService();
    service.registerPolicy({
      ...policy,
      reviewRequirements: { risk: "financial", independentReviewer: false },
    });
    const review = await reviewed(service);
    await expect(
      service.publish({
        ...target,
        expectedRevision: review.revision,
        reviewHash: review.hash,
        idempotencyKey: "self",
      }),
    ).rejects.toBeInstanceOf(PolicyAuthorizationProblem);
    const edit = await service.updateDraft({
      ...target,
      expectedRevision: review.revision,
      value: 200,
    });
    const independent = await service.review({
      ...target,
      actor: "reviewer",
      expectedRevision: edit.revision,
    });
    await expect(
      service.publish({
        ...target,
        expectedRevision: independent.revision,
        reviewHash: independent.hash,
        idempotencyKey: "approved",
      }),
    ).resolves.toMatchObject({ state: "published" });
  });
  it.each([
    ["tenantId", { app: "checkout", environment: "production" }],
    ["app", { ...scope, app: " " }],
    ["environment", { ...scope, environment: " " }],
    ["tenantId", { ...scope, tenantId: " " }],
  ])("rejects invalid %s scope with a structured diagnostic", async (field, invalidScope) => {
    const { service } = setup();
    await expect(
      service.resolve({ policyId: "limit", scope: invalidScope as typeof scope }),
    ).rejects.toMatchObject({
      code: "features/policy/invalid-definition",
      message: expect.stringContaining(`scope.${field}`),
    });
  });
  it.each(["publish", "schedule", "rollback"] as const)(
    "returns the persisted %s revision for concurrent retries with advancing clock",
    async (action) => {
      let tick = Date.parse("2026-01-01T00:00:00.000Z");
      const store = new InMemoryPolicyReleaseStore();
      const service = new PolicyReleaseService({ store, clock: { now: () => new Date(tick++) } });
      service.registerPolicy(policy);
      const review = await reviewed(service);
      const initial =
        action === "rollback"
          ? await service.publish({
              ...target,
              expectedRevision: review.revision,
              reviewHash: review.hash,
              idempotencyKey: "initial",
            })
          : review;
      let arrivals = 0;
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const record = store.recordPublication.bind(store);
      vi.spyOn(store, "recordPublication").mockImplementation(async (input) => {
        arrivals += 1;
        if (arrivals === 2) release();
        await barrier;
        return record(input);
      });
      const command = {
        ...target,
        expectedRevision: initial.revision,
        reviewHash: initial.hash,
        idempotencyKey: "concurrent",
      };
      const invoke = () =>
        action === "schedule"
          ? service.schedule({ ...command, effectiveAt: "2026-01-02T00:00:00.000Z" })
          : action === "rollback"
            ? service.rollback({ ...command, toVersion: initial.version })
            : service.publish(command);
      const [first, second] = await Promise.all([invoke(), invoke()]);
      expect(second).toEqual(first);
      expect(first).toEqual(await store.getRevision(scope, "limit", first.revision));
    },
  );

  it("resolves historical pauses and rejects future rollback activation", async () => {
    let time = new Date("2026-01-01T00:00:00.000Z");
    const service = new PolicyReleaseService({ clock: { now: () => time } });
    service.registerPolicy(policy);
    const review = await reviewed(service);
    const published = await service.publish({
      ...target,
      expectedRevision: review.revision,
      reviewHash: review.hash,
      idempotencyKey: "initial",
    });
    time = new Date("2026-01-01T01:00:00.000Z");
    const paused = await service.pause({
      ...target,
      expectedRevision: published.revision,
      idempotencyKey: "pause",
    });
    time = new Date("2026-01-01T02:00:00.000Z");
    await expect(
      service.rollback({
        ...target,
        expectedRevision: paused.revision,
        toVersion: published.version,
        idempotencyKey: "future",
        effectiveAt: "2026-01-01T03:00:00.000Z",
      }),
    ).rejects.toThrow("immediately");
    expect(await service.getLatestRevision("limit", scope)).toEqual(paused);
    expect(await service.resolve(target)).toMatchObject({
      status: "unavailable",
      version: paused.version,
    });
    expect(await service.resolve({ ...target, at: "2026-01-01T00:30:00.000Z" })).toMatchObject({
      status: "active",
      version: published.version,
    });
    expect(await service.resolve({ ...target, at: "2026-01-01T01:30:00.000Z" })).toMatchObject({
      status: "unavailable",
      version: paused.version,
    });
    time = new Date("2026-01-01T03:00:00.000Z");
    const rollback = await service.rollback({
      ...target,
      expectedRevision: paused.revision,
      toVersion: published.version,
      idempotencyKey: "immediate",
      effectiveAt: "2026-01-01T00:00:00.000Z",
    });
    expect(await service.resolve(target)).toMatchObject({
      status: "active",
      version: rollback.version,
    });
    expect(await service.resolve({ ...target, at: "2026-01-01T00:30:00.000Z" })).toMatchObject({
      status: "active",
      version: published.version,
    });
    expect(await service.resolve({ ...target, at: "2026-01-01T01:30:00.000Z" })).toMatchObject({
      status: "unavailable",
      version: paused.version,
    });
  });

  it("retains a schema-valid null edit and publishes its reviewed value", async () => {
    const service = new PolicyReleaseService();
    service.registerPolicy<number | null>({
      ...policy,
      semanticDiff: undefined,
      fieldDescriptors: [],
      schema: { version: "1", validate: (value) => value === null || typeof value === "number" },
      evaluate: (value) => value,
    });
    const draft = await service.createDraft({ ...target, value: 100 });
    const edited = await service.updateDraft({
      ...target,
      expectedRevision: draft.revision,
      value: null,
    });
    expect(edited.value).toBeNull();
    const review = await service.review({ ...target, expectedRevision: edited.revision });
    const published = await service.publish({
      ...target,
      expectedRevision: review.revision,
      reviewHash: review.hash,
      idempotencyKey: "nullable",
    });
    expect(published.value).toBeNull();
    expect(await service.evaluate({ ...target, context: {} })).toMatchObject({
      value: null,
      version: published.version,
    });
  });
  it("persists schedule delivery metadata atomically and cancels pending delivery", async () => {
    const { service, store, advance } = setup();
    const review = await reviewed(service);
    const scheduled = await service.schedule({
      ...target,
      expectedRevision: review.revision,
      reviewHash: review.hash,
      idempotencyKey: "schedule-delivery",
      effectiveAt: "2026-01-01T01:00:00.000Z",
    });
    advance();
    const due = await store.listDueSchedules(new Date("2026-01-01T01:00:00.000Z"));
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({
      revision: scheduled.revision,
      reviewHash: review.hash,
      metadata: {
        command: {
          ...target,
          expectedRevision: scheduled.revision,
          reviewHash: review.hash,
          idempotencyKey: "schedule-delivery:publish",
        },
      },
    });
    await service.cancelSchedule({ ...target, expectedRevision: scheduled.revision });
    expect(await store.listDueSchedules(new Date("2026-01-01T01:00:00.000Z"))).toEqual([]);
    expect(await store.getSchedule(due[0]!.id)).toMatchObject({ state: "cancelled" });
  });
  it.each(["publish", "schedule"] as const)(
    "rejects a missing or empty %s review hash before writes",
    async (action) => {
      const { service, store } = setup();
      const review = await reviewed(service);
      const write = vi.spyOn(store, "recordPublication");
      const command = {
        ...target,
        expectedRevision: review.revision,
        idempotencyKey: "missing-hash",
        effectiveAt: action === "publish" ? "2026-01-01T00:00:00.000Z" : "2026-01-01T01:00:00.000Z",
      };
      // @ts-expect-error Exercise an untyped caller omitting the required review hash.
      await expect(service[action](command)).rejects.toBeInstanceOf(PolicyStaleReviewProblem);
      await expect(service[action]({ ...command, reviewHash: "" })).rejects.toBeInstanceOf(
        PolicyStaleReviewProblem,
      );
      expect(write).not.toHaveBeenCalled();
      expect(await store.get(scope, "limit")).toEqual(review);
      expect(await store.findCommandReceipt(scope, "limit", command.idempotencyKey)).toBeNull();
      expect(await store.listDueSchedules(new Date("2026-01-02T00:00:00.000Z"))).toEqual([]);
    },
  );
});
