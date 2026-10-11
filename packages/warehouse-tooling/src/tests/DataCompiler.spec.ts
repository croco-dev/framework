import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { c, defineFact } from "@croco/warehouse-core";
import { definePipeline, defineProjection } from "@croco/etl-core/pipeline";
import { compileDataConfig } from "../libs/compiler";
import {
  connectionRef,
  defineDataConfig,
  externalModel,
  oltpSourceRef,
  postgresModel,
} from "../libs/config";
import type { DataConfig } from "../libs/types";

const location = { file: "src/data.ts", line: 3, column: 1 };
const table = pgTable("payments", {
  id: text("id").notNull(),
  at: timestamp("occurred_at", { withTimezone: true }).notNull(),
});
const fact = (description = "Payments") =>
  defineFact("payments", {
    version: 1,
    kind: "transaction",
    scope: "tenant",
    description,
    grain: { description: "One payment", key: ["id"] },
    columns: { id: c.id(), at: c.instant({ precision: "millisecond" }) },
    time: { event: "at" },
    write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
    sourceRefs: ["payments"],
  });
function fixture(description?: string): DataConfig {
  const target = fact(description);
  const schema = {
    format: "jsonl",
    encoding: "utf-8",
    fields: [
      { name: "id", type: "string" },
      { name: "at", type: "date" },
    ],
    limits: { maxBytes: 1024, maxRecords: 10, maxRowBytes: 1024 },
  } as const;
  const definition = definePipeline({
    id: "load_payments",
    version: 1,
    source: {
      id: "payments",
      partitions: [
        {
          id: "part",
          path: "/does/not/exist.jsonl",
          schema,
          revision: "a".repeat(64),
          replayability: "snapshot-stable",
        },
      ],
      coverage: {
        sourceRef: "payments",
        from: "2026-01-01",
        through: "2026-01-02",
        state: "complete",
        gaps: [],
        late: false,
      },
    },
    project: defineProjection({
      source: schema,
      target,
      columns: {
        id: { kind: "column", field: "id" },
        at: { kind: "column", field: "at", cast: "instant" },
      },
    }),
    load: "strict",
    resume: "checkpoint",
  });
  return defineDataConfig({
    connections: [connectionRef("primary", { env: "DATABASE_URL" })],
    sources: [
      oltpSourceRef("payments", table, {
        connection: "primary",
        columns: { id: "id", at: "at" },
        location,
      }),
    ],
    models: [postgresModel(target, { connection: "primary", location })],
    pipelines: [{ definition, location }],
    overlays: {
      production: {
        connections: { primary: { env: "PRODUCTION_DATABASE_URL" } },
        budgets: { rows: 100 },
      },
    },
  });
}
describe("data declaration compiler", () => {
  it("compiles actual pipeline declarations without opening files and deterministically reorders inputs", async () => {
    const base = fixture();
    const input = {
      ...base,
      connections: [...base.connections, connectionRef("secondary", { env: "SECONDARY_URL" })],
      sources: [
        ...base.sources,
        oltpSourceRef("other", table, { connection: "secondary", columns: { id: "id" }, location }),
      ],
    };
    const result = await compileDataConfig(input, { rootDir: "/project-a" });
    expect(
      await compileDataConfig(
        {
          ...input,
          connections: [...input.connections].reverse(),
          models: [...input.models].reverse(),
          sources: [...input.sources].reverse(),
        },
        { rootDir: "/project-b" },
      ),
    ).toEqual(result);
    expect(result.manifest.order).toEqual([
      "metadata:primary",
      "source:payments",
      "model:payments",
      "pipeline:load_payments",
      "source:other",
    ]);
    expect(
      result.manifest.nodes.find((node) => node.id === "source:payments")?.definition,
    ).toMatchObject({
      table: "payments",
      columns: { at: { name: "occurred_at", dataType: "date" } },
    });
    expect(result.files["migrations/candidate.sql"]).toContain("CREATE TABLE");
    expect(result.files["manifest.json"]).not.toContain("/does/not/exist");
    expect(result.manifest.nodes.every((node) => node.location.file === "src/data.ts")).toBe(true);
  });
  it("keeps documentation, semantics and physical hashes separate", async () => {
    const before = (await compileDataConfig(fixture())).manifest.nodes.find(
      (node) => node.kind === "model",
    );
    const after = (await compileDataConfig(fixture("Reworded docs"))).manifest.nodes.find(
      (node) => node.kind === "model",
    );
    expect(after?.semanticHash).toBe(before?.semanticHash);
    expect(after?.physicalHash).toBe(before?.physicalHash);
    expect(after?.documentationHash).not.toBe(before?.documentationHash);
    const overlay = await compileDataConfig(fixture(), { environment: "production" });
    expect(overlay.manifest.nodes).toEqual((await compileDataConfig(fixture())).manifest.nodes);
    expect(overlay.manifest.connections[0].env).toBe("PRODUCTION_DATABASE_URL");
  });
  it("emits no DDL for read-only external bindings and rejects pipeline writes to them", async () => {
    const input = fixture();
    const models = [
      externalModel(fact(), {
        connection: "primary",
        schema: "reporting",
        table: "payments",
        location,
      }),
    ];
    const result = await compileDataConfig({ ...input, models, pipelines: [] });
    expect(result.files["migrations/candidate.sql"]).toBeUndefined();
    await expect(compileDataConfig({ ...input, models })).rejects.toMatchObject({
      reason: "external-write",
    });
  });
  it("rejects missing and cyclic explicit dependencies", async () => {
    const input = fixture();
    const pipeline = input.pipelines[0];
    const withDependency = (dependency: string) => ({
      ...input,
      pipelines: [
        {
          ...pipeline,
          definition: {
            ...pipeline.definition,
            processor: {
              artifactHash: "b".repeat(64),
              dependencies: [dependency],
              process: (row: Readonly<Record<string, string | boolean | null>>) => row,
            },
          },
        },
      ],
    });
    await expect(compileDataConfig(withDependency("model:missing"))).rejects.toMatchObject({
      reason: "missing-dependency",
    });
    await expect(compileDataConfig(withDependency("pipeline:load_payments"))).rejects.toMatchObject(
      { reason: "dependency-cycle" },
    );
  });
  it("rejects conflicting logical versions and missing Drizzle fields", async () => {
    const input = fixture();
    await expect(
      compileDataConfig({
        ...input,
        models: [...input.models, { ...input.models[0], fact: { ...fact(), version: 2 } }],
      }),
    ).rejects.toMatchObject({ reason: "conflicting-version" });
    await expect(
      compileDataConfig({
        ...input,
        sources: [{ ...input.sources[0], columns: { id: "missing" } }],
      }),
    ).rejects.toMatchObject({ reason: "missing-oltp-column" });
  });
  it("rejects unsupported declarations, semantic overlays and credentials", async () => {
    const input = fixture();
    await expect(
      compileDataConfig({ ...input, schedule: "nightly" } as DataConfig),
    ).rejects.toMatchObject({ reason: "unsupported-field" });
    await expect(
      compileDataConfig({ ...input, overlays: { bad: { models: [] } } } as unknown as DataConfig),
    ).rejects.toMatchObject({ reason: "unsupported-field" });
    await expect(
      compileDataConfig({
        ...input,
        connections: [connectionRef("primary", { env: "postgres://secret@host" })],
      }),
    ).rejects.toMatchObject({ reason: "invalid-connection" });
    await expect(
      compileDataConfig({
        ...input,
        models: [{ ...input.models[0], location: { ...location, file: "../secret.ts" } }],
      }),
    ).rejects.toMatchObject({ reason: "invalid-location" });
  });
  it("rejects OLTP ownership collisions, changed types, deleted model keys and multiple migration databases", async () => {
    const input = fixture();
    const compiled = await compileDataConfig(input);
    const physical = compiled.manifest.nodes.find((node) => node.kind === "model")?.definition
      .table as string;
    const collision = pgTable(physical, { id: text("id").notNull() });
    await expect(
      compileDataConfig({
        ...input,
        sources: [
          ...input.sources,
          oltpSourceRef("collision", collision, {
            connection: "primary",
            columns: { id: "id" },
            location,
          }),
        ],
      }),
    ).rejects.toMatchObject({ reason: "duplicate-owner", location });
    const changed = pgTable("payments", {
      id: timestamp("id").notNull(),
      at: timestamp("at").notNull(),
    });
    await expect(
      compileDataConfig({
        ...input,
        sources: [
          oltpSourceRef("payments", changed, {
            connection: "primary",
            columns: { id: "id", at: "at" },
            location,
          }),
        ],
      }),
    ).rejects.toMatchObject({ reason: "source-type-mismatch", location });
    const changedFact = { ...fact(), columns: { at: c.instant({ precision: "millisecond" }) } };
    await expect(
      compileDataConfig({
        ...input,
        models: [postgresModel(changedFact, { connection: "primary", location })],
      }),
    ).rejects.toMatchObject({ reason: "WAREHOUSE_INVALID_GRAIN", location });
    await expect(
      compileDataConfig({
        ...input,
        connections: [...input.connections, connectionRef("second", { env: "SECOND_URL" })],
        models: [
          ...input.models,
          postgresModel({ ...fact(), name: "other" }, { connection: "second", location }),
        ],
      }),
    ).rejects.toMatchObject({ reason: "multiple-migration-connections" });
  });
  it("emits TypeScript schema modules executable with Node type stripping", async () => {
    const result = await compileDataConfig(fixture());
    const directory = await mkdtemp(join(process.cwd(), ".schema-test-"));
    try {
      await mkdir(join(directory, "schema"));
      for (const [path, content] of Object.entries(result.files))
        if (path.startsWith("schema/")) await writeFile(join(directory, path), content);
      const runner = join(directory, "verify.mjs");
      await writeFile(
        runner,
        'import * as schemas from "./schema/index.ts"; for (const exported of Object.values(schemas)) { const schema = await exported.schema; if (!schema.sql.includes("CREATE TABLE") || !schema.tableName) throw new Error("Invalid generated schema"); }',
      );
      expect(() =>
        execFileSync(process.execPath, ["--experimental-strip-types", runner], { stdio: "pipe" }),
      ).not.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("reserves every generated metadata table against application and external ownership", async () => {
    const input = fixture();
    const result = await compileDataConfig(input);
    const metadata = result.manifest.nodes.find((node) => node.kind === "metadata");
    expect(metadata).toMatchObject({
      id: "metadata:primary",
      version: 1,
      definition: {
        owner: "warehouse",
        connection: "primary",
        schema: "public",
        providerVersion: "postgres-facts-v1",
      },
    });
    expect(metadata?.physicalHash).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata?.definition.nativeSqlHash).toMatch(/^[a-f0-9]{64}$/);
    const tables = metadata?.definition.tables as readonly string[];
    expect(tables).toEqual([
      "warehouse_candidates",
      "warehouse_heads",
      "warehouse_models",
      "warehouse_mutations",
      "warehouse_receipts",
      "warehouse_snapshots",
      "warehouse_suppressions",
    ]);
    const sourceLocation = { file: "src/application.ts", line: 10, column: 2 };
    const externalLocation = { file: "src/external.ts", line: 20, column: 4 };
    for (const name of tables) {
      const collision = pgTable(name, { id: text("id").notNull() });
      await expect(
        compileDataConfig({
          ...input,
          sources: [
            ...input.sources,
            oltpSourceRef("reserved", collision, {
              connection: "primary",
              columns: { id: "id" },
              location: sourceLocation,
            }),
          ],
        }),
      ).rejects.toMatchObject({ reason: "duplicate-owner", location: sourceLocation });
      const external = externalModel(
        { ...fact(), name: "external_fact" },
        { connection: "primary", schema: "public", table: name, location: externalLocation },
      );
      await expect(
        compileDataConfig({ ...input, models: [external, ...input.models] }),
      ).rejects.toMatchObject({ reason: "duplicate-owner", location: externalLocation });
      await expect(
        compileDataConfig({ ...input, models: [...input.models, external] }),
      ).rejects.toMatchObject({ reason: "duplicate-owner", location: externalLocation });
    }
    const second = postgresModel(
      { ...fact(), name: "other_model" },
      { connection: "primary", location: { ...location, line: 50 } },
    );
    const multiple = { ...input, models: [...input.models, second] };
    expect(await compileDataConfig(multiple)).toEqual(
      await compileDataConfig({ ...multiple, models: [...multiple.models].reverse() }),
    );
    expect(result.manifest.nodes.find((node) => node.kind === "model")?.dependencies).toContain(
      "metadata:primary",
    );
  });
  it("rejects a source location equal to the parent directory", async () => {
    const input = fixture();
    await expect(
      compileDataConfig({
        ...input,
        sources: [{ ...input.sources[0], location: { ...location, file: ".." } }],
      }),
    ).rejects.toMatchObject({ reason: "invalid-location" });
  });
});
