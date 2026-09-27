import { createHash } from "node:crypto";
import {
  canonicalPayload,
  encodeIdentity,
  parseDescriptor,
  validateRow,
  WarehouseContractError,
} from "@croco/warehouse-core";
import type { FactDescriptor } from "@croco/warehouse-core";
import type {
  WarehouseAccess,
  WarehouseCandidate,
  WarehouseReceiptRequest,
  WarehouseWriteRequest,
  WarehouseWriter,
  WriteReceipt,
} from "@croco/warehouse-core/runtime";
import { factColumnName, factTableName, quoteIdentifier, scopeKey } from "./schema";
import type { WarehousePostgresConnection, WarehousePostgresPool } from "./client";

type CandidateRow = {
  data: WarehouseCandidate;
  state: string;
  fence: string | number;
  scope_key: string;
  model_version: string;
};

export class PostgresWarehouseWriter implements WarehouseWriter {
  constructor(
    private readonly pool: WarehousePostgresPool,
    private readonly descriptor: FactDescriptor,
    private readonly resolveAccess: () => WarehouseAccess,
  ) {}

  private async lock(
    db: WarehousePostgresConnection,
    request: WarehouseReceiptRequest,
  ): Promise<CandidateRow> {
    const trusted = this.resolveAccess();
    if (
      scopeKey(trusted.scope) !== scopeKey(request.access.scope) ||
      trusted.actor !== request.access.actor ||
      trusted.permissionEpoch !== request.access.permissionEpoch ||
      trusted.privacyEpoch !== request.access.privacyEpoch ||
      JSON.stringify([...trusted.roles].sort()) !==
        JSON.stringify([...request.access.roles].sort()) ||
      JSON.stringify([...trusted.columns].sort()) !==
        JSON.stringify([...request.access.columns].sort())
    )
      throw new WarehouseContractError("WAREHOUSE_ACCESS_CHANGED");
    if (
      !request.access.roles.includes("import") ||
      !request.access.actor ||
      !request.batchId ||
      !Number.isSafeInteger(request.attempt) ||
      request.attempt < 1
    )
      throw new WarehouseContractError("WAREHOUSE_IMPORT_DENIED");
    const head = await db.query<{
      permission_epoch: string | number;
      privacy_epoch: string | number;
    }>(
      "SELECT permission_epoch,privacy_epoch FROM warehouse_heads WHERE scope_key=$1 AND model_version=$2 FOR UPDATE",
      [scopeKey(request.access.scope), this.descriptor.semanticHash],
    );
    if (
      !head.rows[0] ||
      Number(head.rows[0].permission_epoch) !== request.access.permissionEpoch ||
      Number(head.rows[0].privacy_epoch) !== request.access.privacyEpoch
    )
      throw new WarehouseContractError("WAREHOUSE_EPOCH_CHANGED");
    const result = await db.query<CandidateRow>(
      "SELECT * FROM warehouse_candidates WHERE id=$1 FOR UPDATE",
      [request.candidateId],
    );
    const candidate = result.rows[0];
    if (
      !candidate ||
      candidate.scope_key !== scopeKey(request.access.scope) ||
      candidate.model_version !== this.descriptor.semanticHash ||
      Number(candidate.fence) !== request.fence
    )
      throw new WarehouseContractError("WAREHOUSE_CANDIDATE_FENCE");
    return candidate;
  }

  async reconcileReceipt(request: WarehouseReceiptRequest): Promise<WriteReceipt | null> {
    const db = await this.pool.connect();
    try {
      await db.query("BEGIN");
      await this.lock(db, request);
      const result = await db.query<{ receipt: WriteReceipt }>(
        "SELECT receipt FROM warehouse_receipts WHERE candidate_id=$1 AND batch_id=$2",
        [request.candidateId, request.batchId],
      );
      await db.query("COMMIT");
      return result.rows[0]?.receipt ?? null;
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  }

  async write(request: WarehouseWriteRequest): Promise<WriteReceipt> {
    if (request.rows.length > 10_000) throw new WarehouseContractError("WAREHOUSE_BATCH_LIMIT");
    const db = await this.pool.connect();
    let committing = false;
    let indeterminate = false;
    const receipt: WriteReceipt = {
      batchId: request.batchId,
      attempt: request.attempt,
      state: "durable",
      providerRef: JSON.stringify([request.candidateId, request.batchId]),
      inserted: 0,
      identical: 0,
    };
    try {
      await db.query("BEGIN");
      const candidate = await this.lock(db, request);
      const model = await db.query<{ descriptor: FactDescriptor }>(
        "SELECT descriptor FROM warehouse_models WHERE model_version=$1",
        [candidate.model_version],
      );
      if (!model.rows[0]) throw new WarehouseContractError("WAREHOUSE_MODEL_UNAVAILABLE");
      const descriptor = await parseDescriptor(JSON.stringify(model.rows[0].descriptor));
      const keys = Object.keys(descriptor.columns).sort();
      if (keys.some((key) => !request.access.columns.includes(key)))
        throw new WarehouseContractError("WAREHOUSE_COLUMN_DENIED");
      const rows = request.rows.map((row) => validateRow(descriptor, row));
      const payloads = rows.map((row) => canonicalPayload(descriptor, row));
      const digest = createHash("sha256").update(JSON.stringify(payloads)).digest("hex");
      const previous = await db.query<{ receipt: WriteReceipt; payload_hash: string }>(
        "SELECT receipt,payload_hash FROM warehouse_receipts WHERE candidate_id=$1 AND batch_id=$2",
        [request.candidateId, request.batchId],
      );
      if (previous.rows[0]) {
        if (previous.rows[0].payload_hash !== digest)
          throw new WarehouseContractError("WAREHOUSE_BATCH_CONFLICT");
        await db.query("COMMIT");
        return previous.rows[0].receipt;
      }
      if (candidate.state !== "open")
        throw new WarehouseContractError("WAREHOUSE_CANDIDATE_CLOSED");
      if (
        candidate.data.permissionEpoch !== request.access.permissionEpoch ||
        candidate.data.privacyEpoch !== request.access.privacyEpoch
      )
        throw new WarehouseContractError("WAREHOUSE_EPOCH_CHANGED");
      const table = quoteIdentifier(factTableName(descriptor));
      let inserted = 0;
      let identical = 0;
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        if (descriptor.kind === "aggregate") {
          const range = candidate.data.partitionSelection;
          const date = row[descriptor.aggregate.date];
          if (
            !range ||
            typeof date !== "string" ||
            date < range.from ||
            date > range.through ||
            Object.entries(range.series).some(([key, value]) => row[key] !== value)
          )
            throw new WarehouseContractError("WAREHOUSE_ROW_OUTSIDE_PARTITION");
        }
        const identity = encodeIdentity(descriptor, row, request.access.scope);
        const suppressed = await db.query(
          "SELECT identity FROM warehouse_suppressions WHERE scope_key=$1 AND model_version=$2 AND identity=$3",
          [candidate.scope_key, candidate.model_version, identity],
        );
        if (suppressed.rows.length)
          throw new WarehouseContractError("WAREHOUSE_IDENTITY_SUPPRESSED");
        const existing = await db.query<{ _payload: string }>(
          `SELECT _payload FROM ${table} WHERE _scope=$1 AND _identity=$2${descriptor.kind === "aggregate" ? " AND _candidate=$3" : " AND (_candidate=$3 OR (_visible_from IS NOT NULL AND _visible_to IS NULL))"}`,
          [candidate.scope_key, identity, request.candidateId],
        );
        if (existing.rows.some((value) => value._payload !== payloads[index]))
          throw new WarehouseContractError("WAREHOUSE_FACT_CONFLICT");
        if (existing.rows.length) identical++;
        else inserted++;
        const values = [
          candidate.scope_key,
          identity,
          request.candidateId,
          payloads[index],
          ...keys.map((key) => row[key]),
        ];
        await db.query(
          `INSERT INTO ${table} (_scope,_identity,_candidate,_payload,${keys.map((key) => quoteIdentifier(factColumnName(descriptor, key))).join(",")}) VALUES (${values.map((_, i) => `$${i + 1}`).join(",")}) ON CONFLICT(_scope,_candidate,_identity) DO NOTHING`,
          values,
        );
      }
      const durable: WriteReceipt = { ...receipt, inserted, identical };
      await db.query(
        "INSERT INTO warehouse_receipts(candidate_id,batch_id,attempt,payload_hash,receipt) VALUES($1,$2,$3,$4,$5)",
        [request.candidateId, request.batchId, request.attempt, digest, durable],
      );
      committing = true;
      await db.query("COMMIT");
      return durable;
    } catch (error) {
      if (committing) {
        indeterminate = true;
        return { ...receipt, state: "indeterminate" };
      }
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release(indeterminate || undefined);
    }
  }
}
