import { afterEach, describe, expect, it } from "vitest";
import type { Miniflare } from "miniflare";
import { createWorker } from "./fixtures/workerHarness";

const workers: Miniflare[] = [];
afterEach(async () => {
  await Promise.all(workers.splice(0).map((worker) => worker.dispose()));
});

describe("Upstash HTTP adapter in workerd without Node compatibility", () => {
  it.each(["fixed", "sliding", "token-bucket"])(
    "executes %s through the Cloudflare SDK and preserves headers",
    async (algorithm) => {
      const commands: string[][] = [];
      const worker = await createWorker(async (command) => {
        commands.push(command);
        return [1, 1, 2, "10000"];
      });
      workers.push(worker);
      const response = await worker.dispatchFetch(`https://app.fixture/?algorithm=${algorithm}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("3");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("2");
      expect(await response.json()).toMatchObject({
        result: { success: true, remaining: 2 },
        errors: [],
      });
      expect(commands).toHaveLength(1);
      expect(commands[0]?.[0].toUpperCase()).toBe("EVAL");
    },
  );

  it.each([302, 401, 403, 429, 503])(
    "preserves failOpen/failClosed and redacts HTTP %i failures",
    async (status) => {
      const worker = await createWorker(async () => {
        throw new Error("Must not execute");
      }, status);
      workers.push(worker);
      for (const failOpen of [false, true]) {
        const response = await worker.dispatchFetch(`https://app.fixture/?failOpen=${failOpen}`);
        expect(response.status).toBe(failOpen ? 200 : 429);
        const body = await response.text();
        expect(body).not.toContain("fixture-secret-token");
        expect(JSON.parse(body)).toMatchObject({
          result: { degraded: true, success: failOpen },
          errors: [
            {
              code: "ratelimit-upstash/upstream-failed",
              retryable: status === 429 || status >= 500,
              upstreamStatus: status,
            },
          ],
        });
      }
    },
  );
});
