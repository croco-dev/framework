import { parseDescriptor, WarehouseContractError } from "@croco/warehouse-core";
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

export async function installPostgresWarehouseSchema(db: WarehousePostgresClient): Promise<void> {
  await db.query(`
CREATE TABLE IF NOT EXISTS warehouse_models (model_version TEXT PRIMARY KEY, descriptor JSONB NOT NULL, table_name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS warehouse_candidates (id TEXT PRIMARY KEY, scope_key TEXT NOT NULL, model_version TEXT NOT NULL REFERENCES warehouse_models(model_version), fence BIGINT NOT NULL, state TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS warehouse_receipts (candidate_id TEXT NOT NULL REFERENCES warehouse_candidates(id), batch_id TEXT NOT NULL, attempt INTEGER NOT NULL, payload_hash TEXT NOT NULL, receipt JSONB NOT NULL, PRIMARY KEY(candidate_id,batch_id));
CREATE TABLE IF NOT EXISTS warehouse_heads (scope_key TEXT NOT NULL, model_version TEXT NOT NULL REFERENCES warehouse_models(model_version), snapshot_id TEXT, revision BIGINT NOT NULL DEFAULT 0, permission_epoch BIGINT NOT NULL DEFAULT 0, privacy_epoch BIGINT NOT NULL DEFAULT 0, PRIMARY KEY(scope_key,model_version));
CREATE TABLE IF NOT EXISTS warehouse_snapshots (id TEXT PRIMARY KEY, scope_key TEXT NOT NULL, model_version TEXT NOT NULL REFERENCES warehouse_models(model_version), data JSONB NOT NULL, expires_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS warehouse_mutations (scope_key TEXT NOT NULL, model_version TEXT NOT NULL, action TEXT NOT NULL, idempotency_key TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL, expected_revision BIGINT NOT NULL, outcome JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(scope_key,model_version,action,idempotency_key));
CREATE TABLE IF NOT EXISTS warehouse_suppressions (scope_key TEXT NOT NULL, model_version TEXT NOT NULL, identity TEXT NOT NULL, PRIMARY KEY(scope_key,model_version,identity));
`);
  await db.query(
    "ALTER TABLE warehouse_candidates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()",
  );
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
  const columns = Object.keys(validated.columns)
    .sort()
    .map(
      (key) =>
        `${quoteIdentifier(factColumnName(validated, key))} ${sqlType(validated.columns[key])}${validated.columns[key].nullable ? "" : " NOT NULL"}`,
    );
  await db.query(
    `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table)} (_scope TEXT NOT NULL, _identity TEXT NOT NULL, _candidate TEXT NOT NULL REFERENCES warehouse_candidates(id), _payload TEXT NOT NULL, _visible_from BIGINT, _visible_to BIGINT, ${columns.join(", ")}, PRIMARY KEY(_scope,_candidate,_identity))`,
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS ${quoteIdentifier(`${table}_id`)} ON ${quoteIdentifier(table)} (_scope,_identity); CREATE INDEX IF NOT EXISTS ${quoteIdentifier(`${table}_vis`)} ON ${quoteIdentifier(table)} (_scope,_visible_from,_visible_to)`,
  );
}
