import { describe, expect, it } from "vitest";
import {
  c,
  canonicalPayload,
  compileFact,
  defineFact,
  encodeIdentity,
  parseDescriptor,
  serializeDescriptor,
  validateRow,
  WarehouseContractError,
} from "../index";

const captures = defineFact("payment_captures", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One confirmed capture in a tenant", key: ["captureId"] },
  columns: {
    captureId: c.id(),
    orderId: c.id(),
    customerId: c.subjectId("customer", { sensitivity: "sensitive" }),
    capturedAt: c.instant({ precision: "millisecond" }),
    currency: c.currencyCode(),
    amountMinor: c.moneyMinor({ currency: "currency", min: 0n }),
  },
  time: { event: "capturedAt" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
});

const search = defineFact("search_daily", {
  version: 1,
  kind: "aggregate",
  scope: "tenant",
  grain: {
    description: "One local calendar day, index, and query",
    key: ["day", "indexId", "queryId"],
  },
  columns: {
    day: c.date({ zone: "America/Los_Angeles" }),
    indexId: c.id(),
    queryId: c.id({ sensitivity: "sensitive" }),
    searches: c.int64({ min: 0n }),
    clicks: c.nullable(c.int64({ min: 0n })),
    clickRate: c.nullable(c.decimal({ precision: 8, scale: 4 })),
  },
  time: { event: "day" },
  write: { mode: "replace-range", duplicate: "ignore-identical", conflict: "reject" },
  aggregate: {
    date: "day",
    series: ["indexId"],
    dimensions: ["queryId"],
    measures: {
      searches: { unit: "search", reaggregate: "sum" },
      clicks: { unit: "click", reaggregate: "sum" },
      clickRate: { unit: "ratio", reaggregate: "none" },
    },
  },
});

const captureRow = {
  captureId: "capture-1",
  orderId: "order-1",
  customerId: "secret-customer",
  capturedAt: "2026-09-27T23:59:59.999Z",
  currency: "KRW",
  amountMinor: 9223372036854775807n,
};

describe("warehouse declarations and codec", () => {
  it("uses one capture declaration for deterministic IR, JSON, and row validation", async () => {
    const descriptor = await compileFact(captures);
    const parsed = await parseDescriptor(serializeDescriptor(descriptor));
    expect(parsed).toEqual(descriptor);
    expect(await compileFact(captures)).toEqual(descriptor);
    expect(descriptor.columns.customerId.sensitivity).toBe("sensitive");
    expect(validateRow(parsed, captureRow).amountMinor).toBe("9223372036854775807");
    expect(validateRow(parsed, { ...captureRow, amountMinor: "9223372036854775807" })).toEqual(
      validateRow(parsed, captureRow),
    );
    expect(() =>
      validateRow(parsed, { ...captureRow, amountMinor: Number("9223372036854775807") }),
    ).toThrow(WarehouseContractError);
  });

  it("distinguishes semantic changes from descriptions and source references", async () => {
    const initial = await compileFact(captures);
    const documentation = await compileFact({
      ...captures,
      description: "Updated guide",
      sourceRefs: ["src/new.ts"],
    });
    const changed = await compileFact({
      ...captures,
      columns: { ...captures.columns, customerId: c.subjectId("account") },
    });
    expect(documentation.semanticHash).toBe(initial.semanticHash);
    expect(changed.semanticHash).not.toBe(initial.semanticHash);
    const tampered = JSON.parse(serializeDescriptor(initial)) as Record<string, unknown>;
    tampered.scope = "application";
    await expect(parseDescriptor(JSON.stringify(tampered))).rejects.toThrow(WarehouseContractError);
  });

  it("encodes typed grain tuples without delimiter collisions or execution metadata", async () => {
    const pair = defineFact("external_capture", {
      version: 1,
      kind: "transaction",
      scope: "application",
      grain: { description: "Provider and external record", key: ["provider", "externalId"] },
      columns: {
        provider: c.id(),
        externalId: c.id(),
        occurredAt: c.instant({ precision: "second" }),
      },
      time: { event: "occurredAt" },
      write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
    });
    const descriptor = await compileFact(pair);
    const scope = { application: "shop", environment: "test" };
    const first = { provider: "a|b", externalId: "c", occurredAt: "2026-09-27T00:00:00Z" };
    const second = { provider: "a", externalId: "b|c", occurredAt: first.occurredAt };
    expect(encodeIdentity(descriptor, first, scope)).not.toBe(
      encodeIdentity(descriptor, second, scope),
    );
    expect(canonicalPayload(descriptor, { ...first })).toBe(canonicalPayload(descriptor, first));
    expect(encodeIdentity(descriptor, first, scope)).toContain("warehouse-identity");
  });

  it("canonicalizes field order and rejects missing grain keys", async () => {
    const descriptor = await compileFact(captures);
    const reversed = Object.fromEntries(Object.entries(captureRow).reverse());
    expect(canonicalPayload(descriptor, reversed)).toBe(canonicalPayload(descriptor, captureRow));
    const { captureId: _captureId, ...missingGrain } = captureRow;
    expect(() => validateRow(descriptor, missingGrain)).toThrow("WAREHOUSE_MISSING_FIELD");
  });

  it("preserves sparse aggregate values, exact decimal scale, and local date", async () => {
    const descriptor = await compileFact(search);
    const row = {
      day: "2024-02-29",
      indexId: "products",
      queryId: "coats",
      searches: 200n,
      clicks: null,
      clickRate: null,
    };
    expect(validateRow(descriptor, row)).toEqual({
      day: "2024-02-29",
      indexId: "products",
      queryId: "coats",
      searches: "200",
      clicks: null,
      clickRate: null,
    });
    expect(validateRow(descriptor, { ...row, clicks: "12", clickRate: "0.06" }).clickRate).toBe(
      "0.0600",
    );
    expect(() => validateRow(descriptor, { ...row, day: "2025-02-29" })).toThrow(
      WarehouseContractError,
    );
    expect(() => validateRow(descriptor, { ...row, clickRate: Number.NaN })).toThrow(
      WarehouseContractError,
    );
    expect(() => validateRow(descriptor, { ...row, clicks: undefined })).toThrow(
      WarehouseContractError,
    );
  });

  it("rejects invalid references, unsupported kinds and precision at runtime", () => {
    const { name: _name, ...options } = captures;
    const invalid = (value: unknown) => defineFact("invalid_fact", value as never);
    expect(() =>
      invalid({ ...options, columns: { ...captures.columns, captureId: c.nullable(c.id()) } }),
    ).toThrow("WAREHOUSE_INVALID_GRAIN");
    expect(() =>
      invalid({ ...options, grain: { description: "Missing key", key: ["missing"] } }),
    ).toThrow("WAREHOUSE_INVALID_GRAIN");
    expect(() => invalid({ ...options, time: { event: "orderId" } })).toThrow(
      "WAREHOUSE_INVALID_TIME_REFERENCE",
    );
    expect(() =>
      invalid({
        ...options,
        columns: { ...captures.columns, amountMinor: c.moneyMinor({ currency: "orderId" }) },
      }),
    ).toThrow("WAREHOUSE_INVALID_CURRENCY_REFERENCE");
    expect(() => invalid({ ...options, kind: "periodic" })).toThrow("WAREHOUSE_UNSUPPORTED_KIND");
    expect(() =>
      invalid({
        ...options,
        columns: { ...captures.columns, capturedAt: { type: "instant", precision: "nano" } },
      }),
    ).toThrow("WAREHOUSE_UNSUPPORTED_PRECISION");
    expect(() =>
      invalid({
        ...options,
        columns: {
          ...captures.columns,
          customerId: { type: "subject", subject: "customer", sensitivity: ["sensitive"] },
        },
      }),
    ).toThrow("WAREHOUSE_INVALID_SENSITIVITY");
    expect(() =>
      invalid({
        ...options,
        columns: {
          ...captures.columns,
          capturedAt: { type: "instant", precision: ["millisecond"] },
        },
      }),
    ).toThrow("WAREHOUSE_UNSUPPORTED_PRECISION");
  });

  it("rejects malformed descriptor enums and fixed-offset calendar zones", async () => {
    const descriptor = await compileFact(search);
    for (const zone of ["+01:00", "Etc/GMT+1", "Etc/GMT-2"]) {
      const invalidZone = {
        ...search,
        columns: { ...search.columns, day: c.date({ zone }) },
      };
      await expect(compileFact(invalidZone as never)).rejects.toThrow("WAREHOUSE_INVALID_ZONE");
    }
    const invalid = JSON.parse(serializeDescriptor(descriptor)) as {
      columns: Record<string, Record<string, unknown>>;
    };
    invalid.columns.queryId.sensitivity = ["sensitive"];
    await expect(parseDescriptor(JSON.stringify(invalid))).rejects.toThrow(
      "WAREHOUSE_INVALID_SENSITIVITY",
    );
  });

  it("rejects integer overflow, decimal precision loss, and invalid instants", async () => {
    const descriptor = await compileFact(search);
    const row = {
      day: "2024-02-29",
      indexId: "products",
      queryId: "coats",
      searches: 1n,
      clicks: null,
      clickRate: null,
    };
    expect(() => validateRow(descriptor, { ...row, searches: "9223372036854775808" })).toThrow(
      "WAREHOUSE_INTEGER_OVERFLOW",
    );
    expect(() => validateRow(descriptor, { ...row, clickRate: "10000.0000" })).toThrow(
      "WAREHOUSE_DECIMAL_PRECISION",
    );
    expect(() => validateRow(descriptor, { ...row, clickRate: "0.00001" })).toThrow(
      "WAREHOUSE_DECIMAL_PRECISION",
    );

    const signed = defineFact("signed_measure", {
      version: 1,
      kind: "transaction",
      scope: "application",
      grain: { description: "One signed measure", key: ["id"] },
      columns: { id: c.id(), at: c.instant({ precision: "microsecond" }), value: c.int64() },
      time: { event: "at" },
      write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
    });
    expect(
      validateRow(signed, {
        id: "a",
        at: "2024-02-29T23:59:59.123456Z",
        value: "-9223372036854775808",
      }).value,
    ).toBe("-9223372036854775808");
    expect(() =>
      validateRow(signed, {
        id: "a",
        at: "2024-02-29T23:59:59.123456Z",
        value: "-9223372036854775809",
      }),
    ).toThrow("WAREHOUSE_INTEGER_OVERFLOW");
    expect(() =>
      validateRow(signed, { id: "a", at: "2024-02-29T23:59:59.12345Z", value: 0n }),
    ).toThrow("WAREHOUSE_INVALID_INSTANT");
    expect(() =>
      validateRow(signed, { id: "a", at: "2025-02-29T23:59:60.123456Z", value: 0n }),
    ).toThrow("WAREHOUSE_INVALID_INSTANT");
  });

  it("blocks scope and system-field spoofing without printing sensitive values", async () => {
    const descriptor = await compileFact(captures);
    const secret = "super-secret-customer";
    let diagnostic = "";
    try {
      validateRow(descriptor, { ...captureRow, customerId: secret, runId: "forged" });
    } catch (error) {
      diagnostic = String(error);
    }
    expect(diagnostic).not.toContain(secret);
    expect(diagnostic).toContain("WAREHOUSE_UNKNOWN_FIELD");
    expect(() =>
      encodeIdentity(descriptor, captureRow, { application: "shop", environment: "test" }),
    ).toThrow(WarehouseContractError);
    const { name: _name, ...options } = captures;
    expect(() =>
      defineFact("invalid_fact", {
        ...options,
        columns: { ...captures.columns, tenantId: c.id() },
      } as never),
    ).toThrow("WAREHOUSE_RESERVED_COLUMN");
  });
});
