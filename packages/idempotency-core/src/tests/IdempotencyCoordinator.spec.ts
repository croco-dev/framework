import { describe, expect, it, vi } from "vitest";
import {
  createIdempotencyCoordinator,
  createIdempotentHandler,
  deriveHttpIdempotencyKey,
  deriveIdempotencyKey,
  deriveWebhookIdempotencyKey,
  IdempotencyConflictProblem,
  IdempotencyCoordinator,
  type IdempotencyFailOptions,
  type IdempotencyFailedRecord,
  InMemoryIdempotencyStore,
  InvalidIdempotencyKeyProblem,
  InvalidIdempotencyTtlProblem,
  type IdempotencyAuditEvent,
} from "../index";

const INVALID_TTLS = [
  -1,
  0,
  1.5,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  Number.MAX_SAFE_INTEGER + 1,
  8_640_000_000_000_000,
] as const;

describe("IdempotencyCoordinator", () => {
  it.each(INVALID_TTLS)(
    "rejects hostile ttl %s before handler, audit, or store state changes",
    async (ttlMs) => {
      const events: IdempotencyAuditEvent[] = [];
      const store = new InMemoryIdempotencyStore<string>({
        now: () => new Date("2026-01-01T00:00:00.000Z"),
      });
      const coordinator = createIdempotencyCoordinator({
        store,
        auditSink: {
          recordIdempotency: (event) => {
            events.push(event);
          },
        },
      });
      const key = deriveIdempotencyKey({
        namespace: "invalid-ttl",
        source: { kind: "explicit", key: `ttl-${String(ttlMs)}`, fingerprint: "payload-a" },
      });
      const handler = vi.fn(() => "must-not-run");

      await expect(coordinator.execute({ key, ttlMs }, handler)).rejects.toBeInstanceOf(
        InvalidIdempotencyTtlProblem,
      );

      expect(handler).not.toHaveBeenCalled();
      expect(events).toEqual([]);
      expect(store.size).toBe(0);
    },
  );

  it("executes once and replays the stored success result for repeated calls", async () => {
    const store = new InMemoryIdempotencyStore<{ orderId: string }>();
    const coordinator = new IdempotencyCoordinator({ store });
    const key = deriveIdempotencyKey({
      namespace: "orders",
      tenantId: "tenant-a",
      source: { kind: "explicit", key: "checkout-1", fingerprint: "cart-a" },
    });
    let calls = 0;

    const first = await coordinator.execute({ key }, () => {
      calls += 1;
      return { orderId: "order-1" };
    });
    const second = await coordinator.execute({ key }, () => {
      calls += 1;
      return { orderId: "order-2" };
    });

    expect(first).toMatchObject({ outcome: "executed", response: { orderId: "order-1" } });
    expect(second).toMatchObject({ outcome: "replayed", response: { orderId: "order-1" } });
    expect(calls).toBe(1);
  });

  it("returns in-flight state instead of running the handler while a reservation is active", async () => {
    const store = new InMemoryIdempotencyStore<string>();
    const coordinator = createIdempotencyCoordinator({ store });
    const key = deriveIdempotencyKey({
      namespace: "jobs",
      source: { kind: "explicit", key: "job-1", fingerprint: "payload-a" },
    });
    await store.reserve(key);

    const result = await coordinator.execute({ key }, () => "must-not-run");

    expect(result.outcome).toBe("in-flight");
  });

  it("records audit events for reserved and replayed outcomes", async () => {
    const events: IdempotencyAuditEvent[] = [];
    const store = new InMemoryIdempotencyStore<string>();
    const coordinator = createIdempotencyCoordinator({
      store,
      auditSink: {
        recordIdempotency: (event) => {
          events.push(event);
        },
      },
    });
    const key = deriveIdempotencyKey({
      namespace: "audit",
      tenantId: "tenant-a",
      source: { kind: "explicit", key: "key-1", fingerprint: "payload-a" },
    });

    await coordinator.execute({ key, metadata: { operation: "create" } }, () => "created");
    await coordinator.execute({ key }, () => "ignored");

    expect(events.map((event) => event.type)).toEqual([
      "idempotency.reserved",
      "idempotency.replayed",
    ]);
    expect(events[0]).toMatchObject({
      key: "key-1",
      namespace: "audit",
      tenantId: "tenant-a",
      fingerprint: "payload-a",
    });
  });

  it("records conflict audit events before rethrowing the Problem", async () => {
    const events: IdempotencyAuditEvent[] = [];
    const store = new InMemoryIdempotencyStore<string>();
    const coordinator = createIdempotencyCoordinator({
      store,
      auditSink: {
        recordIdempotency: (event) => {
          events.push(event);
        },
      },
    });
    const key = deriveIdempotencyKey({
      namespace: "audit",
      source: { kind: "explicit", key: "key-1", fingerprint: "payload-a" },
    });
    const conflictingKey = deriveIdempotencyKey({
      namespace: "audit",
      source: { kind: "explicit", key: "key-1", fingerprint: "payload-b" },
    });

    await coordinator.execute({ key }, () => "created");

    await expect(coordinator.execute({ key: conflictingKey }, () => "ignored")).rejects.toThrow(
      IdempotencyConflictProblem,
    );
    expect(events.map((event) => event.type)).toEqual([
      "idempotency.reserved",
      "idempotency.conflict",
    ]);
  });

  it("replays duplicate webhook provider events through the same core API", async () => {
    const store = new InMemoryIdempotencyStore<{ accepted: boolean }>();
    const coordinator = createIdempotencyCoordinator({ store });
    const key = deriveWebhookIdempotencyKey({
      provider: "stripe",
      eventId: "evt_123",
      tenantId: "tenant-a",
    });
    let calls = 0;

    const first = await coordinator.execute({ key }, () => {
      calls += 1;
      return { accepted: true };
    });
    const duplicate = await coordinator.execute({ key }, () => {
      calls += 1;
      return { accepted: false };
    });

    expect(first.outcome).toBe("executed");
    expect(duplicate).toMatchObject({ outcome: "replayed", response: { accepted: true } });
    expect(calls).toBe(1);
  });

  it("can wrap an HTTP middleware-style handler without coupling to a transport package", async () => {
    type HttpContext = {
      readonly tenantId: string;
      readonly headers: Readonly<Record<string, string>>;
      readonly bodyFingerprint: string;
    };

    const store = new InMemoryIdempotencyStore<{ status: number }>();
    const coordinator = createIdempotencyCoordinator({ store });
    const handler = createIdempotentHandler(
      coordinator,
      (context: HttpContext) => ({
        key: deriveHttpIdempotencyKey({
          tenantId: context.tenantId,
          idempotencyKey: context.headers["idempotency-key"],
          method: "POST",
          path: "/orders",
          bodyFingerprint: context.bodyFingerprint,
        }),
      }),
      () => ({ status: 201 }),
    );

    const first = await handler({
      tenantId: "tenant-a",
      headers: { "idempotency-key": "request-1" },
      bodyFingerprint: "body-a",
    });
    const duplicate = await handler({
      tenantId: "tenant-a",
      headers: { "idempotency-key": "request-1" },
      bodyFingerprint: "body-a",
    });

    expect(first.outcome).toBe("executed");
    expect(duplicate.outcome).toBe("replayed");
  });

  it("stores failure evidence and allows retry after a transient Problem", async () => {
    const store = new InMemoryIdempotencyStore<string>();
    const coordinator = createIdempotencyCoordinator({ store });
    const key = deriveIdempotencyKey({
      namespace: "retry",
      source: { kind: "explicit", key: "key-1", fingerprint: "payload-a" },
    });
    let calls = 0;

    await expect(
      coordinator.execute({ key }, () => {
        calls += 1;
        throw new InvalidIdempotencyKeyProblem("fixture problem");
      }),
    ).rejects.toThrow(InvalidIdempotencyKeyProblem);

    const retry = await coordinator.execute({ key }, () => {
      calls += 1;
      return "created";
    });

    expect(retry).toMatchObject({ outcome: "executed", response: "created" });
    expect(calls).toBe(2);
  });

  it("does not mark reservations failed when commit fails after handler success", async () => {
    class CommitFailureStore<TResult> extends InMemoryIdempotencyStore<TResult> {
      failCalls = 0;

      override async commit(): Promise<never> {
        throw new InvalidIdempotencyKeyProblem("commit failed");
      }

      override async fail(options: IdempotencyFailOptions): Promise<IdempotencyFailedRecord> {
        this.failCalls += 1;
        return super.fail(options);
      }
    }

    const store = new CommitFailureStore<string>();
    const coordinator = createIdempotencyCoordinator({ store });
    const key = deriveIdempotencyKey({
      namespace: "commit",
      source: { kind: "explicit", key: "key-1", fingerprint: "payload-a" },
    });
    let calls = 0;

    await expect(
      coordinator.execute({ key }, () => {
        calls += 1;
        return "created";
      }),
    ).rejects.toThrow(InvalidIdempotencyKeyProblem);

    const retry = await coordinator.execute({ key }, () => {
      calls += 1;
      return "must-not-run";
    });

    expect(store.failCalls).toBe(0);
    expect(retry.outcome).toBe("in-flight");
    expect(calls).toBe(1);
  });
});
