import { describe, expect, it, vi } from "vitest";
import { InMemoryTransactionalEventStore, TransactionalInboxConsumer } from "@croco/events-tx";
import { WarehouseContractError } from "@croco/warehouse-core";
import { AnalyticsOutboxConsumer } from "../index";
import type { TransactionalOutboxMessage } from "@croco/events-tx";
import type { WarehouseWriter, WriteReceipt } from "@croco/warehouse-core/runtime";
import type { QuarantineStore } from "../index";

const instant = new Date("2026-09-01T00:00:00.000Z");
const durable: WriteReceipt = {
  batchId: JSON.stringify(["orders", "outbox-1"]),
  attempt: 1,
  state: "durable",
  providerRef: "candidate/outbox-1",
  inserted: 1,
  identical: 0,
};

async function fixture(
  metadata: Record<string, unknown> = {
    analytics: { sourceRef: "orders", schemaVersion: 1, subject: "capture", origin: "checkout" },
  },
) {
  const store = new InMemoryTransactionalEventStore();
  const message = await store.appendOutbox({
    id: "outbox-1",
    eventId: "event-1",
    eventType: "capture.completed",
    idempotencyKey: "delivery-1",
    payload: { captureId: "capture-1", amount: "100" },
    metadata,
    maxAttempts: 3,
    visibleAt: instant,
    occurredAt: instant,
  });
  const writer: WarehouseWriter = {
    write: vi.fn(async () => durable),
    reconcileReceipt: vi.fn(async () => null),
  };
  const quarantine: QuarantineStore = { record: vi.fn(async () => "recorded" as const) };
  const consumer = new AnalyticsOutboxConsumer({
    store,
    consumerId: "analytics",
    sourceRef: "orders",
    writer,
    quarantine,
    resolveBinding: async () => ({
      access: {
        scope: { application: "checkout", environment: "test" },
        actor: "analytics-worker",
        roles: ["import"],
        columns: ["captureId", "amount"],
        permissionEpoch: 0,
        privacyEpoch: 0,
      },
      candidateId: "candidate-1",
      fence: 1,
    }),
    mapRows: async (_envelope, source) => [
      { captureId: String(source.payload.captureId), amount: String(source.payload.amount) },
    ],
  });
  return { store, message, writer, quarantine, consumer };
}

describe("AnalyticsOutboxConsumer", () => {
  it("acks only a durable receipt and keeps event identity separate from fact grain", async () => {
    const { consumer, writer, message, store } = await fixture();
    const result = await consumer.handle(message);
    expect(result.status).toBe("accepted-durable");
    expect(writer.write).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: JSON.stringify(["orders", message.id]),
        rows: [{ captureId: "capture-1", amount: "100" }],
      }),
    );
    expect(await store.findInboxRecord("analytics", message.idempotencyKey)).toMatchObject({
      status: "processed",
    });
    expect(await store.findOutboxById(message.id)).toMatchObject({ status: "pending" });
    expect(await consumer.handle(message)).toEqual({ status: "duplicate" });
    expect(writer.write).toHaveBeenCalledTimes(1);
  });

  it("reconciles an indeterminate write before ack", async () => {
    const { consumer, writer, message } = await fixture();
    vi.mocked(writer.write).mockResolvedValueOnce({ ...durable, state: "indeterminate" });
    vi.mocked(writer.reconcileReceipt).mockResolvedValueOnce(durable);
    expect((await consumer.handle(message)).status).toBe("accepted-durable");
  });

  it("keeps the inbox unprocessed when a durable receipt cannot be established", async () => {
    const { consumer, writer, message, store } = await fixture();
    vi.mocked(writer.write).mockResolvedValueOnce({ ...durable, state: "indeterminate" });
    await expect(consumer.handle(message)).rejects.toMatchObject({
      code: "etl-events-tx/receipt-unavailable",
    });
    expect(await store.findInboxRecord("analytics", message.idempotencyKey)).toMatchObject({
      status: "failed",
    });
  });

  it("does not reconcile a known access failure or complete the inbox", async () => {
    const { consumer, writer, message, store } = await fixture();
    vi.mocked(writer.write).mockRejectedValueOnce(
      new WarehouseContractError("WAREHOUSE_ACCESS_CHANGED"),
    );
    await expect(consumer.handle(message)).rejects.toMatchObject({
      code: "WAREHOUSE_ACCESS_CHANGED",
    });
    expect(writer.reconcileReceipt).not.toHaveBeenCalled();
    expect(await store.findInboxRecord("analytics", message.idempotencyKey)).toMatchObject({
      status: "failed",
    });
  });

  it("keeps a rejected receipt unprocessed", async () => {
    const { consumer, writer, message, store } = await fixture();
    vi.mocked(writer.write).mockResolvedValueOnce({ ...durable, state: "rejected" });
    await expect(consumer.handle(message)).rejects.toMatchObject({
      code: "etl-events-tx/write-rejected",
    });
    expect(writer.reconcileReceipt).not.toHaveBeenCalled();
    expect(await store.findInboxRecord("analytics", message.idempotencyKey)).toMatchObject({
      status: "failed",
    });
  });

  it("durably quarantines an invalid source envelope without writing a fact", async () => {
    const { consumer, writer, quarantine, message, store } = await fixture({
      analytics: { sourceRef: "wrong" },
    });
    expect(await consumer.handle(message)).toMatchObject({
      status: "quarantined",
      code: "etl-events-tx/invalid-source-envelope",
    });
    expect(quarantine.record).toHaveBeenCalledWith({
      consumerId: "analytics",
      sourceRef: "orders",
      outboxMessageId: "outbox-1",
      eventId: "event-1",
      code: "etl-events-tx/invalid-source-envelope",
    });
    expect(writer.write).not.toHaveBeenCalled();
    expect(await store.findInboxRecord("analytics", message.idempotencyKey)).toMatchObject({
      status: "processed",
    });
  });

  it("quarantines a fact conflict and leaves another consumer independent", async () => {
    const { consumer, writer, message, store } = await fixture();
    vi.mocked(writer.write).mockRejectedValueOnce(
      new WarehouseContractError("WAREHOUSE_FACT_CONFLICT"),
    );
    expect((await consumer.handle(message)).status).toBe("quarantined");
    const other = new TransactionalInboxConsumer({ store, consumerId: "audit" });
    expect((await other.handle(message, async () => {})).status).toBe("processed");
    expect(await store.findInboxRecord("audit", message.idempotencyKey)).toMatchObject({
      status: "processed",
    });
  });

  it.each(["WAREHOUSE_INVALID_INTEGER", "WAREHOUSE_INTEGER_OVERFLOW"])(
    "quarantines deterministic warehouse validation %s before ack",
    async (code) => {
      const { consumer, writer, quarantine, message, store } = await fixture();
      vi.mocked(writer.write).mockRejectedValueOnce(new WarehouseContractError(code));
      expect(await consumer.handle(message)).toMatchObject({ status: "quarantined", code });
      expect(quarantine.record).toHaveBeenCalledWith(expect.objectContaining({ code }));
      expect(await store.findInboxRecord("analytics", message.idempotencyKey)).toMatchObject({
        status: "processed",
      });
    },
  );

  it("does not ack an invalid envelope while quarantine storage is unavailable", async () => {
    const { consumer, quarantine, message, store } = await fixture({
      analytics: { sourceRef: "wrong" },
    });
    vi.mocked(quarantine.record).mockRejectedValueOnce(new Error("secret database detail"));
    await expect(consumer.handle(message)).rejects.toMatchObject({
      code: "etl-events-tx/quarantine-unavailable",
    });
    expect(await store.findInboxRecord("analytics", message.idempotencyKey)).toMatchObject({
      status: "failed",
    });
  });

  it("reports absent exact-ID replay as unavailable with source retention", async () => {
    const { consumer } = await fixture();
    const retention = {
      kind: "outbox" as const,
      knownHistoryFrom: "2026-01-01T00:00:00Z",
      retainedFrom: "2026-08-01T00:00:00Z",
    };
    expect(await consumer.replayById("pruned-id", retention)).toEqual({
      status: "unavailable",
      messageId: "pruned-id",
      retention,
    });
  });

  it("replays a retained ID and keeps equal-valued distinct events separate", async () => {
    const { consumer, writer, message, store } = await fixture();
    vi.mocked(writer.write).mockImplementation(async (request) => ({
      ...durable,
      batchId: request.batchId,
    }));
    const retention = {
      kind: "outbox" as const,
      knownHistoryFrom: "2026-09-01T01:00:00+02:00",
      retainedFrom: "2026-09-01T00:00:00Z",
    };
    expect((await consumer.replayById(message.id, retention)).status).toBe("accepted-durable");
    const second = await store.appendOutbox({
      id: "outbox-2",
      eventId: "event-2",
      eventType: message.eventType,
      idempotencyKey: "delivery-2",
      payload: message.payload,
      metadata: message.metadata,
      maxAttempts: 3,
      visibleAt: instant,
      occurredAt: instant,
    });
    expect((await consumer.handle(second)).status).toBe("accepted-durable");
    expect(writer.write).toHaveBeenCalledTimes(2);
    expect(vi.mocked(writer.write).mock.calls.map(([request]) => request.batchId)).toEqual([
      JSON.stringify(["orders", "outbox-1"]),
      JSON.stringify(["orders", "outbox-2"]),
    ]);
  });

  it("compares retention instants and rejects reversed history", async () => {
    const { consumer } = await fixture();
    await expect(
      consumer.replayById("missing", {
        kind: "outbox",
        knownHistoryFrom: "2026-09-01T00:01:00+00:00",
        retainedFrom: "2026-09-01T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "etl-events-tx/invalid-retention" });
  });
});
