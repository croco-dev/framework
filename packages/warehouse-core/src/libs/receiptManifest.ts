import { assertContract } from "./diagnostics";

export type WarehouseRejection = {
  readonly sourceId: string;
  readonly record: number;
  readonly reason: string;
  readonly sensitivity: "sensitive";
};

export type WarehouseReceiptManifest = {
  readonly formatVersion: 1;
  readonly bindingHash: string;
  readonly count: number;
  readonly hash: string;
};

export type WarehouseBatchSummary = {
  readonly batchId: string;
  readonly payloadHash: string;
  readonly sourceId: string;
  readonly from: number;
  readonly through: number;
  readonly rejected: number;
  readonly filtered: number;
  readonly rejections: readonly WarehouseRejection[];
};

export type WarehouseBatchEvidence = Omit<WarehouseBatchSummary, "batchId" | "payloadHash"> & {
  readonly formatVersion: 1;
  readonly bindingHash: string;
  readonly sequence: number;
  readonly previousHash: string;
  readonly hash: string;
};

const hash = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const integer = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const label = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 256;

/** The root commits to the full run binding, including source and transform revisions. */
export function createWarehouseReceiptManifest(bindingHash: string): WarehouseReceiptManifest {
  assertContract(hash(bindingHash), "WAREHOUSE_RECEIPTS_INCOMPLETE");
  return { formatVersion: 1, bindingHash, count: 0, hash: bindingHash };
}

/** Append one bounded input range; no prior batch IDs or diagnostic history is retained. */
export async function appendWarehouseReceiptManifest(
  previous: WarehouseReceiptManifest,
  batch: WarehouseBatchSummary,
): Promise<{
  readonly manifest: WarehouseReceiptManifest;
  readonly evidence: WarehouseBatchEvidence;
}> {
  assertContract(
    previous &&
      previous.formatVersion === 1 &&
      hash(previous.bindingHash) &&
      hash(previous.hash) &&
      integer(previous.count) &&
      previous.count < Number.MAX_SAFE_INTEGER &&
      (previous.count !== 0 || previous.hash === previous.bindingHash) &&
      batch &&
      label(batch.batchId) &&
      hash(batch.payloadHash) &&
      label(batch.sourceId) &&
      integer(batch.from) &&
      batch.from > 0 &&
      integer(batch.through) &&
      batch.through >= batch.from &&
      batch.through - batch.from < 10_000 &&
      integer(batch.rejected) &&
      integer(batch.filtered) &&
      batch.rejected + batch.filtered <= batch.through - batch.from + 1 &&
      Array.isArray(batch.rejections) &&
      batch.rejections.length === batch.rejected &&
      batch.rejections.every(
        (item) =>
          item &&
          item.sourceId === batch.sourceId &&
          integer(item.record) &&
          item.record >= batch.from &&
          item.record <= batch.through &&
          label(item.reason) &&
          item.sensitivity === "sensitive",
      ) &&
      new Set(batch.rejections.map((item) => item.record)).size === batch.rejections.length,
    "WAREHOUSE_RECEIPTS_INCOMPLETE",
  );
  assertContract(globalThis.crypto?.subtle, "WAREHOUSE_CRYPTO_UNAVAILABLE");
  const sequence = previous.count + 1;
  const rejections = batch.rejections.map(({ sourceId, record, reason, sensitivity }) => ({
    sourceId,
    record,
    reason,
    sensitivity,
  }));
  const tuple = [
    "warehouse-receipt-manifest/v1",
    previous.bindingHash,
    sequence,
    previous.hash,
    batch.batchId,
    batch.payloadHash,
    batch.sourceId,
    batch.from,
    batch.through,
    batch.rejected,
    batch.filtered,
    rejections.map((item) => [item.sourceId, item.record, item.reason, item.sensitivity]),
  ];
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(tuple)),
  );
  const nextHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return {
    manifest: {
      formatVersion: 1,
      bindingHash: previous.bindingHash,
      count: sequence,
      hash: nextHash,
    },
    evidence: {
      formatVersion: 1,
      bindingHash: previous.bindingHash,
      sequence,
      previousHash: previous.hash,
      hash: nextHash,
      sourceId: batch.sourceId,
      from: batch.from,
      through: batch.through,
      rejected: batch.rejected,
      filtered: batch.filtered,
      rejections,
    },
  };
}
