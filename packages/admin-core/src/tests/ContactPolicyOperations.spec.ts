import { describe, expect, it, vi } from "vitest";
import { ProblemCategory } from "@croco/problems-core";
import {
  ContactPolicyOperations,
  assertContactPolicyRegistration,
} from "../libs/ContactPolicyOperations";
import type {
  ContactPolicyAdminAccess,
  ContactPolicyAdminEdit,
  ContactPolicyAdminRegistration,
  ContactPolicyAdminSnapshot,
  ContactPolicyAdminStore,
} from "../libs/ContactPolicyOperations";
import type { ContactPolicy } from "@croco/engagement-core";
const target = {
  scope: { app: "app", environment: "test", tenantId: "tenant" },
  subject: "subject",
};
const registration: ContactPolicyAdminRegistration = {
  config: {
    version: "v1",
    rules: [{ id: "daily", limit: 3, windowMs: 86400000 }],
    reservationTtlMs: 60000,
  },
  topics: [{ id: "news", kind: "marketing", priority: 1, messageIds: ["newsletter"] }],
  limits: { daily: { min: 1, max: 10 } },
  quietHours: false,
  priorities: { news: { min: 0, max: 5 } },
};
const policy: ContactPolicyAdminSnapshot = {
  config: { ...registration.config, version: "v1:1" },
  topics: registration.topics,
  revision: 1,
};
const edit: ContactPolicyAdminEdit = {
  limits: { daily: 2 },
  priorities: { news: 3 },
  expectedRevision: 1,
  reason: "Reduce contact budget",
  idempotencyKey: "save-1",
};
function setup(
  permissions: ContactPolicyAdminAccess["permissions"] = [
    "contact-policy.read",
    "contact-policy.write",
  ],
) {
  const store: ContactPolicyAdminStore = {
    load: vi.fn(async () => ({ policy, historyComplete: true, recentSuppressions: [] })),
    save: vi.fn(async (input) => input.policy),
  };
  const evaluate = vi.fn(async () => ({
    allowed: false,
    reason: "limit" as const,
    blockingRuleId: "daily",
  }));
  const createPolicy = vi.fn(() => ({ evaluate }) as unknown as ContactPolicy);
  const authorize = vi.fn(async () => ({ actorId: "authenticated-operator", permissions }));
  return {
    operations: new ContactPolicyOperations({ store, registration, authorize, createPolicy }),
    store,
    evaluate,
    authorize,
    createPolicy,
  };
}
describe("ContactPolicyOperations", () => {
  it("authorizes reads and writes on the server before querying scoped data", async () => {
    const { operations, store } = setup([]);
    await expect(operations.load(target)).rejects.toMatchObject({
      code: "admin-core/contact-policy-denied",
      category: ProblemCategory.Forbidden,
      status: 403,
    });
    await expect(operations.save(target, edit)).rejects.toThrow("access denied");
    expect(store.load).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });
  it("rejects missing tenant and cross-subject dry-run", async () => {
    const { operations, evaluate } = setup();
    await expect(
      operations.load({ ...target, scope: { ...target.scope, tenantId: "" } }),
    ).rejects.toThrow("required");
    await expect(
      operations.dryRun(target, {
        scope: target.scope,
        recipient: "other",
        channel: "email",
        topic: "news",
        messageId: "newsletter",
        logicalSendId: "dry",
        payloadFingerprint: "digest",
        now: new Date(),
      }),
    ).rejects.toThrow("access denied");
    expect(evaluate).not.toHaveBeenCalled();
  });
  it("uses the send evaluator without reserve or save", async () => {
    const { operations, evaluate, store } = setup();
    const request = {
      scope: target.scope,
      recipient: target.subject,
      channel: "email" as const,
      topic: "news",
      messageId: "newsletter",
      logicalSendId: "dry",
      payloadFingerprint: "digest",
      now: new Date(),
    };
    expect(await operations.dryRun(target, request)).toEqual({
      allowed: false,
      reason: "limit",
      blockingRuleId: "daily",
    });
    expect(evaluate).toHaveBeenCalledWith(request);
    expect(store.save).not.toHaveBeenCalled();
  });
  it("preserves registered topic kind/message mapping and carries atomic audit inputs", async () => {
    const { operations, store } = setup();
    const saved = await operations.save(target, edit);
    expect(saved.topics[0]).toEqual({ ...registration.topics[0], priority: 3 });
    expect(saved.config.rules[0].limit).toBe(2);
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({
        edit,
        target,
        actorId: "authenticated-operator",
        expectedRevision: 1,
        idempotencyKey: "save-1",
        reason: edit.reason,
      }),
    );
  });
  it("rejects extra client fields before audit persistence", async () => {
    const { operations, store } = setup();
    await expect(
      operations.save(target, { ...edit, contact: "untrusted" } as ContactPolicyAdminEdit),
    ).rejects.toThrow("Unregistered edit fields");
    expect(store.save).not.toHaveBeenCalled();
  });
  it.each([
    { ...edit, limits: { daily: 11 } },
    { ...edit, priorities: { security: 5 } },
    { ...edit, quietHours: null },
    { ...edit, reason: "" },
    { ...edit, expectedRevision: -1 },
  ])("rejects unregistered or invalid edits", async (input) => {
    const { operations, store } = setup();
    await expect(operations.save(target, input)).rejects.toThrow();
    expect(store.save).not.toHaveBeenCalled();
  });
});

describe("persisted contact policy registration", () => {
  it("rejects a removed security exemption before reads, dry-runs or writes", async () => {
    const { operations, store, createPolicy, evaluate } = setup();
    vi.mocked(store.load).mockResolvedValue({
      policy: { ...policy, topics: [{ ...policy.topics[0], kind: "security" }] },
      recentSuppressions: [],
      historyComplete: true,
    });
    const request = {
      scope: target.scope,
      recipient: target.subject,
      channel: "email" as const,
      topic: "news",
      messageId: "newsletter",
      logicalSendId: "dry",
      payloadFingerprint: "digest",
      now: new Date(),
    };
    for (const operation of [
      () => operations.load(target),
      () => operations.dryRun(target, request),
      () => operations.save(target, { ...edit, limits: {}, priorities: {} }),
    ]) {
      await expect(operation()).rejects.toMatchObject({
        code: "admin-core/contact-policy-invalid",
        detail: expect.stringContaining("migrate or reinitialize"),
      });
    }
    expect(createPolicy).not.toHaveBeenCalled();
    expect(evaluate).not.toHaveBeenCalled();
    expect(store.save).not.toHaveBeenCalled();
  });
  it.each([
    { ...policy, config: { ...policy.config, version: "v0:1" } },
    { ...policy, config: { ...policy.config, reservationTtlMs: 1 } },
    { ...policy, config: { ...policy.config, rules: [] } },
    {
      ...policy,
      config: {
        ...policy.config,
        rules: [{ ...policy.config.rules[0], channel: "email" as const }],
      },
    },
    {
      ...policy,
      config: { ...policy.config, rules: [{ ...policy.config.rules[0], topic: "news" }] },
    },
    {
      ...policy,
      config: { ...policy.config, rules: [{ ...policy.config.rules[0], windowMs: 1 }] },
    },
    {
      ...policy,
      config: { ...policy.config, rules: [{ ...policy.config.rules[0], minimumSpacingMs: 1 }] },
    },
    { ...policy, config: { ...policy.config, rules: [{ ...policy.config.rules[0], limit: 11 }] } },
    { ...policy, topics: [{ ...policy.topics[0], messageIds: ["removed-message"] }] },
    { ...policy, topics: [{ ...policy.topics[0], priority: 6 }] },
    {
      ...policy,
      config: { ...policy.config, quietHours: { startMinute: 1, endMinute: 2, timezone: "UTC" } },
    },
  ])("rejects stale immutable fields and overrides outside current bounds", (snapshot) => {
    expect(() => assertContactPolicyRegistration(snapshot, registration)).toThrow(
      "migrate or reinitialize",
    );
  });
  it("retains valid current overrides during unrelated edits", async () => {
    const { operations, store } = setup();
    vi.mocked(store.load).mockResolvedValue({
      policy: {
        ...policy,
        config: { ...policy.config, rules: [{ ...policy.config.rules[0], limit: 7 }] },
        topics: [{ ...policy.topics[0], priority: 4 }],
      },
      recentSuppressions: [],
      historyComplete: true,
    });
    const saved = await operations.save(target, { ...edit, limits: {}, priorities: {} });
    expect(saved.config.rules[0].limit).toBe(7);
    expect(saved.topics[0].priority).toBe(4);
    expect(saved.config.version).toBe("v1:2");
  });
  it("preserves code-only fractional topic priority", () => {
    const topics = [{ ...policy.topics[0], priority: 1.5 }];
    expect(() =>
      assertContactPolicyRegistration(
        { ...policy, topics },
        { ...registration, topics, priorities: {} },
      ),
    ).not.toThrow();
    expect(() =>
      assertContactPolicyRegistration({ ...policy, topics }, { ...registration, topics }),
    ).not.toThrow();
  });
  it.each([
    { startMinute: -1, endMinute: 420, timezone: "UTC" },
    { startMinute: 1320, endMinute: 1440, timezone: "UTC" },
    { startMinute: 1.5, endMinute: 420, timezone: "UTC" },
    { startMinute: 420, endMinute: 420, timezone: "UTC" },
    { startMinute: 1320, endMinute: 420, timezone: "" },
  ])("rejects invalid persisted quiet-hour boundaries", (quietHours) => {
    expect(() =>
      assertContactPolicyRegistration(
        { ...policy, config: { ...policy.config, quietHours } },
        { ...registration, quietHours: true },
      ),
    ).toThrow("migrate or reinitialize");
  });
  it("allows valid registered quiet-hour overrides and rejects malformed ones", () => {
    const editable = { ...registration, quietHours: true };
    const snapshot = {
      ...policy,
      config: {
        ...policy.config,
        quietHours: {
          startMinute: 1320,
          endMinute: 420,
          timezone: "Asia/Seoul",
        },
      },
    };
    expect(() => assertContactPolicyRegistration(snapshot, editable)).not.toThrow();
    expect(() =>
      assertContactPolicyRegistration(
        {
          ...snapshot,
          config: {
            ...snapshot.config,
            quietHours: { ...snapshot.config.quietHours, timezone: "invalid-zone" },
          },
        },
        editable,
      ),
    ).toThrow("migrate or reinitialize");
  });
});
