import { describe, expect, expectTypeOf, it } from "vitest";
import { snapshotMeterMetadata } from "../libs/meterMetadata";
import { InvalidMeterMetadataProblem } from "../libs/problems/InvalidMeterMetadataProblem";
import type { MeterDefinitionMetadata } from "../libs/types";

const meter = { tenantId: "tenant-1", meterId: "api_calls" };

describe("meter definition metadata", () => {
  it("accepts JSON data, Date values, null-prototype records and shared acyclic values", () => {
    const shared = { plan: "starter" };
    const metadata = Object.assign(Object.create(null) as MeterDefinitionMetadata, {
      text: "ready",
      count: 17,
      enabled: true,
      empty: null,
      entries: [shared, new Date("2026-01-02T03:04:05Z")],
      second: shared,
      ["__proto__"]: { safe: true },
    });
    expect(() => snapshotMeterMetadata(metadata, meter)).not.toThrow();
    expectTypeOf<{ when: Date; nested: { plans: string[] } }>().toExtend<MeterDefinitionMetadata>();
    expectTypeOf<{ flags: readonly [true, null] }>().toExtend<MeterDefinitionMetadata>();
    expectTypeOf<{ callback: () => void }>().not.toExtend<MeterDefinitionMetadata>();
    expectTypeOf<{ entries: Map<string, string> }>().not.toExtend<MeterDefinitionMetadata>();
  });

  it.each([
    ["function", () => undefined],
    ["undefined", undefined],
    ["symbol", Symbol("private")],
    ["bigint", BigInt(1)],
    ["NaN", Number.NaN],
    ["infinity", Infinity],
    ["map", new Map()],
    ["set", new Set()],
    ["invalid date", new Date(Number.NaN)],
    [
      "class instance",
      new (class Value {
        count = 1;
      })(),
    ],
    ["sparse array", Array(2)],
    ["array property", Object.assign([1], { extra: 2 })],
  ])("rejects nested %s with a stable Problem and without disclosing values", (_label, value) => {
    try {
      snapshotMeterMetadata({ nested: { value } }, meter);
      expect.fail("Expected invalid metadata");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidMeterMetadataProblem);
      expect(error).toMatchObject({
        code: "metering/invalid-meter-metadata",
        extensions: {
          tenantId: "tenant-1",
          meterId: "api_calls",
          path: "/metadata/nested/value",
        },
      });
    }
  });

  it.each([null, [], new Date(), "string", 12])(
    "rejects a non-object metadata root %s",
    (value) => {
      expect(() => snapshotMeterMetadata(value, meter)).toThrow(InvalidMeterMetadataProblem);
    },
  );

  it("rejects cycles but accepts repeated acyclic references", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => snapshotMeterMetadata(cyclic, meter)).toThrow(InvalidMeterMetadataProblem);
    const shared = { value: 3 };
    expect(() => snapshotMeterMetadata({ a: shared, b: shared }, meter)).not.toThrow();
  });

  it("rejects accessors without executing them and escapes diagnostic paths", () => {
    let reads = 0;
    const metadata = Object.defineProperty({}, "a/b~c", {
      enumerable: true,
      get() {
        reads++;
        return "secret";
      },
    });
    expect(() => snapshotMeterMetadata(metadata, meter)).toThrow(InvalidMeterMetadataProblem);
    expect(reads).toBe(0);
    try {
      snapshotMeterMetadata(metadata, meter);
    } catch (error) {
      expect(error).toMatchObject({ extensions: { path: "/metadata/a~1b~0c" } });
      expect(String(error)).not.toContain("secret");
    }
  });

  it("rejects hidden and symbol properties instead of silently discarding them", () => {
    for (const value of [
      Object.defineProperty({}, "hidden", { value: 1 }),
      { [Symbol("key")]: 1 },
    ]) {
      expect(() => snapshotMeterMetadata(value, meter)).toThrow(InvalidMeterMetadataProblem);
    }
  });

  it.each([
    ["Map", () => new Map([["quota", 17]])],
    ["Set", () => new Set([17])],
    ["RegExp", () => /opaque/],
    ["typed array", () => new Uint8Array([17])],
    ["boxed string", () => Object("opaque")],
  ] as const)("rejects branded %s values with manipulated prototypes", (_label, create) => {
    for (const prototype of [null, Object.prototype]) {
      const value = Object.setPrototypeOf(create(), prototype);
      expect(() => snapshotMeterMetadata({ value }, meter)).toThrow(InvalidMeterMetadataProblem);
    }
  });

  it.each([null, Object.prototype])(
    "rejects Date roots with manipulated prototypes",
    (prototype) => {
      const value = Object.setPrototypeOf(new Date("2026-01-02T03:04:05Z"), prototype);
      expect(() => snapshotMeterMetadata(value, meter)).toThrow(InvalidMeterMetadataProblem);
    },
  );

  it.each([null, Object.prototype])(
    "rejects custom Date data before copying a manipulated prototype",
    (prototype) => {
      const value = Object.setPrototypeOf(
        Object.assign(new Date("2026-01-02T03:04:05Z"), { policy: { plan: "starter" } }),
        prototype,
      );
      expect(() => snapshotMeterMetadata({ when: value }, meter)).toThrow(
        InvalidMeterMetadataProblem,
      );
    },
  );

  it("converts opaque introspection failures into the metadata Problem", () => {
    const value = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new TypeError("private payload");
        },
      },
    );
    expect(() => snapshotMeterMetadata(value, meter)).toThrow(InvalidMeterMetadataProblem);
  });
  it("rejects custom Date properties including hidden constructors", () => {
    const valid = Object.defineProperty(new Date("2026-01-02T03:04:05Z"), "constructor", {
      value: Date,
    });
    expect(() => snapshotMeterMetadata({ when: valid }, meter)).toThrow(
      InvalidMeterMetadataProblem,
    );
    const custom = Object.assign(new Date(), { callback: () => "private" });
    expect(() => snapshotMeterMetadata({ when: custom }, meter)).toThrow(
      InvalidMeterMetadataProblem,
    );
  });
  it("returns a detached snapshot and rejects opaque proxies before later reads", () => {
    const input = { nested: { value: 17 }, when: new Date("2026-01-02T03:04:05Z") };
    const snapshot = snapshotMeterMetadata(input, meter);
    (snapshot.nested as { value: number }).value = 999;
    (snapshot.when as Date).setUTCFullYear(2040);
    expect(input.nested.value).toBe(17);
    expect(input.when.toISOString()).toBe("2026-01-02T03:04:05.000Z");
    const proxy = new Proxy(
      { value: 17 },
      {
        get() {
          return () => "private";
        },
      },
    );
    expect(() => snapshotMeterMetadata(proxy, meter)).toThrow(InvalidMeterMetadataProblem);
  });
});
