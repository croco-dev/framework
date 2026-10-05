import { describe, expect, it, vi } from "vitest";
import {
  createSavedIntentService,
  SavedIntentDeniedProblem,
  SavedIntentInvalidProblem,
  validateSavedIntentUrl,
} from "../libs/savedIntent";
import type {
  SavedIntent,
  SavedIntentAuthorization,
  SavedIntentStore,
} from "../libs/savedIntentContracts";

const access = {
  scope: { appId: "app", environment: "test", tenantId: "tenant" },
  subject: { kind: "user", id: "a" },
  principal: { verified: true },
};
const now = "2026-10-05T00:00:00.000Z";
function intent(overrides: Partial<SavedIntent> = {}): SavedIntent {
  return {
    id: "i",
    scope: access.scope,
    subject: access.subject,
    resourceType: "report",
    resourceId: "r",
    sourceKind: "explicit",
    state: "saved",
    revision: 1,
    savedAt: now,
    lastUsedAt: now,
    updatedAt: now,
    progressRef: "private-progress",
    ...overrides,
  };
}
function fixture(items: readonly SavedIntent[] = []) {
  const store: SavedIntentStore = {
    mutate: vi.fn(async (command) =>
      intent({
        ...command,
        revision: 2,
        state: "saved",
        savedAt: command.now,
        lastUsedAt: command.now,
        updatedAt: command.now,
        pinOrder: command.pinOrder ?? undefined,
      }),
    ),
    list: vi.fn(async () => items),
    readPolicy: vi.fn(async () => undefined),
    updatePolicy: vi.fn(async (input) => input.policy),
    deleteSubject: vi.fn(async () => {}),
    purgeExpired: vi.fn(async () => {}),
  };
  const authorize = vi.fn<SavedIntentAuthorization>(async () => true);
  const resolver = vi.fn(async () => ({
    availability: "available" as const,
    label: "Report",
    safeUrl: "/reports/r",
  }));
  const resourceTypes = [
    {
      id: "report",
      resolver,
      allowedOrigins: ["https://app.example"],
      defaultPolicy: { displayLimit: 100, retentionDays: 30, excludeCompleted: true },
    },
  ];
  const service = createSavedIntentService({
    store,
    resourceTypes,
    authorize,
    now: () => now,
    id: () => "new-id",
  });
  return { service, store, authorize, resolver };
}
describe("Saved Intent server service", () => {
  it("authorizes every operation before invoking persistence", async () => {
    const { service, store, authorize } = fixture();
    authorize.mockResolvedValue(false);
    await expect(service.listResumeCandidates(access)).rejects.toBeInstanceOf(
      SavedIntentDeniedProblem,
    );
    await expect(
      service.saveIntent({
        ...access,
        resourceType: "report",
        resourceId: "r",
        sourceKind: "explicit",
        expectedRevision: null,
        idempotencyKey: "k",
      }),
    ).rejects.toBeInstanceOf(SavedIntentDeniedProblem);
    await expect(service.readPolicy({ ...access, resourceType: "report" })).rejects.toBeInstanceOf(
      SavedIntentDeniedProblem,
    );
    await expect(service.deleteSubject(access)).rejects.toBeInstanceOf(SavedIntentDeniedProblem);
    await expect(service.purgeRetention(access)).rejects.toBeInstanceOf(SavedIntentDeniedProblem);
    expect(store.list).not.toHaveBeenCalled();
    expect(store.mutate).not.toHaveBeenCalled();
    expect(store.deleteSubject).not.toHaveBeenCalled();
    expect(store.purgeExpired).not.toHaveBeenCalled();
  });
  it("deduplicates explicit ahead of recent globally, then orders pins, recency and stable ids before pagination", async () => {
    const { service } = fixture([
      intent({ id: "recent", sourceKind: "recent", pinOrder: 0 }),
      intent({ id: "explicit" }),
      intent({ id: "z", resourceId: "z", pinOrder: 2 }),
      intent({ id: "a", resourceId: "a" }),
    ]);
    const first = await service.listResumeCandidates({
      ...access,
      limit: 1,
      includeExclusions: true,
    });
    expect(first.candidates.map((row) => row.intent.id)).toEqual(["z"]);
    expect(first.nextOffset).toBe(1);
    expect(first.exclusions).toContainEqual({
      intentId: "recent",
      resourceType: "report",
      reason: "duplicate",
    });
    const second = await service.listResumeCandidates({ ...access, offset: 1 });
    expect(second.candidates.map((row) => row.intent.id)).toEqual(["a", "explicit"]);
  });
  it("requires inspect authorization to reveal excluded intent identifiers", async () => {
    const { service, authorize } = fixture([intent({ state: "removed" })]);
    expect((await service.listResumeCandidates(access)).exclusions).toEqual([]);
    authorize.mockImplementation(async (input) => input.action !== "inspect");
    await expect(
      service.listResumeCandidates({ ...access, includeExclusions: true }),
    ).rejects.toBeInstanceOf(SavedIntentDeniedProblem);
  });
  it("redacts progress and display metadata when current source access is revoked", async () => {
    const { service, resolver } = fixture([intent()]);
    resolver.mockResolvedValue({ availability: "denied" } as never);
    const result = await service.listResumeCandidates(access);
    expect(result.candidates[0]).toEqual({
      intent: expect.not.objectContaining({ progressRef: expect.anything() }),
      availability: "denied",
      rankReason: "recent",
    });
    expect(resolver).toHaveBeenCalledWith(
      expect.objectContaining({
        principal: access.principal,
        subject: access.subject,
        scope: access.scope,
      }),
    );
  });
  it("rechecks current authorization and resolver on navigation", async () => {
    const { service, resolver } = fixture([intent()]);
    await service.listResumeCandidates(access);
    resolver.mockResolvedValue({ availability: "deleted" } as never);
    const result = await service.resolveIntent({
      ...access,
      resourceType: "report",
      resourceId: "r",
      sourceKind: "explicit",
    });
    expect(result.availability).toBe("deleted");
    expect(result.safeUrl).toBeUndefined();
    expect(result.intent.progressRef).toBeUndefined();
    expect(resolver).toHaveBeenCalledTimes(2);
  });
  it("excludes completed, removed and expired records and purges using each policy retention cutoff", async () => {
    const { service, store, resolver } = fixture([
      intent({ state: "removed" }),
      intent({ id: "c", resourceId: "c", state: "completed" }),
      intent({ id: "old", resourceId: "old", lastUsedAt: "2025-01-01T00:00:00.000Z" }),
    ]);
    const result = await service.listResumeCandidates({ ...access, includeExclusions: true });
    expect(result.candidates).toEqual([]);
    expect(result.exclusions.map((item) => item.reason).sort()).toEqual([
      "completed",
      "removed",
      "retention",
    ]);
    expect(resolver).not.toHaveBeenCalled();
    await service.purgeRetention(access);
    expect(store.purgeExpired).toHaveBeenCalledWith({
      scope: access.scope,
      subject: access.subject,
      resourceType: "report",
      before: "2026-09-05T00:00:00.000Z",
    });
  });
  it("passes semantic mutations to the atomic store without retaining principal or metadata", async () => {
    const { service, store } = fixture();
    await service.saveIntent({
      ...access,
      resourceType: "report",
      resourceId: "r",
      sourceKind: "recent",
      progressRef: "p",
      expectedRevision: 3,
      idempotencyKey: "retry",
    });
    expect(store.mutate).toHaveBeenCalledWith({
      scope: access.scope,
      subject: access.subject,
      resourceType: "report",
      resourceId: "r",
      sourceKind: "recent",
      progressRef: "p",
      expectedRevision: 3,
      idempotencyKey: "retry",
      operation: "save",
      id: "new-id",
      now,
    });
  });
  it("fails invalid keys, scopes, pagination and declarations before persistence", async () => {
    const { service, store } = fixture();
    await expect(service.listResumeCandidates({ ...access, limit: 101 })).rejects.toBeInstanceOf(
      SavedIntentInvalidProblem,
    );
    await expect(
      service.listResumeCandidates({ ...access, scope: { ...access.scope, tenantId: "" } }),
    ).rejects.toBeInstanceOf(SavedIntentInvalidProblem);
    await expect(
      service.listResumeCandidates({ ...access, unknown: true } as never),
    ).rejects.toBeInstanceOf(SavedIntentInvalidProblem);
    await expect(
      service.saveIntent({
        ...access,
        resourceType: "unknown",
        resourceId: "r",
        sourceKind: "recent",
        expectedRevision: null,
        idempotencyKey: "k",
      }),
    ).rejects.toBeInstanceOf(SavedIntentInvalidProblem);
    expect(store.list).not.toHaveBeenCalled();
  });
  it("preserves operator policy audit fields and authorizes the claimed actor", async () => {
    const { service, store, authorize } = fixture();
    await service.updatePolicy({
      ...access,
      resourceType: "report",
      displayLimit: 5,
      retentionDays: 7,
      excludeCompleted: false,
      expectedRevision: null,
      idempotencyKey: "policy-retry",
      actorId: "operator",
      reason: "Shorten retention",
    });
    expect(authorize).toHaveBeenCalledWith({
      ...access,
      action: "policy:write",
      actorId: "operator",
    });
    expect(store.updatePolicy).toHaveBeenCalledWith({
      expectedRevision: null,
      idempotencyKey: "policy-retry",
      policy: {
        scope: access.scope,
        resourceType: "report",
        displayLimit: 5,
        retentionDays: 7,
        excludeCompleted: false,
        revision: 1,
        actorId: "operator",
        reason: "Shorten retention",
        updatedAt: now,
      },
    });
  });
  it("refuses a silently truncated subject and missing pin order", async () => {
    const { service } = fixture(
      Array.from({ length: 10001 }, (_, index) => intent({ id: String(index) })),
    );
    await expect(service.listResumeCandidates(access)).rejects.toBeInstanceOf(
      SavedIntentInvalidProblem,
    );
    await expect(
      service.pinIntent({
        ...access,
        resourceType: "report",
        resourceId: "r",
        sourceKind: "explicit",
        expectedRevision: 1,
        idempotencyKey: "pin",
      } as never),
    ).rejects.toBeInstanceOf(SavedIntentInvalidProblem);
  });
  it("applies a global display cap before paging", async () => {
    const { service, store } = fixture([intent({ id: "a" }), intent({ id: "b", resourceId: "b" })]);
    vi.mocked(store.readPolicy).mockResolvedValue({
      scope: access.scope,
      resourceType: "report",
      displayLimit: 1,
      retentionDays: 30,
      excludeCompleted: true,
      revision: 1,
      actorId: "operator",
      reason: "Cap",
      updatedAt: now,
    });
    const page = await service.listResumeCandidates({
      ...access,
      limit: 1,
      includeExclusions: true,
    });
    expect(page.candidates.map((row) => row.intent.id)).toEqual(["a"]);
    expect(page.nextOffset).toBeUndefined();
    expect(page.exclusions).toContainEqual({
      intentId: "b",
      resourceType: "report",
      reason: "display-limit",
    });
    expect(
      (await service.listResumeCandidates({ ...access, offset: 1, limit: 1 })).candidates,
    ).toEqual([]);
  });
  it("returns redacted tombstone revisions for an explicit restore command", async () => {
    const { service, authorize, resolver } = fixture([intent({ state: "removed", revision: 5 })]);
    const result = await service.readIntent({
      ...access,
      resourceType: "report",
      resourceId: "r",
      sourceKind: "explicit",
    });
    expect(result?.revision).toBe(5);
    expect(result?.state).toBe("removed");
    expect(result?.progressRef).toBeUndefined();
    expect(authorize).toHaveBeenCalledWith({ ...access, action: "read" });
    expect(resolver).not.toHaveBeenCalled();
  });
  it("expires at the retention boundary and resolves it without cached progress", async () => {
    const { service, resolver } = fixture([intent({ lastUsedAt: "2026-09-05T00:00:00.000Z" })]);
    expect((await service.listResumeCandidates(access)).candidates).toEqual([]);
    const result = await service.resolveIntent({
      ...access,
      resourceType: "report",
      resourceId: "r",
      sourceKind: "explicit",
    });
    expect(result.availability).toBe("expired");
    expect(result.intent.progressRef).toBeUndefined();
    expect(resolver).not.toHaveBeenCalled();
  });
  it("captures declarations so later caller mutation cannot expand trusted URL origins", async () => {
    const { store } = fixture([intent()]);
    const allowedOrigins = ["https://app.example"];
    const definition = {
      id: "report",
      allowedOrigins,
      resolver: async () => ({
        availability: "available" as const,
        label: "Report",
        safeUrl: "https://evil.example/r",
      }),
      defaultPolicy: { displayLimit: 5, retentionDays: 30, excludeCompleted: true },
    };
    const service = createSavedIntentService({
      store,
      resourceTypes: [definition],
      authorize: async () => true,
      now: () => now,
    });
    allowedOrigins.push("https://evil.example");
    definition.defaultPolicy.displayLimit = 0;
    await expect(service.listResumeCandidates(access)).rejects.toBeInstanceOf(
      SavedIntentInvalidProblem,
    );
  });
  it("paginates exclusion-only inspection without duplicating diagnostics", async () => {
    const { service } = fixture([
      intent({ id: "a", state: "removed" }),
      intent({ id: "b", resourceId: "b", state: "removed" }),
      intent({ id: "c", resourceId: "c", state: "removed" }),
    ]);
    const first = await service.listResumeCandidates({
      ...access,
      includeExclusions: true,
      limit: 1,
    });
    const second = await service.listResumeCandidates({
      ...access,
      includeExclusions: true,
      limit: 1,
      offset: first.nextOffset,
    });
    const third = await service.listResumeCandidates({
      ...access,
      includeExclusions: true,
      limit: 1,
      offset: second.nextOffset,
    });
    expect(first.candidates).toEqual([]);
    expect(first.nextOffset).toBe(1);
    expect(second.nextOffset).toBe(2);
    expect(third.nextOffset).toBeUndefined();
    expect(
      [first, second, third].map((page) => page.exclusions.map((row) => row.intentId)),
    ).toEqual([["a"], ["b"], ["c"]]);
    const customer = await service.listResumeCandidates({ ...access, limit: 1 });
    expect(customer.exclusions).toEqual([]);
    expect(customer.nextOffset).toBeUndefined();
  });
  it("paginates candidates and exclusions in parallel until both lists finish", async () => {
    const { service } = fixture([
      intent({ id: "a" }),
      intent({ id: "b", resourceId: "b" }),
      intent({ id: "c", resourceId: "c", state: "removed" }),
    ]);
    const first = await service.listResumeCandidates({
      ...access,
      includeExclusions: true,
      limit: 1,
    });
    const second = await service.listResumeCandidates({
      ...access,
      includeExclusions: true,
      limit: 1,
      offset: first.nextOffset,
    });
    expect(first.candidates.map((row) => row.intent.id)).toEqual(["a"]);
    expect(first.exclusions.map((row) => row.intentId)).toEqual(["c"]);
    expect(first.nextOffset).toBe(1);
    expect(second.candidates.map((row) => row.intent.id)).toEqual(["b"]);
    expect(second.exclusions).toEqual([]);
    expect(second.nextOffset).toBeUndefined();
  });
  it("keeps a fresh recent candidate when its explicit counterpart reaches exact retention expiry", async () => {
    const recent = intent({ id: "recent", sourceKind: "recent" });
    const expired = intent({ id: "explicit", lastUsedAt: "2026-09-05T00:00:00.000Z" });
    const { service, store } = fixture([expired, recent]);
    const page = await service.listResumeCandidates({ ...access, includeExclusions: true });
    expect(page.candidates.map((row) => row.intent.id)).toEqual(["recent"]);
    expect(page.exclusions).toEqual([
      { intentId: "explicit", resourceType: "report", reason: "retention" },
    ]);
    vi.mocked(store.list).mockResolvedValue([recent]);
    expect((await service.listResumeCandidates(access)).candidates).toEqual(page.candidates);
    vi.mocked(store.list).mockResolvedValue([
      { ...expired, lastUsedAt: "2026-09-05T00:00:00.001Z" },
      recent,
    ]);
    expect(
      (await service.listResumeCandidates(access)).candidates.map((row) => row.intent.id),
    ).toEqual(["explicit"]);
  });
  it.each(["denied", "expired"] as const)(
    "redacts historical progress from all mutation receipts when source is %s",
    async (availability) => {
      const { service, store, resolver } = fixture();
      resolver.mockResolvedValue({ availability } as never);
      vi.mocked(store.mutate).mockResolvedValue(
        intent({ progressRef: "historical-private-progress" }),
      );
      const command = {
        ...access,
        resourceType: "report",
        resourceId: "r",
        sourceKind: "explicit" as const,
        expectedRevision: 1,
        idempotencyKey: "retry",
      };
      const results = await Promise.all([
        service.saveIntent(command),
        service.saveIntent(command),
        service.pinIntent({ ...command, pinOrder: 0 }),
        service.markCompleted(command),
        service.removeIntent(command),
      ]);
      expect(results).toHaveLength(5);
      for (const result of results) {
        expect(result.progressRef).toBeUndefined();
        expect(result.id).toBe("i");
        expect(result.revision).toBe(1);
      }
      expect(resolver).not.toHaveBeenCalled();
    },
  );
  it("preserves provider failures and rejects unsafe resolver URLs", async () => {
    const { service, store, resolver } = fixture([intent()]);
    resolver.mockResolvedValue({
      availability: "available",
      label: "bad",
      safeUrl: "https://evil.example/path",
    });
    await expect(service.listResumeCandidates(access)).rejects.toBeInstanceOf(
      SavedIntentInvalidProblem,
    );
    const failure = new SavedIntentInvalidProblem("provider failed");
    vi.mocked(store.list).mockRejectedValue(failure);
    await expect(service.listResumeCandidates(access)).rejects.toBe(failure);
  });
});
describe("Saved Intent URL boundary", () => {
  it.each([
    "//evil.example",
    "/\\evil.example",
    "/%5cevil.example",
    "/%252fevil.example",
    "/%0aevil",
    "javascript:alert(1)",
    "http://app.example/a",
    "https://user@app.example/a",
    "https://evil.example/a",
  ])("rejects %s", (value) => {
    expect(() => validateSavedIntentUrl(value, ["https://app.example"])).toThrow(
      SavedIntentInvalidProblem,
    );
  });
  it("accepts local paths and server allowlisted HTTPS origins", () => {
    expect(validateSavedIntentUrl("/reports/a?view=1", [])).toBe("/reports/a?view=1");
    expect(validateSavedIntentUrl("https://app.example/reports/a", ["https://app.example"])).toBe(
      "https://app.example/reports/a",
    );
  });
});
