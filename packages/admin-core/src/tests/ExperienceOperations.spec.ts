import { describe, expect, it, vi } from "vitest";
import { ExperienceOperations } from "../libs/ExperienceOperations";
import type { ExperienceConfig, ExperienceStore } from "@croco/experience-core";

const scope = { appId: "shop", environment: "test", tenantId: "tenant-a" };
const config: ExperienceConfig = {
  id: "tip",
  placementId: "checkout.assurance",
  scope,
  revision: 1,
  status: "draft",
  renderer: "banner",
  content: { locale: "en", title: "Order help", body: "We can help." },
  priority: 1,
};
const placement = {
  id: config.placementId,
  schema: {
    contextFields: { plan: "string" as const },
    content: { locales: ["en"], maxTitleLength: 120, maxBodyLength: 1000, allowActionUrl: true },
  },
  allowedRenderers: ["banner"],
};
const access = {
  scope,
  actorId: "operator",
  permissions: [
    "experience.read",
    "experience.preview",
    "experience.write",
    "experience.publish",
  ] as const,
  fields: [
    "renderer",
    "content.locale",
    "content.title",
    "content.body",
    "content.actionUrl",
    "targeting.context",
    "targeting.staticSubjectIds",
    "targeting.cohortSnapshotId",
    "priority",
    "startAt",
    "endAt",
    "frequency",
    "context.plan",
  ],
};

describe("ExperienceOperations", () => {
  it("rejects a scoped read when the caller lacks permission for returned fields", async () => {
    const store = {
      listConfigs: vi.fn(async () => [config]),
    } as unknown as ExperienceStore;
    const operations = new ExperienceOperations(store, { [placement.id]: placement });
    await expect(
      operations.list(config.placementId, {
        ...access,
        fields: access.fields.filter((field) => field !== "content.body"),
      }),
    ).rejects.toThrow("Field permission denied: content.body");
    expect(await operations.list(config.placementId, access)).toEqual([config]);
  });

  it("enforces exact tenant, field, and publish permission before writing", async () => {
    const saveConfig = vi.fn(async ({ config: value }) => value);
    const store = {
      listConfigs: vi.fn(async () => []),
      saveConfig,
      reserve: vi.fn(),
      readDecision: vi.fn(),
      recordExposure: vi.fn(),
      dismiss: vi.fn(),
    } as unknown as ExperienceStore;
    const operations = new ExperienceOperations(store, { [placement.id]: placement });
    await expect(
      operations.save(
        config,
        { ...access, scope: { ...scope, tenantId: "tenant-b" } },
        {
          expectedRevision: null,
          reason: "Launch",
          idempotencyKey: "launch",
        },
      ),
    ).rejects.toThrow();
    await expect(
      operations.save(
        config,
        { ...access, fields: access.fields.filter((field) => field !== "content.body") },
        {
          expectedRevision: null,
          reason: "Launch",
          idempotencyKey: "launch",
        },
      ),
    ).rejects.toThrow();
    await expect(
      operations.save(
        { ...config, status: "published" },
        {
          ...access,
          permissions: ["experience.write"],
        },
        { expectedRevision: null, reason: "Launch", idempotencyKey: "launch" },
      ),
    ).rejects.toThrow();
    expect(saveConfig).not.toHaveBeenCalled();
    await operations.save(config, access, {
      expectedRevision: null,
      reason: "Launch",
      idempotencyKey: "launch",
    });
    expect(saveConfig).toHaveBeenCalledOnce();
  });

  it("requires publish permission to move a published configuration back to draft", async () => {
    const saveConfig = vi.fn(async ({ config: value }) => value);
    const store = {
      listConfigs: vi.fn(async () => [{ ...config, status: "published" }]),
      saveConfig,
    } as unknown as ExperienceStore;
    const operations = new ExperienceOperations(store, { [placement.id]: placement });
    await expect(
      operations.save(
        config,
        { ...access, permissions: ["experience.write"] },
        {
          expectedRevision: 1,
          reason: "Withdraw",
          idempotencyKey: "withdraw",
        },
      ),
    ).rejects.toThrow();
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it("previews with the same placement validator without a store write", async () => {
    const saveConfig = vi.fn();
    const store = {
      listConfigs: vi.fn(async () => []),
      saveConfig,
      reserve: vi.fn(),
      readDecision: vi.fn(),
      recordExposure: vi.fn(),
      dismiss: vi.fn(),
    } as unknown as ExperienceStore;
    const operations = new ExperienceOperations(store, { [placement.id]: placement });
    expect(
      await operations.preview(
        config,
        { kind: "customer", id: "customer-1" },
        { plan: "pro" },
        access,
      ),
    ).toMatchObject({ matched: true, renderer: "banner" });
    expect(saveConfig).not.toHaveBeenCalled();
    await expect(
      operations.preview(
        { ...config, targeting: { cohortSnapshotId: "snapshot-1" } },
        { kind: "customer", id: "customer-1" },
        { plan: "pro" },
        {
          ...access,
          fields: access.fields.filter((field) => field !== "targeting.cohortSnapshotId"),
        },
      ),
    ).rejects.toThrow("Field permission denied: targeting.cohortSnapshotId");
  });
});
