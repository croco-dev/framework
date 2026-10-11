import { describe, expect, it, vi } from "vitest";
import {
  EngagementCustomerExplorerSource,
  OperationsCustomerExplorerSource,
} from "../libs/CustomerExplorerAdapters";
import type { ExplorerEngagementDispatch } from "../libs/CustomerExplorerAdapters";
import { normalizeAuditLogEntry } from "../libs/normalizers";
const scope = { appId: "app", environment: "test", tenantId: "tenant" };
const subject = { kind: "customer", id: "person" };
const at = "2026-01-01T00:00:00.000Z";
const request = { scope, subject, from: at, to: "2026-01-02T00:00:00.000Z", limit: 1 };
describe("customer explorer source adapters", () => {
  it.each(["denied", "failed"] as const)(
    "checks %s status before all live reference reads",
    async (status) => {
      const getDispatch = vi.fn().mockResolvedValue(undefined);
      const collect = vi.fn().mockResolvedValue([]);
      const sources = [
        new EngagementCustomerExplorerSource({
          id: "engagement",
          scope,
          subjectKind: "customer",
          store: { getDispatch, listByRecipient: vi.fn() },
          status: async () => status,
        }),
        new OperationsCustomerExplorerSource({
          id: "ops",
          scope,
          subjectKind: "customer",
          adapter: { source: "audit", collect },
          status: async () => status,
        }),
      ];
      for (const source of sources)
        await expect(source.resolve(scope, subject, "deleted")).rejects.toThrow();
      expect(getDispatch).not.toHaveBeenCalled();
      expect(collect).not.toHaveBeenCalled();
    },
  );

  it("uses recipient-scoped first-party dispatch history and live getDispatch resolution", async () => {
    const dispatch: ExplorerEngagementDispatch = {
      id: "dispatch",
      tenantId: scope.tenantId,
      recipientId: subject.id,
      messageId: "message",
      channel: "email",
      outcome: { kind: "queued" },
      createdAt: new Date(at),
      updatedAt: new Date(at),
    };
    const store = {
      listByRecipient: vi.fn().mockResolvedValue({ items: [dispatch] }),
      getDispatch: vi.fn().mockResolvedValue(dispatch),
    };
    const source = new EngagementCustomerExplorerSource({
      id: "engagement",
      scope,
      subjectKind: "customer",
      store,
      status: async () => "complete",
    });
    expect((await source.read({ ...request, from: "2026-01-01T00:00:00.000100Z" })).items).toEqual(
      [],
    );
    const initial = (await source.read(request)).items[0];
    expect(initial).toMatchObject({
      kind: "engagement.queued",
      safeProperties: { channel: "email", status: "queued" },
    });
    expect(store.listByRecipient).toHaveBeenCalledWith("tenant", "person", { limit: 1 });
    expect(await source.resolve(scope, subject, initial?.eventId ?? "")).toBeDefined();
    const changed = { ...dispatch, outcome: { kind: "failed" as const, retryable: true } };
    store.getDispatch.mockResolvedValue(changed);
    store.listByRecipient.mockResolvedValue({ items: [changed] });
    expect(await source.resolve(scope, subject, initial?.eventId ?? "")).toBeUndefined();
    const updated = (await source.read(request)).items[0];
    expect(updated?.eventId).not.toBe(initial?.eventId);
    expect(await source.resolve(scope, subject, updated?.eventId ?? "")).toMatchObject({
      kind: "engagement.failed",
    });
    store.getDispatch.mockResolvedValue(undefined);
    expect(await source.resolve(scope, subject, initial?.eventId ?? "")).toBeUndefined();
    await expect(
      source.read({ ...request, scope: { ...scope, appId: "other" } }),
    ).rejects.toThrow();
  });
  it("reuses normalized operations events and keeps original source event ids independent", async () => {
    const normalized = normalizeAuditLogEntry({
      id: "shared",
      tenantId: "tenant",
      actorId: "operator",
      action: "update",
      resourceType: "customer",
      resourceId: "person",
      payload: {},
      diff: null,
      metadata: {},
      createdAt: at,
    });
    const events = [
      { ...normalized, customerId: "person" },
      { ...normalized, source: "workflow", customerId: "person" },
    ];
    const adapter = { source: "audit", collect: vi.fn().mockImplementation(async () => events) };
    const source = new OperationsCustomerExplorerSource({
      id: "ops",
      scope,
      subjectKind: "customer",
      adapter,
      status: async () => "complete",
    });
    expect((await source.read({ ...request, from: "2026-01-01T00:00:00.000100Z" })).items).toEqual(
      [],
    );
    const first = await source.read(request);
    const second = await source.read({ ...request, cursor: first.nextCursor });
    expect(first.items[0]?.eventId).not.toBe(second.items[0]?.eventId);
    expect(await source.resolve(scope, subject, first.items[0]?.eventId ?? "")).toBeDefined();
    events.splice(0, 1);
    expect(await source.resolve(scope, subject, first.items[0]?.eventId ?? "")).toBeUndefined();
  });
});
