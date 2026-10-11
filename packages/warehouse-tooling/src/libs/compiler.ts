import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { Problem } from "@croco/problems-core";
import { decodeSource } from "@croco/etl-core/source";
import { definePipeline, defineProjection } from "@croco/etl-core/pipeline";
import { compileFact, serializeDescriptor } from "@croco/warehouse-core";
import {
  generatePostgresFactSchema,
  generatePostgresWarehouseSchema,
} from "@croco/warehouse-postgres/facts";
import { DataConfigProblem } from "./DataConfigProblem";
import type { CompiledDataConfig, DataConfig, DataNode, SourceLocation } from "./types";

const METADATA_TABLES = [
  "warehouse_candidates",
  "warehouse_heads",
  "warehouse_models",
  "warehouse_mutations",
  "warehouse_receipts",
  "warehouse_snapshots",
  "warehouse_suppressions",
] as const;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return JSON.stringify(value);
  throw new DataConfigProblem("unsupported-value", "Declarations must contain finite JSON values.");
}
const hash = (value: unknown): string =>
  createHash("sha256").update(canonical(value)).digest("hex");
function assert(condition: unknown, reason: string, detail: string): asserts condition {
  if (!condition) throw new DataConfigProblem(reason, detail);
}
function keys(value: object, allowed: readonly string[], label: string): void {
  for (const key of Object.keys(value))
    assert(
      allowed.includes(key),
      "unsupported-field",
      `${label}.${key} is unsupported; remove it or use a supported declaration.`,
    );
}
function location(value: SourceLocation, rootDir: string): SourceLocation {
  keys(value, ["file", "line", "column"], "location");
  const file = relative(rootDir, resolve(rootDir, value.file)).split("\\").join("/");
  assert(
    file &&
      file !== ".." &&
      !file.startsWith("../") &&
      !isAbsolute(file) &&
      Array.from(file).every((character) => character.charCodeAt(0) >= 32) &&
      Number.isSafeInteger(value.line) &&
      value.line > 0 &&
      Number.isSafeInteger(value.column) &&
      value.column > 0,
    "invalid-location",
    "Provide a project-relative source location with positive line and column.",
  );
  return { file, line: value.line, column: value.column };
}
function identifier(value: string, label: string): void {
  assert(
    typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.-]*$/.test(value),
    "invalid-id",
    `${label} must be a stable identifier.`,
  );
}

export async function compileDataConfig(
  config: DataConfig,
  options: { readonly environment?: string; readonly rootDir?: string } = {},
): Promise<CompiledDataConfig> {
  keys(config, ["connections", "sources", "models", "pipelines", "overlays"], "config");
  const rootDir = resolve(options.rootDir ?? process.cwd());
  let currentLocation: SourceLocation | undefined;
  try {
    const connections = new Map<string, { id: string; env: string }>();
    for (const connection of config.connections) {
      keys(connection, ["id", "env"], "connection");
      identifier(connection.id, "Connection id");
      assert(
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(connection.env),
        "invalid-connection",
        `Connection '${connection.id}' must reference an environment variable name, never a URL or credential.`,
      );
      assert(
        !connections.has(connection.id),
        "duplicate-connection",
        `Connection '${connection.id}' is declared twice.`,
      );
      connections.set(connection.id, { ...connection });
    }
    const overlay = options.environment ? config.overlays?.[options.environment] : undefined;
    assert(
      !options.environment || overlay,
      "missing-overlay",
      `Environment '${options.environment}' has no declared overlay.`,
    );
    for (const [name, entry] of Object.entries(config.overlays ?? {})) {
      keys(entry, ["connections", "budgets"], `overlay.${name}`);
      for (const [id, connection] of Object.entries(entry.connections ?? {})) {
        keys(connection, ["env"], `overlay.${name}.${id}`);
        assert(
          connections.has(id) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(connection.env),
          "invalid-overlay",
          `Overlay '${name}' must reference an existing connection and an environment variable name.`,
        );
      }
      for (const budget of Object.values(entry.budgets ?? {}))
        assert(
          Number.isSafeInteger(budget) && budget > 0,
          "invalid-budget",
          `Overlay '${name}' budgets must be positive integers.`,
        );
    }
    for (const [id, value] of Object.entries(overlay?.connections ?? {}))
      connections.set(id, { id, env: value.env });
    const nodes = new Map<string, DataNode>();
    const files: Record<string, string> = {};
    const statements: string[] = [];
    const owners = new Set<string>();
    const ownedConnections = new Set<string>();
    const sourceTables = new Map<string, SourceLocation>();
    const add = (node: DataNode): void => {
      const previous = nodes.get(node.id);
      assert(
        !previous,
        previous?.version === node.version ? "duplicate-node" : "conflicting-version",
        `Logical node '${node.id}' is declared more than once; select exactly one version.`,
      );
      nodes.set(node.id, node);
    };
    const bind = (connection: string): void =>
      assert(
        connections.has(connection),
        "missing-connection",
        `Connection '${connection}' is missing; declare connectionRef first.`,
      );
    for (const source of config.sources) {
      currentLocation = location(source.location, rootDir);
      keys(source, ["id", "table", "connection", "columns", "location"], "source");
      identifier(source.id, "Source id");
      bind(source.connection);
      const table = getTableConfig(source.table);
      const columns = getTableColumns(source.table);
      const mapped = Object.fromEntries(
        Object.entries(source.columns).map(([field, key]) => {
          const column = columns[key];
          assert(
            column,
            "missing-oltp-column",
            `Source '${source.id}' maps '${field}' to missing Drizzle column '${key}'.`,
          );
          return [
            field,
            {
              name: column.name,
              sqlType: column.getSQLType(),
              dataType: column.dataType,
              nullable: !column.notNull,
            },
          ];
        }),
      );
      assert(
        Object.keys(mapped).length,
        "empty-source",
        `Source '${source.id}' must map at least one existing Drizzle column.`,
      );
      const definition = {
        owner: "application",
        connection: source.connection,
        schema: table.schema ?? "public",
        table: table.name,
        columns: mapped,
      };
      sourceTables.set(
        canonical([source.connection, table.schema ?? "public", table.name]),
        currentLocation,
      );
      add({
        id: `source:${source.id}`,
        kind: "source",
        version: 1,
        semanticHash: hash(
          Object.fromEntries(
            Object.entries(mapped).map(([field, column]) => [
              field,
              { dataType: column.dataType, nullable: column.nullable },
            ]),
          ),
        ),
        documentationHash: hash(null),
        physicalHash: hash(definition),
        location: location(source.location, rootDir),
        dependencies: [],
        definition,
      });
    }
    for (const model of config.models) {
      currentLocation = location(model.location, rootDir);
      keys(
        model,
        model.backend === "external"
          ? ["backend", "fact", "connection", "location", "schema", "table"]
          : ["backend", "fact", "connection", "location"],
        "model",
      );
      assert(
        model.backend === "postgres" || model.backend === "external",
        "unsupported-backend",
        "Use postgresModel for owned PostgreSQL tables or externalModel for read-only tables.",
      );
      bind(model.connection);
      identifier(model.fact.name, "Model name");
      const descriptor = await compileFact(model.fact);
      const generated =
        model.backend === "postgres" ? await generatePostgresFactSchema(descriptor) : undefined;
      const schema = model.backend === "external" ? model.schema : "public";
      const table = model.backend === "external" ? model.table : generated?.tableName;
      assert(
        schema && table,
        "invalid-binding",
        `Model '${model.fact.name}' needs an explicit schema and table.`,
      );
      const physical = {
        owner: model.backend === "postgres" ? "warehouse" : "external",
        backend: model.backend,
        connection: model.connection,
        schema,
        table,
        columns:
          generated?.columns ??
          Object.fromEntries(
            Object.entries(descriptor.columns).map(([key, column]) => {
              const { description: _description, ...physicalColumn } = column;
              return [key, physicalColumn];
            }),
          ),
      };
      if (generated) {
        ownedConnections.add(model.connection);
        assert(
          ownedConnections.size === 1,
          "multiple-migration-connections",
          "One config can own PostgreSQL models on one connection. Generate a separate config and migration directory per database.",
        );
        const owner = canonical([model.connection, schema, table]);
        const sourceOwner = sourceTables.get(owner);
        if (sourceOwner)
          throw new DataConfigProblem(
            "duplicate-owner",
            `Physical table '${schema}.${table}' belongs to the application OLTP migration owner.`,
            sourceOwner,
          );
        assert(
          !owners.has(owner),
          "duplicate-owner",
          `Physical table '${schema}.${table}' already has an owner.`,
        );
        owners.add(owner);
        statements.push(generated.sql);
        files[`schema/${descriptor.name}.ts`] =
          `import { generatePostgresFactSchema } from "@croco/warehouse-postgres/facts";\nimport type { FactDescriptor } from "@croco/warehouse-core";\nexport const descriptor = ${serializeDescriptor(descriptor)} as const satisfies FactDescriptor;\nexport const schema = generatePostgresFactSchema(descriptor);\n`;
      }
      files[`descriptors/${descriptor.name}.json`] = `${serializeDescriptor(descriptor)}\n`;
      add({
        id: `model:${descriptor.name}`,
        kind: "model",
        version: descriptor.version,
        semanticHash: descriptor.semanticHash,
        documentationHash: hash({
          description: descriptor.description,
          grain: descriptor.grain.description,
          columns: Object.fromEntries(
            Object.entries(descriptor.columns).map(([key, value]) => [
              key,
              value.description ?? null,
            ]),
          ),
        }),
        physicalHash: hash(physical),
        location: location(model.location, rootDir),
        dependencies: [
          ...(descriptor.sourceRefs ?? []).map((id) => `source:${id}`),
          ...(generated ? [`metadata:${model.connection}`] : []),
        ].sort(),
        definition: physical,
      });
    }
    for (const connection of ownedConnections) {
      const model = [...nodes.values()]
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .find(
          (node) =>
            node.kind === "model" &&
            node.definition.backend === "postgres" &&
            node.definition.connection === connection,
        );
      assert(
        model,
        "missing-metadata-owner",
        "Owned PostgreSQL metadata requires a model declaration.",
      );
      currentLocation = model.location;
      for (const table of METADATA_TABLES) {
        const sourceOwner = sourceTables.get(canonical([connection, "public", table]));
        if (sourceOwner)
          throw new DataConfigProblem(
            "duplicate-owner",
            `Physical table 'public.${table}' is reserved for PostgreSQL warehouse metadata; the application cannot own it on connection '${connection}'.`,
            sourceOwner,
          );
        const external = [...nodes.values()].find(
          (node) =>
            node.kind === "model" &&
            node.definition.backend === "external" &&
            node.definition.connection === connection &&
            node.definition.schema === "public" &&
            node.definition.table === table,
        );
        if (external)
          throw new DataConfigProblem(
            "duplicate-owner",
            `Physical table 'public.${table}' is reserved for PostgreSQL warehouse metadata; it cannot be bound as an external model on connection '${connection}'.`,
            external.location,
          );
      }
      const definition = {
        owner: "warehouse",
        backend: "postgres",
        providerVersion: "postgres-facts-v1",
        connection,
        schema: "public",
        tables: METADATA_TABLES,
        nativeSqlHash: createHash("sha256").update(generatePostgresWarehouseSchema()).digest("hex"),
      };
      add({
        id: `metadata:${connection}`,
        kind: "metadata",
        version: 1,
        semanticHash: hash({
          providerVersion: definition.providerVersion,
          tables: METADATA_TABLES,
        }),
        documentationHash: hash(null),
        physicalHash: hash(definition),
        location: model.location,
        dependencies: [],
        definition,
      });
    }
    for (const entry of config.pipelines) {
      currentLocation = location(entry.location, rootDir);
      keys(entry, ["definition", "location"], "pipeline");
      const input = entry.definition;
      keys(
        input,
        ["id", "version", "source", "project", "processor", "load", "resume", "partitionSelection"],
        "pipeline.definition",
      );
      keys(input.source, ["id", "partitions", "coverage"], "pipeline.source");
      if (input.processor)
        keys(input.processor, ["artifactHash", "dependencies", "process"], "pipeline.processor");
      keys(
        input.project,
        ["source", "target", "columns", "project", "artifactHash"],
        "pipeline.project",
      );
      for (const partition of input.source.partitions) {
        keys(
          partition,
          ["id", "path", "schema", "revision", "replayability"],
          "pipeline.partition",
        );
        assert(
          partition.id &&
            partition.path &&
            /^[a-f0-9]{64}$/.test(partition.revision) &&
            ["snapshot-stable", "mutable", "non-replayable"].includes(partition.replayability),
          "invalid-partition",
          "Declare partition id, path, SHA-256 revision and replayability; files are not read during compilation.",
        );
      }
      keys(
        input.project.source,
        ["format", "encoding", "fields", "limits", "delimiter", "header"],
        "pipeline.project.source",
      );
      for (const field of input.project.source.fields)
        keys(field, ["name", "type", "nullable", "nullValues"], "pipeline.source.field");
      for (const expression of Object.values(input.project.columns))
        keys(
          expression,
          expression.kind === "column" ? ["kind", "field", "cast", "default"] : ["kind", "value"],
          "pipeline.projection.expression",
        );
      decodeSource(
        {
          async *[Symbol.asyncIterator]() {
            yield* [];
          },
        },
        input.project.source,
      );
      const projection = defineProjection({
        source: input.project.source,
        target: input.project.target,
        columns: input.project.columns,
      });
      const pipeline = definePipeline({ ...input, project: projection });
      identifier(pipeline.id, "Pipeline id");
      const source = nodes.get(`source:${pipeline.source.id}`);
      assert(
        source,
        "missing-source",
        `Pipeline '${pipeline.id}' requires source '${pipeline.source.id}' with an explicit OLTP mapping.`,
      );
      const mapping = source.definition.columns as Record<
        string,
        { dataType: string; nullable: boolean }
      >;
      for (const field of projection.source.fields) {
        const column = mapping[field.name];
        assert(
          column,
          "missing-source-field",
          `Pipeline '${pipeline.id}' source field '${field.name}' has no OLTP column mapping.`,
        );
        assert(
          column.dataType === field.type && (!column.nullable || field.nullable === true),
          "source-type-mismatch",
          `Pipeline '${pipeline.id}' source field '${field.name}' must preserve its Drizzle data type and nullability.`,
        );
      }
      const descriptor = await compileFact(projection.target);
      const target = nodes.get(`model:${descriptor.name}`);
      assert(
        target && target.semanticHash === descriptor.semanticHash,
        "target-mismatch",
        `Pipeline '${pipeline.id}' target must match a declared model version.`,
      );
      assert(
        target.definition.backend === "postgres",
        "external-write",
        `Pipeline '${pipeline.id}' cannot load a read-only external model.`,
      );
      const transformHash = hash([
        await projection.artifactHash(),
        pipeline.processor?.artifactHash ?? null,
        pipeline.processor?.dependencies ?? [],
        pipeline.load,
      ]);
      const definition = {
        source: pipeline.source.id,
        target: descriptor.name,
        projection: { source: projection.source, columns: projection.columns },
        transformVersion: pipeline.version,
        transformHash,
        load: pipeline.load,
        resume: pipeline.resume,
        partitionSelection: pipeline.partitionSelection ?? null,
      };
      add({
        id: `pipeline:${pipeline.id}`,
        kind: "pipeline",
        version: pipeline.version,
        semanticHash: hash(definition),
        documentationHash: hash(null),
        physicalHash: hash({ source: source.physicalHash, target: target.physicalHash }),
        location: location(entry.location, rootDir),
        dependencies: [
          ...new Set([source.id, target.id, ...(pipeline.processor?.dependencies ?? [])]),
        ].sort(),
        definition,
      });
    }
    const order: string[] = [];
    const active = new Set<string>();
    const visited = new Set<string>();
    function visit(id: string): void {
      assert(
        !active.has(id),
        "dependency-cycle",
        `Dependency cycle at '${id}'; remove the cyclic reference.`,
      );
      if (visited.has(id)) return;
      const node = nodes.get(id);
      assert(
        node,
        "missing-dependency",
        `Dependency '${id}' is missing; declare it with its full node id.`,
      );
      currentLocation = node.location;
      active.add(id);
      for (const dependency of node.dependencies) visit(dependency);
      active.delete(id);
      visited.add(id);
      order.push(id);
    }
    for (const id of [...nodes.keys()].sort()) visit(id);
    if (statements.length)
      files["migrations/candidate.sql"] =
        `${generatePostgresWarehouseSchema()}\n${statements.sort().join("\n")}\n`;
    files["schema/index.ts"] =
      Object.keys(files)
        .filter((path) => path.startsWith("schema/"))
        .sort()
        .map(
          (path) =>
            `export * as ${"model_" + hash(path).slice(0, 16)} from ${JSON.stringify("./" + path.slice(7))};`,
        )
        .join("\n") + "\n";
    const manifest = {
      formatVersion: 1 as const,
      compilerVersion: "1" as const,
      providerVersion: "postgres-facts-v1" as const,
      nodes: [...nodes.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      order,
      connections: [...connections.values()].sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
      ),
      budgets: overlay?.budgets ?? {},
      artifacts: Object.fromEntries(
        Object.entries(files)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([path, content]) => [path, createHash("sha256").update(content).digest("hex")]),
      ),
    };
    files["manifest.json"] = `${canonical(manifest)}\n`;
    return { manifest, files };
  } catch (error) {
    if (error instanceof DataConfigProblem && currentLocation)
      throw new DataConfigProblem(error.reason, error.message, error.location ?? currentLocation);
    if (error instanceof Problem && currentLocation)
      throw new DataConfigProblem(error.code, error.message, currentLocation);
    throw error;
  }
}
