import { describe, expect, it, vi } from "vitest";
import {
  ExperimentRuntime,
  InMemoryExperimentStore,
  experimentBucket,
  experimentHash,
  experimentAssignmentKey,
  resolveExperimentSubject,
} from "../index";
import type {
  DetailedEvaluation,
  ExperimentDefinition,
  ExperimentInput,
  ExperimentRegistration,
} from "../index";

const scope = { app: "shop", environment: "test", tenantId: "tenant-a" };
const definition: ExperimentDefinition = {
  id: "checkout",
  revision: "1",
  unit: "user",
  loginPolicy: "preserve-unit",
  salt: "immutable-salt",
  allocatorVersion: "sha256-v1",
  allocation: 10000,
  variants: [
    { id: "control", value: false, weight: 5000 },
    { id: "treatment", value: true, weight: 5000 },
  ],
  hypothesis: "Faster checkout",
  observationPlan: "completed purchases",
  eligibility: "all",
};
const input: ExperimentInput = {
  experimentId: definition.id,
  experimentRevision: "1",
  scope,
  actor: "server",
  subject: { kind: "user", id: "user-1" },
};
const transition = {
  ...input,
  expectedRevision: 0,
  reason: "approved rollout",
  idempotencyKey: "start",
};
async function fixture(overrides: Partial<ExperimentRegistration> = {}) {
  const store = new InMemoryExperimentStore();
  const runtime = new ExperimentRuntime({
    store,
    authorization: { authorize: () => true },
    clock: { now: () => new Date("2026-10-01T00:00:00Z") },
  });
  const handlers = { control: vi.fn(() => false), treatment: vi.fn(() => true) };
  await runtime.register(
    { definition, handlers, eligibility: () => ({ status: "eligible" }), ...overrides },
    scope,
    "operator",
  );
  return { runtime, store, handlers };
}

describe("ExperimentRuntime", () => {
  it("locks allocator golden vectors and unambiguous key encoding", () => {
    expect(
      ["user-1", "user-2", "a:b", "한글"].map((id) =>
        experimentBucket(definition, scope, { kind: "user", id }),
      ),
    ).toEqual([7060, 7235, 5399, 8053]);
    expect(
      experimentBucket({ ...definition, salt: "a:b" }, scope, { kind: "user", id: "c" }),
    ).not.toBe(experimentBucket({ ...definition, salt: "a" }, scope, { kind: "user", id: "b:c" }));
  });
  it("returns one stored winner under concurrent retries and across runtime instances", async () => {
    const { runtime, store } = await fixture();
    await runtime.start(transition);
    const results = await Promise.all(Array.from({ length: 20 }, () => runtime.assign(input)));
    expect(
      new Set(
        results.map((result) => (result.status === "assigned" ? result.assignment.id : "failed")),
      ).size,
    ).toBe(1);
    const second = new ExperimentRuntime({ store, authorization: { authorize: () => true } });
    await second.register(
      {
        definition,
        handlers: { control: () => false, treatment: () => true },
        eligibility: () => ({ status: "eligible" }),
      },
      scope,
      "operator",
    );
    expect(await second.assign(input)).toEqual(results[0]);
  });
  it("preserves actual false, and never turns unavailable into control", async () => {
    const { runtime } = await fixture({
      definition: {
        ...definition,
        variants: [
          { id: "control", value: false, weight: 10000 },
          { id: "treatment", value: true, weight: 0 },
        ],
      },
    });
    await runtime.start(transition);
    expect(await runtime.evaluateDetailed(input)).toMatchObject({
      status: "evaluated",
      value: false,
    });
    const unavailable = await fixture({
      provider: {
        evaluateDetailed: async () => ({ status: "unavailable", reason: "metadata_missing" }),
      },
    });
    await unavailable.runtime.start(transition);
    expect(await unavailable.runtime.assign(input)).toEqual({
      status: "unavailable",
      reason: "metadata_missing",
    });
  });
  it("requires stable identity and preserves or switches login identity without merging", async () => {
    const { runtime } = await fixture();
    await runtime.start(transition);
    expect(await runtime.assign({ ...input, subject: { kind: "user", id: "" } })).toMatchObject({
      status: "not_assigned",
    });
    expect(
      resolveExperimentSubject(
        { unit: "anonymous", loginPolicy: "preserve-unit" },
        { anonymousId: "browser-1", userId: "user-1" },
      ),
    ).toEqual({ kind: "anonymous", id: "browser-1" });
    expect(
      resolveExperimentSubject(
        { unit: "anonymous", loginPolicy: "switch-unit" },
        { anonymousId: "browser-1", userId: "user-1" },
      ),
    ).toEqual({ kind: "user", id: "user-1" });
    expect(
      resolveExperimentSubject(
        { unit: "anonymous", loginPolicy: "preserve-unit" },
        { userId: "user-1" },
      ),
    ).toBeNull();
    expect(
      resolveExperimentSubject(
        { unit: "anonymous", loginPolicy: "switch-unit" },
        { anonymousId: "browser-1" },
      ),
    ).toEqual({ kind: "anonymous", id: "browser-1" });
  });
  it("reports unsupported provider preview without invoking assignment or handlers", async () => {
    const provider = { evaluateDetailed: vi.fn() };
    const { runtime, store, handlers } = await fixture({ provider });
    const before = await store.list(scope);
    expect(await runtime.preview(input)).toEqual({
      status: "unavailable",
      reason: "provider_preview_unsupported",
    });
    expect(await store.list(scope)).toEqual(before);
    expect(provider.evaluateDetailed).not.toHaveBeenCalled();
    expect(handlers.control).not.toHaveBeenCalled();
    expect(handlers.treatment).not.toHaveBeenCalled();
  });
  it("serializes pause against in-flight assignment and rejects new treatment", async () => {
    let release: (() => void) | undefined;
    let entered: (() => void) | undefined;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { runtime } = await fixture({
      eligibility: async () => {
        entered?.();
        await barrier;
        return { status: "eligible" };
      },
    });
    await runtime.start(transition);
    const pending = runtime.assign(input);
    await ready;
    await runtime.pause({ ...transition, expectedRevision: 1, idempotencyKey: "pause" });
    release?.();
    expect(await pending).toEqual({ status: "not_assigned", reason: "experiment_inactive" });
  });
  it("dedupes retransmission, counts separate deliveries, and accepts late exposures after pause", async () => {
    const { runtime } = await fixture();
    await runtime.start(transition);
    const result = await runtime.assign(input);
    if (result.status !== "assigned") throw new Error("Expected assignment");
    const exposure = {
      ...input,
      assignmentId: result.assignment.id,
      deliveryInstanceId: "screen-1",
      occurredAt: "2026-10-01T00:00:00Z",
      kind: "display" as const,
    };
    const first = await runtime.recordExposure(exposure);
    expect(await runtime.recordExposure(exposure)).toEqual(first);
    expect(
      (await runtime.recordExposure({ ...exposure, deliveryInstanceId: "screen-2" })).id,
    ).not.toBe(first.id);
    await runtime.pause({ ...transition, expectedRevision: 1, idempotencyKey: "pause" });
    expect(await runtime.treat({ ...input, assignmentId: result.assignment.id })).toEqual({
      status: "not_assigned",
      reason: "experiment_inactive",
    });
    expect(await runtime.recordExposure(exposure)).toEqual(first);
    await expect(runtime.recordExposure({ ...exposure, kind: "treatment" })).rejects.toThrow(
      "different exposure",
    );
    await expect(
      runtime.recordExposure({ ...exposure, subject: { kind: "user", id: "other" } }),
    ).rejects.toThrow("ownership");
    await expect(
      runtime.recordExposure({ ...exposure, scope: { ...scope, tenantId: "other" } }),
    ).rejects.toThrow("ownership");
    await expect(runtime.recordExposure({ ...exposure, assignmentId: "forged" })).rejects.toThrow(
      "does not exist",
    );
  });
  it("rechecks current eligibility without redrawing or reclassifying historical exposure", async () => {
    let allowed = true;
    const { runtime, store } = await fixture({
      eligibility: () =>
        allowed ? { status: "eligible" } : { status: "unavailable", reason: "withdrawn" },
    });
    await runtime.start(transition);
    const result = await runtime.assign(input);
    if (result.status !== "assigned") throw new Error("Expected assignment");
    allowed = false;
    expect(await runtime.assign(input)).toEqual({ status: "unavailable", reason: "withdrawn" });
    expect(await runtime.treat({ ...input, assignmentId: result.assignment.id })).toEqual({
      status: "not_assigned",
      reason: "withdrawn",
    });
    expect(await store.getAssignment(result.assignment.id)).toEqual(result.assignment);
    expect(
      await runtime.recordExposure({
        ...input,
        assignmentId: result.assignment.id,
        deliveryInstanceId: "late",
        occurredAt: "2026-10-01T00:00:00Z",
        kind: "display",
      }),
    ).toMatchObject({ assignmentId: result.assignment.id });
  });
  it("makes commands optimistic, authorized, audited, idempotent and stopped terminal", async () => {
    const { runtime } = await fixture();
    const receipt = await runtime.start(transition);
    expect(receipt.command.actor).toBe("server");
    expect(await runtime.start(transition)).toEqual(receipt);
    await expect(runtime.start({ ...transition, reason: "changed" })).rejects.toThrow(
      "different payload",
    );
    await expect(runtime.pause({ ...transition, idempotencyKey: "pause" })).rejects.toThrow(
      "version changed",
    );
    await runtime.stop({ ...transition, expectedRevision: 1, idempotencyKey: "stop" });
    await expect(
      runtime.start({ ...transition, expectedRevision: 2, idempotencyKey: "restart" }),
    ).rejects.toThrow("transition");
    const denied = new ExperimentRuntime({
      store: new InMemoryExperimentStore(),
      authorization: { authorize: () => false },
    });
    await expect(denied.list(scope, "actor")).rejects.toThrow("not authorized");
  });
  it("configures immutable revisions using registered handlers and predicates only", async () => {
    const { runtime } = await fixture();
    await runtime.start(transition);
    const configure = {
      ...transition,
      action: "configure" as const,
      expectedRevision: 1,
      idempotencyKey: "configure",
      definition: {
        ...definition,
        revision: "2",
        allocation: 2000,
        variants: definition.variants.map((variant) => ({ ...variant, weight: 1000 })),
      },
    };
    const receipt = await runtime.configure(configure);
    expect(receipt.record).toMatchObject({ state: "draft", version: 0, experimentRevision: "2" });
    expect(await runtime.configure(configure)).toEqual(receipt);
    expect(await runtime.get(input, "actor")).toMatchObject({
      state: "running",
      definition: { allocation: 10000 },
    });
    await expect(runtime.configure({ ...configure, reason: "changed" })).rejects.toThrow(
      "different payload",
    );
    await expect(
      runtime.configure({
        ...configure,
        definition: { ...configure.definition, eligibility: "unregistered" },
      }),
    ).rejects.toThrow("not registered");
    await expect(
      runtime.configure({
        ...configure,
        definition: {
          ...configure.definition,
          variants: [{ id: "forged", value: "injected", weight: 2000 }],
        },
      }),
    ).rejects.toThrow("unregistered variants");
  });
  it("restores configured revisions and original assignment after restart", async () => {
    const { runtime, store } = await fixture();
    const configured = { ...definition, revision: "2" };
    await runtime.configure({ ...transition, action: "configure", definition: configured });
    await runtime.start({ ...transition, experimentRevision: "2" });
    const assigned = await runtime.assign({ ...input, experimentRevision: "2" });
    const restarted = new ExperimentRuntime({ store, authorization: { authorize: () => true } });
    await restarted.register(
      {
        definition,
        eligibility: () => ({ status: "eligible" }),
        handlers: { control: () => false, treatment: () => true },
      },
      scope,
      "operator",
    );
    await restarted.restore(input, "operator");
    expect(await restarted.assign({ ...input, experimentRevision: "2" })).toEqual(assigned);
  });
  it("uses separate login assignments and recovers the anonymous assignment on logout", async () => {
    const anonymous = {
      ...definition,
      unit: "anonymous" as const,
      loginPolicy: "switch-unit" as const,
    };
    const { runtime } = await fixture({ definition: anonymous });
    await runtime.start(transition);
    const guest = resolveExperimentSubject(anonymous, { anonymousId: "browser-1" });
    const loggedIn = resolveExperimentSubject(anonymous, {
      anonymousId: "browser-1",
      userId: "user-1",
    });
    if (!guest || !loggedIn) throw new Error("Expected stable identity");
    const first = await runtime.assign({ ...input, subject: guest });
    const second = await runtime.assign({ ...input, subject: loggedIn });
    expect(first.status).toBe("assigned");
    expect(second.status).toBe("assigned");
    expect(second).not.toEqual(first);
    expect(await runtime.assign({ ...input, subject: guest })).toEqual(first);
  });
  it("fails provider drift, unverified revisions, and provider exceptions explicitly", async () => {
    for (const [provider, reason, status] of [
      [
        {
          evaluateDetailed: async () => ({
            status: "evaluated" as const,
            value: false,
            reason: "sdk",
          }),
        },
        "provider_revision_unverified",
        "unavailable",
      ],
      [
        {
          evaluateDetailed: async () => ({
            status: "evaluated" as const,
            value: "foreign",
            reason: "sdk",
            providerMetadata: { appRevision: "1" },
          }),
        },
        "provider_variant_drift",
        "unavailable",
      ],
      [
        {
          evaluateDetailed: async () => {
            throw new Error("down");
          },
        },
        "provider_failure",
        "evaluation_failed",
      ],
    ] as const) {
      const { runtime } = await fixture({ provider });
      await runtime.start(transition);
      expect(await runtime.assign(input)).toEqual({ status, reason });
    }
  });
  it("never enters allocation zero through an external provider", async () => {
    const provider = {
      evaluateDetailed: vi.fn(async () => ({
        status: "evaluated" as const,
        value: false,
        reason: "sdk",
        providerMetadata: { appRevision: "1" },
      })),
    };
    const { runtime } = await fixture({
      definition: {
        ...definition,
        allocation: 0,
        variants: definition.variants.map((variant) => ({ ...variant, weight: 0 })),
      },
      provider,
    });
    await runtime.start(transition);
    expect(await runtime.assign(input)).toEqual({
      status: "not_assigned",
      reason: "outside_allocation",
    });
    expect(provider.evaluateDetailed).not.toHaveBeenCalled();
  });
  it("keeps predicates scoped to each experiment when restoring stored revisions", async () => {
    const { runtime } = await fixture();
    await runtime.register(
      {
        definition: { ...definition, id: "other" },
        handlers: { control: () => false, treatment: () => true },
        eligibility: () => ({ status: "ineligible", reason: "other_experiment" }),
      },
      scope,
      "operator",
    );
    await runtime.restore(input, "operator");
    await runtime.start(transition);
    expect((await runtime.assign(input)).status).toBe("assigned");
  });
  it("previews the provider value without writes and assigns the same value", async () => {
    const result = {
      status: "evaluated" as const,
      value: false,
      reason: "provider_preview",
      providerMetadata: { appRevision: "1" },
    };
    const provider = {
      previewDetailed: vi.fn(async () => result),
      evaluateDetailed: vi.fn(async () => result),
    };
    const { runtime, store, handlers } = await fixture({ provider });
    const assign = vi.spyOn(store, "assign");
    const expose = vi.spyOn(store, "recordExposure");
    const before = await store.list(scope);
    expect(experimentBucket(definition, scope, input.subject)).toBeGreaterThan(5000);
    expect(await runtime.preview(input)).toEqual(result);
    expect(await store.list(scope)).toEqual(before);
    expect(await store.getAssignment(experimentAssignmentKey(input, input.subject))).toBeNull();
    expect(assign).not.toHaveBeenCalled();
    expect(expose).not.toHaveBeenCalled();
    expect(provider.evaluateDetailed).not.toHaveBeenCalled();
    expect(handlers.control).not.toHaveBeenCalled();
    expect(handlers.treatment).not.toHaveBeenCalled();
    await runtime.start(transition);
    expect(await runtime.assign(input)).toMatchObject({
      status: "assigned",
      assignment: { value: false },
    });
  });
  it.each([
    [
      { status: "unavailable", reason: "offline" },
      { status: "unavailable", reason: "offline" },
    ],
    [
      { status: "evaluated", value: false, reason: "sdk" },
      { status: "unavailable", reason: "provider_revision_unverified" },
    ],
    [
      {
        status: "evaluated",
        value: false,
        reason: "sdk",
        providerMetadata: { appRevision: "other" },
      },
      { status: "unavailable", reason: "provider_revision_unverified" },
    ],
    [
      {
        status: "evaluated",
        value: "foreign",
        reason: "sdk",
        providerMetadata: { appRevision: "1" },
      },
      { status: "unavailable", reason: "provider_variant_drift" },
    ],
  ] satisfies [DetailedEvaluation, DetailedEvaluation][])(
    "preserves provider preview failures: %j",
    async (result, expected) => {
      const { runtime, store } = await fixture({
        provider: { previewDetailed: async () => result, evaluateDetailed: vi.fn() },
      });
      expect(await runtime.preview(input)).toEqual(expected);
      expect(await store.getAssignment(experimentAssignmentKey(input, input.subject))).toBeNull();
    },
  );
  it("reports preview provider exceptions explicitly", async () => {
    const { runtime } = await fixture({
      provider: {
        previewDetailed: async () => {
          throw new Error("offline");
        },
        evaluateDetailed: vi.fn(),
      },
    });
    expect(await runtime.preview(input)).toEqual({
      status: "evaluation_failed",
      reason: "provider_failure",
    });
  });
  it("rejects disabled provider variants in preview and assignment", async () => {
    const evaluate = async (): Promise<DetailedEvaluation> => ({
      status: "evaluated",
      value: true,
      reason: "sdk",
      providerMetadata: { appRevision: "1" },
    });
    const { runtime, store } = await fixture({
      definition: {
        ...definition,
        variants: definition.variants.map((variant) => ({
          ...variant,
          weight: variant.id === "control" ? 10000 : 0,
        })),
      },
      provider: { previewDetailed: evaluate, evaluateDetailed: evaluate },
    });
    await runtime.start(transition);
    const expected = { status: "unavailable", reason: "provider_variant_drift" };
    expect(await runtime.preview(input)).toEqual(expected);
    expect(await runtime.assign(input)).toEqual(expected);
    expect(await store.getAssignment(experimentAssignmentKey(input, input.subject))).toBeNull();
  });
  it("binds a peer-configured revision for concurrent assignment, treatment, and commands", async () => {
    const { runtime, store } = await fixture();
    const peer = new ExperimentRuntime({ store, authorization: { authorize: () => true } });
    const handlers = { control: vi.fn(() => false), treatment: vi.fn(() => true) };
    await peer.register(
      { definition, handlers, eligibility: () => ({ status: "eligible" }) },
      scope,
      "operator",
    );
    const next = { ...input, experimentRevision: "2" };
    await runtime.configure({
      ...transition,
      action: "configure",
      definition: { ...definition, revision: "2" },
    });
    await runtime.start({ ...transition, experimentRevision: "2" });
    const results = await Promise.all([runtime.assign(next), peer.assign(next)]);
    expect(results[0].status).toBe("assigned");
    expect(results[1]).toEqual(results[0]);
    const assigned = results[0];
    if (assigned.status !== "assigned") throw new Error("Expected assignment");
    expect(await peer.treat({ ...next, assignmentId: assigned.assignment.id })).toEqual({
      status: "treated",
      value: assigned.assignment.value,
    });
    expect(handlers[assigned.assignment.variant as keyof typeof handlers]).toHaveBeenCalledTimes(1);
    await runtime.configure({
      ...transition,
      action: "configure",
      expectedRevision: 0,
      idempotencyKey: "third",
      definition: { ...definition, revision: "3" },
    });
    expect((await peer.start({ ...transition, experimentRevision: "3" })).record.state).toBe(
      "running",
    );
  });
  it.each(["salt", "variant", "predicate", "hash", "scope", "unknown"])(
    "rejects untrusted persisted revision: %s",
    async (mismatch) => {
      const { runtime, store } = await fixture();
      const nextDefinition = {
        ...definition,
        revision: "2",
        ...(mismatch === "salt" ? { salt: "different" } : {}),
        ...(mismatch === "variant"
          ? { variants: [{ id: "foreign", value: "foreign", weight: 10000 }] }
          : {}),
        ...(mismatch === "predicate" ? { eligibility: "unknown" } : {}),
      };
      const next = {
        ...input,
        experimentRevision: "2",
        ...(mismatch === "unknown" ? { experimentId: "unknown" } : {}),
      };
      const record = {
        ...next,
        codeRevision: definition.revision,
        definition: nextDefinition,
        definitionHash: mismatch === "hash" ? "bad" : experimentHash(nextDefinition),
        state: "running" as const,
        version: 1,
        ...(mismatch === "scope" ? { scope: { ...scope, tenantId: "other" } } : {}),
      };
      vi.spyOn(store, "get").mockResolvedValue(record);
      const assign = vi.spyOn(store, "assign");
      await expect(runtime.assign(next)).rejects.toThrow();
      expect(assign).not.toHaveBeenCalled();
    },
  );
  it.each([false, true])(
    "keeps configured handlers bound to the exact code template (different variants: %s)",
    async (differentVariants) => {
      const store = new InMemoryExperimentStore();
      const makeRuntime = () =>
        new ExperimentRuntime({ store, authorization: { authorize: () => true } });
      const first = makeRuntime();
      const peer = makeRuntime();
      const secondDefinition = {
        ...definition,
        revision: "code-2",
        ...(differentVariants
          ? { variants: [{ id: "new-control", value: "second", weight: 10000 }] }
          : {}),
      };
      const registerTemplates = async (runtime: ExperimentRuntime) => {
        await runtime.register(
          {
            definition,
            handlers: { control: () => "first-code", treatment: () => "first-code" },
            eligibility: () => ({ status: "eligible" }),
          },
          scope,
          "operator",
        );
        await runtime.register(
          {
            definition: secondDefinition,
            handlers: Object.fromEntries(
              secondDefinition.variants.map((variant) => [variant.id, () => "second-code"]),
            ),
            eligibility: () => ({ status: "eligible" }),
          },
          scope,
          "operator",
        );
      };
      await registerTemplates(first);
      await registerTemplates(peer);
      await first.configure({
        ...transition,
        experimentRevision: "code-2",
        action: "configure",
        definition: { ...secondDefinition, revision: "configured-3" },
      });
      await first.start({ ...transition, experimentRevision: "configured-3" });
      const next = { ...input, experimentRevision: "configured-3" };
      const assigned = await first.assign(next);
      if (assigned.status !== "assigned") throw new Error("Expected assignment");
      expect(await peer.treat({ ...next, assignmentId: assigned.assignment.id })).toEqual({
        status: "treated",
        value: "second-code",
      });
      expect(await peer.assign(next)).toEqual(assigned);
      expect((await peer.get(next, "operator"))?.codeRevision).toBe("code-2");
      await peer.configure({
        ...transition,
        experimentRevision: "configured-3",
        idempotencyKey: "cascade",
        expectedRevision: 1,
        action: "configure",
        definition: { ...secondDefinition, revision: "configured-4" },
      });
      const cascaded = { ...input, experimentRevision: "configured-4" };
      await first.start({ ...transition, experimentRevision: "configured-4" });
      const cascadeAssignment = await first.assign(cascaded);
      if (cascadeAssignment.status !== "assigned") throw new Error("Expected assignment");
      const restarted = makeRuntime();
      await registerTemplates(restarted);
      expect(
        (await restarted.restore(input, "operator")).map((record) => record.experimentRevision),
      ).toEqual(["1"]);
      expect(
        (await restarted.restore({ ...input, experimentRevision: "code-2" }, "operator")).map(
          (record) => record.experimentRevision,
        ),
      ).toEqual(["code-2", "configured-3", "configured-4"]);
      expect(
        await restarted.treat({ ...cascaded, assignmentId: cascadeAssignment.assignment.id }),
      ).toEqual({ status: "treated", value: "second-code" });
      expect((await restarted.get(cascaded, "operator"))?.codeRevision).toBe("code-2");
      const missingTemplate = makeRuntime();
      await missingTemplate.register(
        {
          definition,
          handlers: { control: () => "first-code", treatment: () => "first-code" },
          eligibility: () => ({ status: "eligible" }),
        },
        scope,
        "operator",
      );
      await expect(missingTemplate.assign(next)).rejects.toThrow(
        "code registration is unavailable",
      );
      await expect(
        missingTemplate.register(
          {
            definition: { ...secondDefinition, revision: "configured-3" },
            handlers: Object.fromEntries(
              secondDefinition.variants.map((variant) => [variant.id, () => "wrong-code"]),
            ),
            eligibility: () => ({ status: "eligible" }),
          },
          scope,
          "operator",
        ),
      ).rejects.toThrow("immutable");
    },
  );
  it("preserves the predicate belonging to each code template", async () => {
    const { runtime, store } = await fixture();
    await runtime.register(
      {
        definition: { ...definition, revision: "code-2" },
        handlers: { control: () => false, treatment: () => true },
        eligibility: () => ({ status: "ineligible", reason: "second-template" }),
      },
      scope,
      "operator",
    );
    await runtime.configure({
      ...transition,
      action: "configure",
      definition: { ...definition, revision: "configured-1" },
    });
    await runtime.start({ ...transition, experimentRevision: "configured-1" });
    expect((await runtime.assign({ ...input, experimentRevision: "configured-1" })).status).toBe(
      "assigned",
    );
    const record = await store.get({ ...input, experimentRevision: "configured-1" });
    expect(record?.codeRevision).toBe("1");
  });
});
