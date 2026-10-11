import { c, defineFact, WarehouseContractError } from "@croco/warehouse-core";
import { describe, expect, it } from "vitest";
import { defineProjection, ProjectionProblem } from "../pipeline/projection";
import type { ProjectionColumns } from "../pipeline/projection";
import type { SourceSchema } from "../source/types";

const source = {
  format: "jsonl",
  encoding: "utf-8",
  fields: [
    { name: "id", type: "string" },
    { name: "count", type: "number" },
    { name: "at", type: "date" },
    { name: "label", type: "string", nullable: true },
  ],
  limits: { maxBytes: 1024, maxRecords: 20, maxRowBytes: 128 },
} as const satisfies SourceSchema;
const target = defineFact("import_rows", {
  version: 1,
  kind: "transaction",
  scope: "tenant",
  grain: { description: "One source row", key: ["id"] },
  columns: {
    id: c.id(),
    count: c.int64(),
    at: c.instant({ precision: "millisecond" }),
    label: c.string(),
    note: c.nullable(c.string()),
  },
  time: { event: "at" },
  write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
});
const columns = {
  id: { kind: "column", field: "id" },
  count: { kind: "column", field: "count", cast: "integer" },
  at: { kind: "column", field: "at", cast: "instant" },
  label: { kind: "column", field: "label", default: "unlabelled" },
  note: { kind: "constant", value: null },
} as const satisfies ProjectionColumns<typeof source, typeof target>;
const row = { id: "a", count: 12, at: new Date("2026-10-01T00:00:00.000Z"), label: null };

describe("declarative projection", () => {
  it("projects normalized source rows through warehouse validation with explicit defaults and nulls", () => {
    const projection = defineProjection({ source, target, columns });
    expect(projection.project(row)).toEqual({
      id: "a",
      count: "12",
      at: "2026-10-01T00:00:00.000Z",
      label: "unlabelled",
      note: null,
    });
    expect(() => projection.project({ ...row, id: "" })).toThrow(WarehouseContractError);
    expect(() => projection.project({ ...row, count: 1.5 })).toThrow(ProjectionProblem);
    expect(() => projection.project({ ...row, count: Number.MAX_SAFE_INTEGER + 1 })).toThrow(
      ProjectionProblem,
    );
  });

  it("rejects nonexistent source references before projecting and in the type contract", () => {
    expect(() =>
      defineProjection({
        source,
        target,
        columns: {
          ...columns,
          // @ts-expect-error Source references must name a declared field.
          id: { kind: "column", field: "missing" },
        },
      }),
    ).toThrow(expect.objectContaining({ reason: "missing-source-field", field: "missing" }));
  });

  it("requires every target field explicitly even when nullable", () => {
    const { note: _note, ...missing } = columns;
    // @ts-expect-error Every target field needs an explicit expression.
    expect(() => defineProjection({ source, target, columns: missing })).toThrow(
      expect.objectContaining({ reason: "missing-target-field" }),
    );
  });

  it("rejects unknown target fields and implicit numeric casts before execution", () => {
    expect(() =>
      defineProjection({
        source,
        target,
        // @ts-expect-error Projection cannot add fields outside the fact contract.
        columns: { ...columns, tenant: { kind: "constant", value: "other" } },
      }),
    ).toThrow(expect.objectContaining({ reason: "unknown-target-field" }));
    expect(() =>
      defineProjection({
        source,
        target,
        columns: { ...columns, count: { kind: "column", field: "count" } },
      }),
    ).toThrow(expect.objectContaining({ reason: "unsafe-cast" }));
    expect(() =>
      defineProjection({
        source,
        target,
        columns: { ...columns, id: { kind: "column", field: "count", cast: "integer" } },
      }),
    ).toThrow(expect.objectContaining({ reason: "unsafe-cast" }));
  });

  it("requires explicit null handling and does not default missing fields", () => {
    expect(() =>
      defineProjection({
        source,
        target,
        columns: { ...columns, label: { kind: "column", field: "label" } },
      }),
    ).toThrow(expect.objectContaining({ reason: "null-not-allowed" }));
    const { label: _label, ...missing } = row;
    expect(() => defineProjection({ source, target, columns }).project(missing)).toThrow(
      expect.objectContaining({ reason: "missing-source-field" }),
    );
  });

  it("hashes immutable artifacts deterministically independently of property order", async () => {
    const projection = defineProjection({ source, target, columns });
    const reversed = Object.fromEntries(Object.entries(columns).reverse()) as typeof columns;
    expect(await projection.artifactHash()).toMatch(/^[a-f0-9]{64}$/);
    expect(await defineProjection({ source, target, columns: reversed }).artifactHash()).toBe(
      await projection.artifactHash(),
    );
    expect(
      await defineProjection({
        source,
        target,
        columns: { ...columns, note: { kind: "constant", value: "changed" } },
      }).artifactHash(),
    ).not.toBe(await projection.artifactHash());
    expect(Object.isFrozen(projection.columns)).toBe(true);
  });
});
