import { describe, expect, it } from "vitest";
import { c, compileFact, defineFact, WarehouseContractError } from "../index";
import { FixtureImporter } from "../runtime";

const captures = defineFact("capture", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One capture", key: ["id"] },
  columns: {
    id: c.id(),
    at: c.instant({ precision: "second" }),
    amount: c.moneyMinor({ currency: "currency" }),
    currency: c.currencyCode(),
  },
  time: { event: "at" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
});

const search = defineFact("search_by_day", {
  version: 1,
  kind: "aggregate",
  scope: "tenant",
  grain: { description: "A day, series, and query", key: ["day", "series", "query"] },
  columns: {
    day: c.date({ zone: "Asia/Seoul" }),
    series: c.id(),
    query: c.id(),
    searches: c.int64({ min: 0n }),
    clicks: c.nullable(c.int64({ min: 0n })),
  },
  time: { event: "day" },
  write: { mode: "replace-range", duplicate: "ignore-identical", conflict: "reject" },
  aggregate: {
    date: "day",
    series: ["series"],
    dimensions: ["query"],
    measures: {
      searches: { unit: "search", reaggregate: "sum" },
      clicks: { unit: "click", reaggregate: "sum" },
    },
  },
});

const capture = { id: "a", at: "2026-09-27T00:00:00Z", amount: 100n, currency: "USD" };

describe("bounded fixture importer", () => {
  it("deduplicates identical append rows and rejects conflicting batches atomically", async () => {
    const descriptor = await compileFact(captures);
    let tenant = "tenant-a";
    const importer = new FixtureImporter(
      descriptor,
      () => ({ application: "app", environment: "test", tenant }),
      3,
    );
    expect(importer.importRows([capture], { executionId: "first" })).toEqual({
      inserted: 1,
      identical: 0,
    });
    expect(importer.importRows([{ ...capture, amount: "100" }], { executionId: "rerun" })).toEqual({
      inserted: 0,
      identical: 1,
    });
    expect(importer.snapshot()[0].metadata.executionId).toBe("first");
    expect(() =>
      importer.importRows([
        { ...capture, id: "b" },
        { ...capture, amount: 101n },
      ]),
    ).toThrow(WarehouseContractError);
    expect(importer.snapshot()).toHaveLength(1);
    expect(() => importer.importRows([{ ...capture, tenantId: "tenant-b" }])).toThrow(
      WarehouseContractError,
    );
    tenant = "tenant-b";
    expect(importer.snapshot()).toHaveLength(0);
    expect(importer.importRows([capture])).toEqual({ inserted: 1, identical: 0 });
    expect(importer.snapshot()).toHaveLength(1);
    tenant = "tenant-a";
    expect(importer.snapshot()).toHaveLength(1);
  });

  it("replaces only one scope, date range, and series, including an empty replacement", async () => {
    const descriptor = await compileFact(search);
    let tenant = "tenant-a";
    const importer = new FixtureImporter(descriptor, () => ({
      application: "app",
      environment: "test",
      tenant,
    }));
    const a = { day: "2026-09-26", series: "catalog", query: "coat", searches: 9n, clicks: null };
    const b = { ...a, query: "jacket", clicks: 2n };
    const otherSeries = { ...a, series: "help" };
    importer.replaceRange({ from: a.day, through: a.day, series: { series: "catalog" } }, [a, b]);
    importer.replaceRange({ from: a.day, through: a.day, series: { series: "help" } }, [
      otherSeries,
    ]);
    tenant = "tenant-b";
    importer.replaceRange({ from: a.day, through: a.day, series: { series: "catalog" } }, [a]);
    tenant = "tenant-a";
    expect(() =>
      importer.replaceRange({ from: a.day, through: a.day, series: { series: "catalog" } }, [
        { ...a, searches: 10n },
        { ...b, series: "help" },
      ]),
    ).toThrow(WarehouseContractError);
    expect(importer.snapshot()).toHaveLength(3);
    expect(
      importer.replaceRange({ from: a.day, through: a.day, series: { series: "catalog" } }, []),
    ).toEqual({ inserted: 0, removed: 2, identical: 0 });
    expect(importer.snapshot()).toHaveLength(1);
    tenant = "tenant-b";
    expect(importer.snapshot()).toHaveLength(1);
  });

  it("rejects over-limit and malformed metadata batches before mutating the fixture", async () => {
    const descriptor = await compileFact(captures);
    const scope = () => ({ application: "app", environment: "test", tenant: "tenant-a" });
    const importer = new FixtureImporter(descriptor, scope, 1);
    importer.importRows([capture]);
    expect(() => importer.importRows([{ ...capture, id: "b" }])).toThrow("WAREHOUSE_FIXTURE_LIMIT");
    expect(() =>
      importer.importRows([capture], { executionId: "run", tenant: "forged" } as never),
    ).toThrow("WAREHOUSE_INVALID_METADATA");
    expect(importer.snapshot()).toHaveLength(1);
    const invalidScope = new FixtureImporter(descriptor, () => ({
      application: "app",
      environment: "test",
    }));
    expect(() => invalidScope.importRows([capture])).toThrow("WAREHOUSE_INVALID_SCOPE");
  });
});
