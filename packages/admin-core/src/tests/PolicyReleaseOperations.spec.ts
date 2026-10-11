import { PolicyReleaseService } from "@croco/features-core";
import { describe, expect, it, vi } from "vitest";
import {
  PolicyReleaseOperations,
  assertPolicyReleaseAccess,
  PolicyReleaseAccessProblem,
} from "../libs/PolicyReleaseOperations";
import type { PolicyReleaseAccess } from "../libs/PolicyReleaseOperations";

const access: PolicyReleaseAccess = {
  scope: { app: "shop", environment: "test", tenantId: "one" },
  actor: { id: "operator" },
  permissions: ["policy.read", "policy.write"],
};
describe("PolicyReleaseOperations authorization", () => {
  it("checks read/write permissions before scoped operations", () => {
    expect(() => assertPolicyReleaseAccess(access, access.scope, "policy.read")).not.toThrow();
    expect(() => assertPolicyReleaseAccess(access, access.scope, "policy.publish")).toThrow(
      PolicyReleaseAccessProblem,
    );
    expect(() =>
      assertPolicyReleaseAccess({ ...access, actor: { id: " " } }, access.scope, "policy.read"),
    ).toThrow(PolicyReleaseAccessProblem);
  });
  it("rejects cross-tenant, cross-app and cross-environment reads", () => {
    for (const scope of [
      { ...access.scope, tenantId: "two" },
      { ...access.scope, app: "other" },
      { ...access.scope, environment: "production" },
    ]) {
      expect(() => assertPolicyReleaseAccess(access, scope, "policy.read")).toThrow(
        PolicyReleaseAccessProblem,
      );
    }
  });
  it("does not interpret omitted tenant as global authority", () => {
    expect(() =>
      // @ts-expect-error Untrusted requests can omit the required tenant scope.
      assertPolicyReleaseAccess(access, { app: "shop", environment: "test" }, "policy.read"),
    ).toThrow(PolicyReleaseAccessProblem);
    expect(() =>
      assertPolicyReleaseAccess(access, { ...access.scope, tenantId: null }, "policy.read"),
    ).toThrow(PolicyReleaseAccessProblem);
    const global = { ...access, scope: { ...access.scope, tenantId: null } };
    expect(() => assertPolicyReleaseAccess(global, global.scope, "policy.read")).not.toThrow();
  });
});

function serviceFixture() {
  const revision = {
    policyId: "banner",
    schemaVersion: "1",
    revision: 3,
    state: "reviewed",
    value: { title: "Hello", secret: "do-not-expose" },
    review: {
      reviewedHash: "review-3",
      validation: { diagnostics: [{ code: "LIMIT", path: "limit", message: "do-not-expose" }] },
      semanticDiff: [
        { field: "value", before: { secret: "old-secret" }, after: { secret: "do-not-expose" } },
      ],
    },
  };
  const service = {
    getLatestRevision: vi.fn().mockResolvedValue(revision),
    getCommandReceipt: vi
      .fn()
      .mockImplementation((_id, _scope, key) =>
        Promise.resolve({ idempotencyKey: key, revision: 3, status: "published" }),
      ),
    getRegistration: vi.fn().mockReturnValue({
      fieldDescriptors: [
        {
          id: "title",
          label: "Title",
          input: "text",
          read: (value: { title: string }) => value.title,
        },
        {
          id: "secret",
          label: "Secret",
          input: "text",
          sensitive: true,
          read: (value: { secret: string }) => value.secret,
        },
      ],
    }),
    updateDraftField: vi.fn().mockResolvedValue(revision),
    review: vi.fn().mockResolvedValue(revision),
    publish: vi.fn().mockResolvedValue({
      ...revision,
      state: "published",
      publication: { idempotencyKey: "command-1" },
    }),
    schedule: vi.fn().mockResolvedValue({ ...revision, state: "scheduled" }),
  };
  return {
    service,
    operations: new PolicyReleaseOperations(service as unknown as PolicyReleaseService),
  };
}
const command = {
  policyId: "banner",
  scope: access.scope,
  expectedRevision: 3,
  reason: "Update banner",
  idempotencyKey: "command-1",
};
const operator = {
  ...access,
  permissions: ["policy.read", "policy.write", "policy.review", "policy.publish"] as const,
};

describe("PolicyReleaseOperations service boundary", () => {
  it("rejects reads and writes before touching the service", async () => {
    const { service, operations } = serviceFixture();
    await expect(
      operations.read({ ...command, scope: { ...access.scope, tenantId: "two" } }, access),
    ).rejects.toThrow(PolicyReleaseAccessProblem);
    await expect(
      operations.publish({ ...command, reviewHash: "review-3" }, access),
    ).rejects.toThrow(PolicyReleaseAccessProblem);
    expect(service.getLatestRevision).not.toHaveBeenCalled();
    expect(service.publish).not.toHaveBeenCalled();
  });
  it("projects bounded reads without secret values, raw diagnostic input, or diff leaks", async () => {
    const { operations } = serviceFixture();
    const result = await operations.read(command, access);
    expect(result?.fields[0]?.value).toBe("Hello");
    expect(result?.fields[1]?.value).toBeNull();
    expect(result?.diff[0]?.after).toBe("[redacted]");
    expect(JSON.stringify(result)).not.toContain("do-not-expose");
    expect(result?.impact.map(({ kind }) => kind)).toEqual(["fact", "insufficient-data"]);
  });
  it("restores the publication receipt on a later read", async () => {
    const { service, operations } = serviceFixture();
    const revision = await service.getLatestRevision();
    service.getLatestRevision.mockResolvedValue({
      ...revision,
      state: "published",
      publication: { idempotencyKey: "persisted-command" },
    });
    expect((await operations.read(command, access))?.receipt?.id).toBe("persisted-command");
  });
  it("rejects absent or changed code registration before projecting a revision", async () => {
    const { service, operations } = serviceFixture();
    service.getRegistration.mockReturnValue(null);
    await expect(operations.read(command, access)).rejects.toThrow(PolicyReleaseAccessProblem);
    service.getRegistration.mockReturnValue({
      codeRegistrationId: "different-code",
      fieldDescriptors: [],
    });
    await expect(operations.read(command, access)).rejects.toThrow(PolicyReleaseAccessProblem);
  });
  it("uses the authenticated actor and preserves revision, reason, and command identity", async () => {
    const { service, operations } = serviceFixture();
    await operations.edit({ ...command, field: "title", value: "New" }, operator);
    expect(service.updateDraftField).toHaveBeenCalledWith({
      policyId: command.policyId,
      scope: command.scope,
      expectedRevision: command.expectedRevision,
      reason: command.reason,
      descriptorId: "title",
      value: "New",
      actor: operator.actor,
    });
    await operations.review(command, operator);
    expect(service.review).toHaveBeenCalledWith({ ...command, actor: operator.actor });
    const receipt = await operations.publish({ ...command, reviewHash: "review-3" }, operator);
    expect(receipt.receipt).toEqual({ id: "command-1", revision: 3, status: "published" });
    const effectiveAt = "2026-10-01T12:00:00.000Z";
    await operations.publish({ ...command, reviewHash: "review-3", effectiveAt }, operator);
    expect(service.schedule).toHaveBeenCalledWith({
      ...command,
      reviewHash: "review-3",
      effectiveAt,
      actor: operator.actor,
    });
  });
  it("fails invalid command metadata and propagates provider errors without a receipt", async () => {
    const { service, operations } = serviceFixture();
    for (const invalid of [
      { ...command, reason: " " },
      { ...command, idempotencyKey: "" },
      { ...command, expectedRevision: -1 },
    ]) {
      await expect(operations.review(invalid, operator)).rejects.toThrow(
        PolicyReleaseAccessProblem,
      );
    }
    const failure = new Error("store offline");
    service.publish.mockRejectedValue(failure);
    await expect(operations.publish({ ...command, reviewHash: "review-3" }, operator)).rejects.toBe(
      failure,
    );
  });
});

describe("PolicyReleaseOperations with the policy service", () => {
  it.each([undefined, "2026-10-01T12:00:00.000Z"])(
    "edits, reviews, releases at %s, and reloads the persisted receipt",
    async (effectiveAt) => {
      const service = new PolicyReleaseService({
        clock: { now: () => new Date("2026-01-01T00:00:00Z") },
      });
      service.registerPolicy<number>({
        id: "banner",
        schemaVersion: "1",
        codeRegistrationId: "banner:v1",
        schema: {
          version: "1",
          validate: (value) => typeof value === "number" && value >= 1 && value <= 5,
        },
        fieldDescriptors: [
          {
            id: "limit",
            label: "Limit",
            input: "number",
            min: 1,
            max: 5,
            read: (value) => value,
            write: (_value, next) => next as number,
          },
        ],
        validate: () => [
          { code: "ESTIMATE", path: "limit", severity: "warning", message: "Estimate only" },
        ],
        evaluate: (value) => value,
      });
      const draft = await service.createDraft({
        policyId: "banner",
        scope: access.scope,
        actor: access.actor,
        reason: "Initial",
        value: 2,
      });
      const operations = new PolicyReleaseOperations(service);
      const edited = await operations.edit(
        { ...command, expectedRevision: draft.revision, field: "limit", value: 3 },
        operator,
      );
      expect(edited.fields[0]).toMatchObject({ input: "number", min: 1, max: 5, value: 3 });
      const reviewed = await operations.review(
        { ...command, expectedRevision: edited.revision },
        operator,
      );
      expect(reviewed.diagnostics).toEqual([
        { code: "ESTIMATE", path: "limit", severity: "warning" },
      ]);
      const published = await operations.publish(
        {
          ...command,
          expectedRevision: reviewed.revision,
          reviewHash: reviewed.reviewHash ?? "missing",
          effectiveAt,
        },
        operator,
      );
      expect(published.receipt?.status).toBe(effectiveAt ? "scheduled" : "published");
      expect((await new PolicyReleaseOperations(service).read(command, access))?.receipt).toEqual(
        published.receipt,
      );
    },
  );
});
