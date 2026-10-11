import { describe, expect, it, vi } from "vitest";
import { SavedIntentOperations } from "../libs/SavedIntentOperations";
import type { SavedIntentService, SavedIntentPolicy } from "@croco/experience-core";

const scope = { appId: "reports", environment: "test", tenantId: "tenant-a" };
const subject = { kind: "user", id: "private-user" };
const access = {
  scope,
  principal: { verified: true },
  actorId: "operator",
  permissions: ["saved-intent.read", "saved-intent.write", "saved-intent.inspect"] as const,
};
const policy: SavedIntentPolicy = {
  scope,
  resourceType: "report",
  displayLimit: 5,
  retentionDays: 30,
  excludeCompleted: true,
  revision: 1,
  actorId: "operator",
  reason: "Initial policy",
  updatedAt: "2026-10-05T00:00:00Z",
};
function setup() {
  const service: SavedIntentService = {
    saveIntent: vi.fn(),
    removeIntent: vi.fn(),
    markCompleted: vi.fn(),
    pinIntent: vi.fn(),
    readPolicy: vi.fn(async () => policy),
    updatePolicy: vi.fn(async () => policy),
    listResumeCandidates: vi.fn(async () => ({ candidates: [], exclusions: [] })),
    resolveIntent: vi.fn(),
    readIntent: vi.fn(),
    purgeRetention: vi.fn(),
    deleteSubject: vi.fn(),
  };
  return { service, operations: new SavedIntentOperations(service) };
}
describe("SavedIntentOperations", () => {
  it("blocks read/write/inspect before touching storage when permissions are absent", async () => {
    const { service, operations } = setup();
    const denied = { ...access, permissions: [] };
    await expect(operations.readPolicy("report", subject, denied)).rejects.toMatchObject({
      code: "saved-intent/admin-denied",
    });
    await expect(operations.inspect(subject, denied)).rejects.toMatchObject({
      code: "saved-intent/admin-denied",
    });
    await expect(
      operations.updatePolicy(
        { ...policy, subject, expectedRevision: 1, idempotencyKey: "command" },
        denied,
      ),
    ).rejects.toMatchObject({ code: "saved-intent/admin-denied" });
    expect(service.readPolicy).not.toHaveBeenCalled();
    expect(service.listResumeCandidates).not.toHaveBeenCalled();
    expect(service.updatePolicy).not.toHaveBeenCalled();
  });
  it("rejects cross-tenant writes and always uses verified operator principal and actor", async () => {
    const { service, operations } = setup();
    const input = { ...policy, subject, expectedRevision: 1, idempotencyKey: "command" };
    await expect(
      operations.updatePolicy({ ...input, scope: { ...scope, tenantId: "other" } }, access),
    ).rejects.toThrow();
    await operations.updatePolicy(input, access);
    expect(service.updatePolicy).toHaveBeenCalledWith({
      ...input,
      principal: access.principal,
      actorId: access.actorId,
    });
  });
  it("keeps private labels, URLs, resource ids, progress and subjects out of the console response", async () => {
    const { service, operations } = setup();
    const enrichedExclusion = {
      scope,
      subject,
      resourceId: "private-report",
      label: "Private title",
      safeUrl: "/private/url",
      progressRef: "private-progress",
      intentId: "removed",
      resourceType: "report",
      reason: "removed" as const,
    };
    vi.mocked(service.listResumeCandidates).mockResolvedValue({
      candidates: [
        {
          intent: {
            id: "intent",
            scope,
            subject,
            resourceType: "report",
            resourceId: "private-report",
            sourceKind: "explicit",
            progressRef: "private-progress",
            state: "saved",
            revision: 1,
            savedAt: policy.updatedAt,
            lastUsedAt: policy.updatedAt,
            updatedAt: policy.updatedAt,
          },
          availability: "available",
          label: "Private title",
          safeUrl: "/private/url",
          rankReason: "recent",
        },
      ],
      exclusions: [enrichedExclusion],
      nextOffset: 5,
    });
    const result = await operations.inspect(subject, access, { offset: 0, limit: 5 });
    expect(result).toEqual({
      rows: [
        {
          intentId: "intent",
          resourceType: "report",
          availability: "available",
          rankReason: "recent",
        },
      ],
      exclusions: [{ intentId: "removed", resourceType: "report", reason: "removed" }],
      nextOffset: 5,
    });
    expect(service.listResumeCandidates).toHaveBeenCalledWith({
      scope,
      subject,
      principal: access.principal,
      offset: 0,
      limit: 5,
      includeExclusions: true,
    });
  });
  it("propagates authorization/provider failures instead of returning an empty inspection", async () => {
    const { service, operations } = setup();
    vi.mocked(service.listResumeCandidates).mockRejectedValue(new Error("provider unavailable"));
    await expect(operations.inspect(subject, access)).rejects.toThrow("provider unavailable");
  });
});
