import { describe, expect, it, vi } from "vitest";
import { PostgresTimelineSource } from "../libs/CustomerExplorerAdapters";
import type { ExplorerSqlTimelineMapping } from "../libs/CustomerExplorerAdapters";
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
describe("PostgreSQL customer explorer adapters", () => {
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
    "checks %s status before a live reference query",
    async (status) => {
      const query = vi.fn().mockResolvedValue({ rows: [] });
      const source = new PostgresTimelineSource({
        id: "sql",
        executor: { query },
        mapping,
        status: async () => status,
      });
      await expect(source.resolve(scope, subject, "deleted")).rejects.toThrow();
      expect(query).not.toHaveBeenCalled();
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
});
