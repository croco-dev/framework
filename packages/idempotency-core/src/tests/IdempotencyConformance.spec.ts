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
      "keeps expiration absent when ttl is omitted",
    ]);
  });

  it("passes every conformance case against the in-memory store", async () => {
    for (const testCase of suite.cases) {
      await testCase.run();
    }
  });
});
