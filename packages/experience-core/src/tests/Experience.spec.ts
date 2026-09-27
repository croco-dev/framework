import { PublishedCohortReader, cohortContentHash } from "@croco/cohort-core";
import { describe, expect, it, vi } from "vitest";
import type { CohortSnapshot } from "@croco/cohort-core";
import {
  ExperienceInvalidProblem,
  definePlacement,
  evaluatePlacement,
  previewPlacement,
  validateExperienceConfig,
} from "../index";
import type {
  ExperienceConfig,
  ExperienceReceiptInput,
  ExperienceReserveInput,
  ExperienceSaveInput,
  ExperienceScope,
  ExperienceStore,
  StoredExperienceDecision,
} from "../index";

const scope: ExperienceScope = { appId: "app", environment: "test", tenantId: "tenant" };
const placement = definePlacement({
  id: "checkout.assurance",
  schema: {
    contextFields: { plan: "string" },
    content: {
      locales: ["en", "fr"],
      maxTitleLength: 120,
      maxBodyLength: 1000,
      allowActionUrl: true,
    },
  },
  allowedRenderers: ["banner"],
});
const now = new Date("2026-09-28T00:00:00.000Z");
const config: ExperienceConfig = {
  id: "assurance-a",
  placementId: placement.id,
  scope,
  revision: 1,
  status: "published",
  renderer: "banner",
  content: { locale: "en", title: "Secure checkout", body: "Your payment is protected." },
  targeting: { context: [{ field: "plan", operator: "eq", value: "paid" }] },
  priority: 10,
};

class TestStore implements ExperienceStore {
  readonly receipts = new Map<string, StoredExperienceDecision>();
  readonly exposures = new Set<string>();
  configs: readonly ExperienceConfig[] = [];
  reservations = 0;
  async listConfigs(): Promise<readonly ExperienceConfig[]> {
    return this.configs;
  }
  async saveConfig(input: ExperienceSaveInput): Promise<ExperienceConfig> {
    return input.config;
  }
  async reserve(input: ExperienceReserveInput): Promise<boolean> {
    this.reservations += 1;
    this.receipts.set(input.receipt.decision.decisionId, input.receipt);
    return true;
  }
  async readDecision(
    _scope: ExperienceScope,
    decisionId: string,
  ): Promise<StoredExperienceDecision | undefined> {
    return this.receipts.get(decisionId);
  }
  async recordExposure(input: ExperienceReceiptInput): Promise<"recorded" | "duplicate"> {
    const receipt = this.receipts.get(input.handle.decisionId);
    if (
      !receipt ||
      receipt.handle.token !== input.handle.token ||
      receipt.handle.exposureId !== input.handle.exposureId ||
      receipt.decision.subject.id !== input.subject.id ||
      receipt.decision.scope.tenantId !== input.scope.tenantId
    )
      throw new ExperienceInvalidProblem("Invalid receipt");
    if (this.exposures.has(input.handle.exposureId)) return "duplicate";
    this.exposures.add(input.handle.exposureId);
    return "recorded";
  }
  async dismiss(): Promise<void> {}
}

describe("Experience", () => {
  it("selects one candidate by priority and stable id and only reserves before display", async () => {
    const store = new TestStore();
    store.configs = [{ ...config, id: "assurance-z" }, config];
    const evaluated = await evaluatePlacement({
      placement,
      scope,
      subject: { kind: "user", id: "u1" },
      context: { plan: "paid" },
      store,
      now,
    });
    expect(evaluated.reason).toBe("selected");
    if (evaluated.reason !== "selected") return;
    expect(evaluated.decision.configId).toBe("assurance-a");
    expect(store.reservations).toBe(1);
    expect(store.exposures.size).toBe(0);
    const receipt = {
      scope,
      subject: { kind: "user", id: "u1" },
      handle: evaluated.exposureHandle,
      at: now.toISOString(),
    };
    expect(await store.recordExposure(receipt)).toBe("recorded");
    expect(await store.recordExposure(receipt)).toBe("duplicate");
    expect(store.exposures.size).toBe(1);
    const again = await evaluatePlacement({
      placement,
      scope,
      subject: { kind: "user", id: "u1" },
      context: { plan: "paid" },
      store,
      now,
    });
    expect(again.reason).toBe("selected");
    if (again.reason === "selected")
      expect(again.exposureHandle.exposureId).not.toBe(evaluated.exposureHandle.exposureId);
  });

  it("skips an invalid stored candidate but reports unavailable when no valid candidate serves", async () => {
    const store = new TestStore();
    const invalid = {
      ...config,
      id: "invalid-high",
      priority: 20,
      content: { ...config.content, locale: "de" },
    };
    const onUnavailable = vi.fn();
    const onInvalidStoredConfig = vi.fn();
    const input = {
      placement,
      scope,
      subject: { kind: "user", id: "u1" },
      context: { plan: "paid" },
      store,
      now,
      onUnavailable,
      onInvalidStoredConfig,
    };
    store.configs = [invalid, config];
    const selected = await evaluatePlacement(input);
    expect(selected.reason).toBe("selected");
    if (selected.reason === "selected") expect(selected.decision.configId).toBe(config.id);
    expect(onUnavailable).not.toHaveBeenCalled();
    expect(onInvalidStoredConfig).toHaveBeenCalledExactlyOnceWith(
      invalid.id,
      expect.any(ExperienceInvalidProblem),
    );

    const unobserved = await evaluatePlacement({ ...input, onInvalidStoredConfig: undefined });
    expect(unobserved.reason).toBe("unavailable");
    expect(onUnavailable).toHaveBeenCalledExactlyOnceWith(expect.any(ExperienceInvalidProblem));
    onUnavailable.mockClear();

    store.configs = [invalid];
    expect((await evaluatePlacement(input)).reason).toBe("unavailable");
    expect(onUnavailable).toHaveBeenCalledExactlyOnceWith(expect.any(ExperienceInvalidProblem));
    expect(onInvalidStoredConfig).toHaveBeenCalledTimes(2);
  });

  it("rejects unexpected fields, markup, URL schemes, and context types", async () => {
    expect(() =>
      definePlacement({
        ...placement,
        schema: { ...placement.schema, content: { ...placement.schema.content, locales: [] } },
      }),
    ).toThrow(ExperienceInvalidProblem);
    expect(() =>
      validateExperienceConfig(
        { ...config, content: { ...config.content, title: "x".repeat(121) } },
        placement,
        scope,
      ),
    ).toThrow(ExperienceInvalidProblem);
    expect(() =>
      validateExperienceConfig(
        { ...config, content: { ...config.content, actionUrl: "javascript:alert(1)" } },
        placement,
        scope,
      ),
    ).toThrow(ExperienceInvalidProblem);
    expect(() =>
      validateExperienceConfig(
        { ...config, content: { ...config.content, body: "<script>bad</script>" } },
        placement,
        scope,
      ),
    ).toThrow(ExperienceInvalidProblem);
    expect(() =>
      validateExperienceConfig(
        { ...config, content: { ...config.content, arbitrary: "bad" } } as ExperienceConfig,
        placement,
        scope,
      ),
    ).toThrow(ExperienceInvalidProblem);
    const store = new TestStore();
    await expect(
      evaluatePlacement({
        placement,
        scope,
        subject: { kind: "user", id: "u1" },
        context: { plan: 1 },
        store,
        now,
      }),
    ).rejects.toThrow(ExperienceInvalidProblem);
  });

  it("serves only the requested locale and gives preview the same exact-match behavior", async () => {
    const store = new TestStore();
    const french = {
      ...config,
      id: "assurance-fr",
      content: { ...config.content, locale: "fr" },
      priority: 20,
    };
    store.configs = [french, config];
    const input = {
      placement,
      scope,
      subject: { kind: "user", id: "u1" },
      context: { plan: "paid" },
      store,
      now,
    };
    const english = await evaluatePlacement({ ...input, locale: "en" });
    expect(english.reason).toBe("selected");
    if (english.reason === "selected") expect(english.decision.configId).toBe(config.id);
    const frenchResult = await evaluatePlacement({ ...input, locale: "fr" });
    expect(frenchResult.reason).toBe("selected");
    if (frenchResult.reason === "selected") expect(frenchResult.decision.configId).toBe(french.id);
    expect((await evaluatePlacement({ ...input, locale: "de" })).reason).toBe("no_match");
    expect((await previewPlacement({ ...input, config, locale: "fr" })).matched).toBe(false);
    expect((await previewPlacement({ ...input, config, locale: "en" })).matched).toBe(true);
    await expect(evaluatePlacement({ ...input, locale: "EN_us" })).rejects.toThrow(
      ExperienceInvalidProblem,
    );
  });

  it("uses the canonical cohort reader and distinguishes unavailable snapshots", async () => {
    const snapshot: CohortSnapshot = {
      snapshotId: "snapshot-1",
      scope,
      subjectKind: "user",
      definitionId: "buyers",
      definitionVersion: 1,
      schemaVersion: 1,
      sourceSnapshotRefs: ["source-1"],
      asOf: "2026-09-27T00:00:00.000Z",
      generatedAt: "2026-09-27T01:00:00.000Z",
      validUntil: "2026-09-29T00:00:00.000Z",
      contentHash: cohortContentHash(["u1"]),
      publicationRevision: 1,
      privacyVersion: "p1",
      membershipRef: "members-1",
    };
    let withdrawn = false;
    const reader = new PublishedCohortReader(
      { read: async () => ({ snapshot, subjectIds: ["u1"], withdrawn }) },
      { currentVersion: async () => "p1", isAllowed: async () => true },
    );
    const targeted = { ...config, targeting: { cohortSnapshotId: "snapshot-1" } };
    const store = new TestStore();
    store.configs = [targeted];
    const input = {
      placement,
      scope,
      subject: { kind: "user", id: "u1" },
      context: { plan: "paid" },
      store,
      cohortReader: reader,
      now,
    };
    const selected = await evaluatePlacement(input);
    expect(selected.reason).toBe("selected");
    if (selected.reason === "selected")
      expect(selected.decision.sourceSnapshotRef?.snapshotId).toBe("snapshot-1");
    withdrawn = true;
    const onUnavailable = vi.fn();
    expect((await evaluatePlacement({ ...input, onUnavailable })).reason).toBe("unavailable");
    expect(onUnavailable).toHaveBeenCalledOnce();
    expect(onUnavailable.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(store.reservations).toBe(1);
    await expect(previewPlacement({ ...input, config: targeted })).rejects.toThrow();

    const unavailableCases = [
      {
        name: "expired",
        publication: {
          snapshot: { ...snapshot, validUntil: now.toISOString() },
          subjectIds: ["u1"],
          withdrawn: false,
        },
        privacyVersion: "p1",
      },
      {
        name: "withdrawn",
        publication: { snapshot, subjectIds: ["u1"], withdrawn: true },
        privacyVersion: "p1",
      },
      {
        name: "privacy changed",
        publication: { snapshot, subjectIds: ["u1"], withdrawn: false },
        privacyVersion: "p2",
      },
      {
        name: "schema changed",
        publication: {
          snapshot: { ...snapshot, schemaVersion: 2 as unknown as 1 },
          subjectIds: ["u1"],
          withdrawn: false,
        },
        privacyVersion: "p1",
      },
    ];
    for (const testCase of unavailableCases) {
      const unavailableReader = new PublishedCohortReader(
        { read: async () => testCase.publication },
        { currentVersion: async () => testCase.privacyVersion, isAllowed: async () => true },
      );
      expect(
        (await evaluatePlacement({ ...input, cohortReader: unavailableReader })).reason,
        testCase.name,
      ).toBe("unavailable");
    }
    expect(store.reservations).toBe(1);
  });

  it("pins earlier decisions when rollback publishes a new cohort snapshot", async () => {
    const base: CohortSnapshot = {
      snapshotId: "cohort-v1",
      scope,
      subjectKind: "user",
      definitionId: "buyers",
      definitionVersion: 1,
      schemaVersion: 1,
      sourceSnapshotRefs: ["source-v1"],
      asOf: "2026-09-27T00:00:00.000Z",
      generatedAt: "2026-09-27T01:00:00.000Z",
      validUntil: "2026-09-29T00:00:00.000Z",
      contentHash: cohortContentHash(["u1"]),
      publicationRevision: 1,
      privacyVersion: "p1",
      membershipRef: "members-v1",
    };
    const publications = new Map([
      ["cohort-v1", { snapshot: base, subjectIds: ["u1"], withdrawn: false }],
      [
        "cohort-v2",
        {
          snapshot: {
            ...base,
            snapshotId: "cohort-v2",
            publicationRevision: 2,
            membershipRef: "members-v2",
          },
          subjectIds: ["u1"],
          withdrawn: false,
        },
      ],
      [
        "cohort-rollback",
        {
          snapshot: {
            ...base,
            snapshotId: "cohort-rollback",
            publicationRevision: 3,
            membershipRef: "members-v3",
          },
          subjectIds: ["u1"],
          withdrawn: false,
        },
      ],
    ]);
    let allowed = true;
    let privacyUnavailable = false;
    const reader = new PublishedCohortReader(
      { read: async (id) => publications.get(id) },
      {
        currentVersion: async () => {
          if (privacyUnavailable) throw new Error("privacy provider unavailable");
          return "p1";
        },
        isAllowed: async () => allowed,
      },
    );
    const store = new TestStore();
    const input = {
      placement,
      scope,
      subject: { kind: "user", id: "u1" },
      context: { plan: "paid" },
      store,
      cohortReader: reader,
      now,
    };
    store.configs = [{ ...config, targeting: { cohortSnapshotId: "cohort-v1" } }];
    const first = await evaluatePlacement(input);
    expect(first.reason).toBe("selected");
    store.configs = [
      {
        ...config,
        revision: 2,
        content: { ...config.content, title: "New copy" },
        targeting: { cohortSnapshotId: "cohort-v2" },
      },
    ];
    const second = await evaluatePlacement(input);
    expect(second.reason).toBe("selected");
    store.configs = [
      { ...config, revision: 3, targeting: { cohortSnapshotId: "cohort-rollback" } },
    ];
    const rollback = await evaluatePlacement(input);
    expect(rollback.reason).toBe("selected");
    if (
      first.reason !== "selected" ||
      second.reason !== "selected" ||
      rollback.reason !== "selected"
    )
      return;
    expect(first.decision.sourceSnapshotRef?.snapshotId).toBe("cohort-v1");
    expect(second.decision.sourceSnapshotRef?.snapshotId).toBe("cohort-v2");
    expect(rollback.decision.sourceSnapshotRef?.publicationRevision).toBe(3);
    expect(
      (await store.readDecision(scope, first.decision.decisionId))?.decision.content.title,
    ).toBe(config.content.title);
    allowed = false;
    expect((await evaluatePlacement(input)).reason).toBe("no_match");
    privacyUnavailable = true;
    expect((await evaluatePlacement(input)).reason).toBe("unavailable");
  });
});
