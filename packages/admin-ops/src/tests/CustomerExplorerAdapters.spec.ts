import { describe, expect, it, vi } from "vitest";
import {
  EngagementCustomerExplorerSource,
  OperationsCustomerExplorerSource,
  PostgresTimelineSource,
} from "../libs/CustomerExplorerAdapters";
import type {
  ExplorerSqlTimelineMapping,
  ExplorerEngagementDispatch,
} from "../libs/CustomerExplorerAdapters";
import { normalizeAuditLogEntry } from "../libs/normalizers";

const scope = { appId: "app", environment: "test", tenantId: "tenant" };
const subject = { kind: "customer", id: "person" };
const at = "2026-01-01T00:00:00.000Z";
const request = { scope, subject, from: at, to: "2026-01-02T00:00:00.000Z", limit: 1 };
const mapping: ExplorerSqlTimelineMapping = {
  table: "events",
  appId: "app_id",
  environment: "environment",
  tenantId: "tenant_id",
  subjectKind: "subject_kind",
  subjectId: "subject_id",
  eventId: "event_id",
  occurredAt: "occurred_at",
  observedAt: "observed_at",
  kind: "kind",
  safeProperties: "properties",
};
const row = {
  event_id: "a",
  occurred_at: at,
  cursor_at: at,
  observed_at: at,
  kind: "view",
  properties: { count: 1 },
};
describe("customer explorer source adapters", () => {
  it("rejects malformed runtime subjects before reading providers", async () => {
    const query = vi.fn();
    const source = new PostgresTimelineSource({
      id: "events",
      executor: { query },
      mapping,
      status: async () => "complete",
    });
    await expect(
      source.read({ ...request, subject: { kind: 42, id: "person" } as unknown as typeof subject }),
    ).rejects.toMatchObject({ code: "customer-explorer/input" });
    expect(query).not.toHaveBeenCalled();
  });
  it.each(["denied", "failed"] as const)(
    "checks %s status before all live reference reads",
    async (status) => {
      const query = vi.fn().mockResolvedValue({ rows: [] });
      const getDispatch = vi.fn().mockResolvedValue(undefined);
      const collect = vi.fn().mockResolvedValue([]);
      const sources = [
        new PostgresTimelineSource({
          id: "sql",
          executor: { query },
          mapping,
          status: async () => status,
        }),
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
      expect(query).not.toHaveBeenCalled();
      expect(getDispatch).not.toHaveBeenCalled();
      expect(collect).not.toHaveBeenCalled();
    },
  );

  it("rejects identifier injection and binds scope, subject, dates and keyset as values", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row, { ...row, event_id: "b" }] });
    expect(
      () =>
        new PostgresTimelineSource({
          id: "events",
          executor: { query },
          mapping: { ...mapping, table: "events; DROP TABLE events" },
          status: async () => "complete",
        }),
    ).toThrow();
    const source = new PostgresTimelineSource({
      id: "events",
      executor: { query },
      mapping,
      status: async () => "partial",
    });
    const page = await source.read({
      ...request,
      subject: { ...subject, id: "'; DROP TABLE events; --" },
    });
    expect(page.items).toHaveLength(1);
    expect(page.status).toBe("partial");
    expect(query.mock.calls[0][0]).not.toContain("DROP TABLE");
    expect(query.mock.calls[0][1]).toEqual([
      "app",
      "test",
      "tenant",
      "customer",
      "'; DROP TABLE events; --",
      request.from,
      request.to,
      2,
    ]);
    await expect(source.read({ ...request, cursor: page.nextCursor })).rejects.toThrow();
    const next = await source.read(request);
    await source.read({ ...request, cursor: next.nextCursor });
    expect(query.mock.calls.at(-1)?.[1].slice(-2)).toEqual([at, "a"]);
  });
  it("preserves provider denial and does not query denied sources", async () => {
    const query = vi.fn();
    const source = new PostgresTimelineSource({
      id: "events",
      executor: { query },
      mapping,
      status: async () => "denied",
    });
    expect(await source.read(request)).toEqual({ items: [], status: "denied", truncated: false });
    expect(query).not.toHaveBeenCalled();
  });
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
