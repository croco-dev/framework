import { describe, expect, it } from "vitest";
import { createIdempotencyStoreConformanceSuite, InMemoryIdempotencyStore } from "../index";

describe("idempotency store conformance", () => {
  const suite = createIdempotencyStoreConformanceSuite({
    createStore: () => new InMemoryIdempotencyStore<string>(),
  });

  it("exposes adapter conformance cases for the required store semantics", () => {
    expect(suite.cases.map((testCase) => testCase.name)).toEqual([
      "replays a completed result for the same key and fingerprint",
      "preserves a completed result when fail uses the completed reservation",
      "reserves one winner under concurrent attempts for the same key",
      "reports in-flight state while the first reservation is active",
      "throws a Problem when the same key has a different fingerprint",
      "isolates the same key across tenant namespaces",
      "expires records by key and allows a fresh reservation",
      "rejects invalid ttl before reserve state changes",
      "rejects invalid ttl before commit state changes",
      "rejects invalid ttl before fail state changes",
      "separates reservation lease from completed retention",
      "grants a finite default lease when ttl is omitted",
    ]);
  });

  it("passes every conformance case against the in-memory store", async () => {
    for (const testCase of suite.cases) {
      await testCase.run();
    }
  }, 15_000);
});

type HttpResponseSnapshot = {
  readonly status: number;
  readonly body: { readonly orderId: string };
};

describe("idempotency store conformance with structured responses", () => {
  const suite = createIdempotencyStoreConformanceSuite<HttpResponseSnapshot>({
    createStore: () => new InMemoryIdempotencyStore<HttpResponseSnapshot>(),
    createResponse: () => ({ status: 201, body: { orderId: "order-1" } }),
  });

  for (const testCase of suite.cases) {
    it(testCase.name, testCase.run, 15_000);
  }

  it.each([
    [
      "replays a completed result for the same key and fingerprint",
      "replay must return the committed response",
    ],
    [
      "preserves a completed result when fail uses the completed reservation",
      "fail must preserve the committed response",
    ],
    [
      "separates reservation lease from completed retention",
      "replay must preserve the completed response",
    ],
  ])(
    "rejects changed response contents: %s",
    async (name, message) => {
      const failingSuite = createIdempotencyStoreConformanceSuite<HttpResponseSnapshot>({
        createStore: () => {
          const store = new InMemoryIdempotencyStore<HttpResponseSnapshot>();
          const reserve = store.reserve.bind(store);
          store.reserve = async (...args) => {
            const result = await reserve(...args);
            return result.outcome === "replay"
              ? { ...result, response: { status: 201, body: { orderId: "wrong-order" } } }
              : result;
          };
          return store;
        },
        createResponse: () => ({ status: 201, body: { orderId: "order-1" } }),
      });
      const testCase = failingSuite.cases.find((candidate) => candidate.name === name);
      if (!testCase) {
        throw new Error(`Missing conformance case: ${name}`);
      }
      const failure = testCase.run();
      await expect(failure).rejects.toThrow(message);
      await expect(failure).rejects.toThrow("order-1");
      await expect(failure).rejects.toThrow("wrong-order");
    },
    15_000,
  );
});
