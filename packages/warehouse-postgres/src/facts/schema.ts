import {
  parseDescriptor,
  serializeDescriptor,
  WarehouseContractError,
} from "@croco/warehouse-core";
import type { Column, FactDescriptor, TrustedScope } from "@croco/warehouse-core";
import type { WarehousePostgresClient } from "./client";

export function quoteIdentifier(value: string): string {
  if (!value || value.includes("\0") || Buffer.byteLength(value) > 63)
    throw new WarehouseContractError("WAREHOUSE_SQL_IDENTIFIER");
  return `"${value.replaceAll('"', '""')}"`;
}

export function scopeKey(scope: TrustedScope): string {
  return JSON.stringify([scope.application, scope.environment, scope.tenant ?? null]);
}

export function factTableName(descriptor: FactDescriptor): string {
  if (!/^[a-f0-9]{64}$/.test(descriptor.semanticHash))
    throw new WarehouseContractError("WAREHOUSE_INVALID_DESCRIPTOR");
  return `wh_fact_${descriptor.semanticHash.slice(0, 48)}`;
}

export function factColumnName(descriptor: FactDescriptor, key: string): string {
  const index = Object.keys(descriptor.columns).sort().indexOf(key);
  if (index < 0) throw new WarehouseContractError("WAREHOUSE_UNKNOWN_COLUMN", key);
  return `c_${index}`;
}

function sqlType(column: Column): string {
  switch (column.type) {
    case "boolean":
      return "BOOLEAN";
    case "int64":
    case "money":
      return "BIGINT";
    case "decimal":
      return `NUMERIC(${column.precision},${column.scale})`;
    case "date":
      return "DATE";
    case "instant":
      return `TIMESTAMPTZ(${{ second: 0, millisecond: 3, microsecond: 6 }[column.precision]})`;
    default:
      return "TEXT";
  }
}

function warehouseSchema(schema?: "public"): string {
  const table = (name: string) =>
    schema ? `${quoteIdentifier(schema)}.${quoteIdentifier(name)}` : name;
  return `
CREATE TABLE IF NOT EXISTS ${table("warehouse_models")} (model_version TEXT PRIMARY KEY, descriptor JSONB NOT NULL, table_name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS ${table("warehouse_candidates")} (id TEXT PRIMARY KEY, scope_key TEXT NOT NULL, model_version TEXT NOT NULL REFERENCES ${table("warehouse_models")}(model_version), fence BIGINT NOT NULL, state TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS ${table("warehouse_receipts")} (candidate_id TEXT NOT NULL REFERENCES ${table("warehouse_candidates")}(id), batch_id TEXT NOT NULL, attempt INTEGER NOT NULL, payload_hash TEXT NOT NULL, receipt JSONB NOT NULL, PRIMARY KEY(candidate_id,batch_id));
CREATE TABLE IF NOT EXISTS ${table("warehouse_heads")} (scope_key TEXT NOT NULL, model_version TEXT NOT NULL REFERENCES ${table("warehouse_models")}(model_version), snapshot_id TEXT, revision BIGINT NOT NULL DEFAULT 0, permission_epoch BIGINT NOT NULL DEFAULT 0, privacy_epoch BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(scope_key,model_version));
CREATE TABLE IF NOT EXISTS ${table("warehouse_snapshots")} (id TEXT PRIMARY KEY, scope_key TEXT NOT NULL, model_version TEXT NOT NULL REFERENCES ${table("warehouse_models")}(model_version), data JSONB NOT NULL, expires_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS ${table("warehouse_mutations")} (scope_key TEXT NOT NULL, model_version TEXT NOT NULL, action TEXT NOT NULL, idempotency_key TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL, expected_revision BIGINT NOT NULL, outcome JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(scope_key,model_version,action,idempotency_key));
CREATE TABLE IF NOT EXISTS ${table("warehouse_suppressions")} (scope_key TEXT NOT NULL, model_version TEXT NOT NULL, identity TEXT NOT NULL, PRIMARY KEY(scope_key,model_version,identity));
ALTER TABLE ${table("warehouse_candidates")} ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
`;
}

export function generatePostgresWarehouseSchema(): string {
  return warehouseSchema("public");
}

export async function installPostgresWarehouseSchema(db: WarehousePostgresClient): Promise<void> {
  await db.query(warehouseSchema());
}

/** Run inside an explicitly owned migration transaction; never called by a constructor. */
export async function installPostgresFactSchema(
  db: WarehousePostgresClient,
  descriptor: FactDescriptor,
): Promise<void> {
  const validated = await parseDescriptor(JSON.stringify(descriptor));
  const table = factTableName(validated);
  await db.query(
    "INSERT INTO warehouse_models(model_version,descriptor,table_name) VALUES($1,$2,$3) ON CONFLICT(model_version) DO NOTHING",
    [validated.semanticHash, validated, table],
  );
  const binding = await db.query<{ table_name: string; descriptor: FactDescriptor }>(
    "SELECT table_name,descriptor FROM warehouse_models WHERE model_version=$1",
    [validated.semanticHash],
  );
  if (
    binding.rows[0]?.table_name !== table ||
    (await parseDescriptor(JSON.stringify(binding.rows[0].descriptor))).semanticHash !==
      validated.semanticHash
  )
    throw new WarehouseContractError("WAREHOUSE_BINDING_CONFLICT");
  await db.query(factSchema(validated).sql);
}

export type PostgresFactSchema = {
  readonly sql: string;
  readonly tableName: string;
  readonly columns: readonly {
    readonly key: string;
    readonly name: string;
    readonly sqlType: string;
    readonly nullable: boolean;
  }[];
};

function factSchema(descriptor: FactDescriptor, schema?: "public"): PostgresFactSchema {
  const tableName = factTableName(descriptor);
  const table = schema
    ? `${quoteIdentifier(schema)}.${quoteIdentifier(tableName)}`
    : quoteIdentifier(tableName);
  const candidates = schema
    ? `${quoteIdentifier(schema)}.warehouse_candidates`
    : "warehouse_candidates";
  const columns = Object.keys(descriptor.columns)
    .sort()
    .map((key) => ({
      key,
      name: factColumnName(descriptor, key),
      sqlType: sqlType(descriptor.columns[key]),
      nullable: descriptor.columns[key].nullable === true,
    }));
  const definitions = columns.map(
    (column) =>
      `${quoteIdentifier(column.name)} ${column.sqlType}${column.nullable ? "" : " NOT NULL"}`,
  );
  return {
    tableName,
    columns,
    sql: `CREATE TABLE IF NOT EXISTS ${table} (_scope TEXT NOT NULL, _identity TEXT NOT NULL, _candidate TEXT NOT NULL REFERENCES ${candidates}(id), _payload TEXT NOT NULL, _visible_from BIGINT, _visible_to BIGINT, ${definitions.join(", ")}, PRIMARY KEY(_scope,_candidate,_identity));
CREATE INDEX IF NOT EXISTS ${quoteIdentifier(`${tableName}_id`)} ON ${table} (_scope,_identity);
CREATE INDEX IF NOT EXISTS ${quoteIdentifier(`${tableName}_vis`)} ON ${table} (_scope,_visible_from,_visible_to);
`,
  };
}

function quoteLiteral(value: string): string {
  if (value.includes("\0")) throw new WarehouseContractError("WAREHOUSE_SQL_LITERAL");
  return `E'${value.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

/** Generate reviewed migration SQL without connecting to a database. */
export async function generatePostgresFactSchema(
  descriptor: FactDescriptor,
): Promise<PostgresFactSchema> {
  const validated = await parseDescriptor(JSON.stringify(descriptor));
  const schema = factSchema(validated, "public");
  const model = quoteLiteral(validated.semanticHash);
  const serialized = quoteLiteral(serializeDescriptor(validated));
  const table = quoteLiteral(schema.tableName);
  const meaning = (expression: string) =>
    `((${expression} - 'description' - 'sourceRefs' - 'semanticHash') || jsonb_build_object('grain', (${expression}->'grain') - 'description', 'columns', (SELECT jsonb_object_agg(key, value - 'description') FROM jsonb_each(${expression}->'columns'))))`;
  const binding = `BEGIN
  INSERT INTO public.warehouse_models(model_version,descriptor,table_name) VALUES(${model},${serialized}::jsonb,${table}) ON CONFLICT(model_version) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_models WHERE model_version=${model} AND table_name=${table} AND descriptor->>'semanticHash'=${model} AND ${meaning("descriptor")} = ${meaning(`${serialized}::jsonb`)}) THEN
    RAISE EXCEPTION 'WAREHOUSE_BINDING_CONFLICT';
  END IF;
END;`;
  let delimiter = "$warehouse_binding$";
  while (binding.includes(delimiter)) delimiter = `${delimiter.slice(0, -1)}_$`;
  return { ...schema, sql: `DO ${delimiter}\n${binding}\n${delimiter};\n${schema.sql}` };
}
