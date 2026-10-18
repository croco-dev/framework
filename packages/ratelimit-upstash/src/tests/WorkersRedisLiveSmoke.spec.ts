import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Redis } from "ioredis";
import type { Miniflare } from "miniflare";
import type { RateLimitResult } from "@croco/ratelimit-core";
import { createWorker } from "./fixtures/workerHarness";

const workers: Miniflare[] = [];

describe.skipIf(process.env.CROCO_TEST_REAL_RESOURCES !== "1")(
  "workerd → Upstash REST → real Redis Lua",
  () => {
    let redis: Redis;
    let dispose: () => Promise<void> | void;
    beforeAll(async () => {
      const { redisResource } = await import("@croco/testing-resources");
      const started = await redisResource({ id: "upstash-worker" }).start({
        register: () => undefined,
        testId: "worker-conformance",
        workerId: "ratelimit-upstash",
      });
      redis = started.connection.client.duplicate({ keyPrefix: "" });
      await redis.connect();
      dispose = async () => {
        try {
          await redis.quit();
        } finally {
          await started.dispose();
        }
      };
    }, 180_000);
    afterEach(async () => {
      await Promise.all(workers.splice(0).map((worker) => worker.dispose()));
      await redis.flushdb();
    });
    afterAll(async () => {
      await dispose?.();
    }, 180_000);

    it.each(["fixed", "sliding", "token-bucket"])(
      "enforces %s atomically across isolates, isolates namespaces, expires and refunds once",
      async (algorithm) => {
        const execute = (command: string[]) => redis.call(command[0] ?? "", ...command.slice(1));
        const first = await createWorker(execute);
        workers.push(first);
        const second = await createWorker(execute);
        workers.push(second);
        const base = `https://app.fixture/?algorithm=${algorithm}`;
        const responses = await Promise.all(
          Array.from({ length: 11 }, (_, index) =>
            (index % 2 ? first : second).dispatchFetch(base, {
              headers: { "x-forwarded-for": `198.51.100.${index}` },
            }),
          ),
        );
        expect(responses.filter((response) => response.status === 200)).toHaveLength(3);
        expect(responses.filter((response) => response.status === 429)).toHaveLength(8);
        const denied = responses.find((response) => response.status === 429);
        expect(denied?.headers.get("X-RateLimit-Remaining")).toBe("0");
        expect(denied?.headers.get("Retry-After")).not.toBeNull();
        const allowed = responses.find((response) => response.status === 200);
        const body = (await allowed?.json()) as { result: RateLimitResult };
        const receipt = body.result.refundReceipt;
        expect(receipt).toBeDefined();
        for (const expected of [true, false]) {
          const refund = await second.dispatchFetch(`${base}&action=refund`, {
            method: "POST",
            body: JSON.stringify(receipt),
          });
          expect(await refund.json()).toMatchObject({ refunded: expected });
        }
        const isolated = await second.dispatchFetch(`${base}&namespace=other-app`);
        expect(isolated.status).toBe(200);
        expect(isolated.headers.get("X-RateLimit-Remaining")).toBe("2");
        const keys = await redis.keys("*");
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) expect(await redis.pttl(key)).toBeGreaterThan(0);
        // Redis expiration is server-owned. Move absolute expiration into the past without sleeps.
        for (const key of keys) await redis.pexpireat(key, 1);
        const expired = await first.dispatchFetch(base);
        expect(expired.status).toBe(200);
        expect(expired.headers.get("X-RateLimit-Remaining")).toBe("2");
      },
      30_000,
    );

    it.each(["fixed", "sliding", "token-bucket"])(
      "preserves %s window/refill boundaries",
      async (algorithm) => {
        const worker = await createWorker((command) =>
          redis.call(command[0] ?? "", ...command.slice(1)),
        );
        workers.push(worker);
        const base = `https://app.fixture/?algorithm=${algorithm}`;
        for (let i = 0; i < 3; i++)
          expect((await worker.dispatchFetch(`${base}&now=60000`)).status).toBe(200);
        expect((await worker.dispatchFetch(`${base}&now=119999`)).status).toBe(429);
        const after = await worker.dispatchFetch(`${base}&now=120000`);
        expect(after.status).toBe(200);
        expect(after.headers.get("X-RateLimit-Remaining")).toBe(
          algorithm === "token-bucket" ? "0" : "2",
        );
      },
      30_000,
    );
  },
);
