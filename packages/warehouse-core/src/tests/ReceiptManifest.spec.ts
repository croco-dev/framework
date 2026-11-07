import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  appendWarehouseReceiptManifest,
  createWarehouseReceiptManifest,
} from "../libs/receiptManifest";
import type { WarehouseBatchSummary } from "../libs/receiptManifest";

const bindingHash = "a".repeat(64);
const batch: WarehouseBatchSummary = {
  batchId: "batch-a",
  payloadHash: "b".repeat(64),
  sourceId: "source-one",
  from: 1,
  through: 3,
  rejected: 1,
  filtered: 1,
  rejections: [
    { sourceId: "source-one", record: 2, reason: "invalid-integer", sensitivity: "sensitive" },
  ],
};

describe("warehouse receipt manifest", () => {
  it("commits to order, binding, payload and bounded diagnostics using a versioned tuple", async () => {
    const result = await appendWarehouseReceiptManifest(
      createWarehouseReceiptManifest(bindingHash),
      batch,
    );
    const expectedHash = createHash("sha256")
      .update(
        JSON.stringify([
          "warehouse-receipt-manifest/v1",
          bindingHash,
          1,
          bindingHash,
          "batch-a",
          "b".repeat(64),
          "source-one",
          1,
          3,
          1,
          1,
          [["source-one", 2, "invalid-integer", "sensitive"]],
        ]),
      )
      .digest("hex");
    expect(result.manifest).toEqual({
      formatVersion: 1,
      bindingHash,
      count: 1,
      hash: expectedHash,
    });
    expect(result.evidence).toMatchObject({
      sequence: 1,
      previousHash: bindingHash,
      hash: expectedHash,
    });
    for (const changed of [
      { ...batch, payloadHash: "c".repeat(64) },
      { ...batch, batchId: "batch-b" },
      { ...batch, rejections: [{ ...batch.rejections[0], reason: "different" }] },
    ])
      expect(
        (await appendWarehouseReceiptManifest(createWarehouseReceiptManifest(bindingHash), changed))
          .manifest.hash,
      ).not.toBe(expectedHash);
    const next = await appendWarehouseReceiptManifest(result.manifest, {
      ...batch,
      from: 4,
      through: 6,
      rejections: [{ ...batch.rejections[0], record: 5 }],
    });
    expect(next.evidence.sequence).toBe(2);
    expect(next.evidence.previousHash).toBe(expectedHash);
    expect(next.manifest.hash).not.toBe(expectedHash);
    expect(Object.keys(next.manifest).sort()).toEqual([
      "bindingHash",
      "count",
      "formatVersion",
      "hash",
    ]);
  });

  it.each([
    { ...batch, through: 10_001 },
    { ...batch, from: 0 },
    { ...batch, rejected: 4 },
    { ...batch, rejected: 0 },
    { ...batch, payloadHash: "bad" },
    { ...batch, sourceId: "x".repeat(257) },
    { ...batch, rejections: [{ ...batch.rejections[0], record: 4 }] },
    { ...batch, rejections: [{ ...batch.rejections[0], sourceId: "other" }] },
    { ...batch, rejections: [{ ...batch.rejections[0], reason: "x".repeat(257) }] },
    { ...batch, rejected: 2, filtered: 0, rejections: [batch.rejections[0], batch.rejections[0]] },
  ])("rejects malformed or unbounded evidence %#", async (value) => {
    await expect(
      appendWarehouseReceiptManifest(createWarehouseReceiptManifest(bindingHash), value),
    ).rejects.toThrow("WAREHOUSE_RECEIPTS_INCOMPLETE");
  });

  it("rejects unknown versions and inconsistent empty roots", async () => {
    expect(() => createWarehouseReceiptManifest("unknown")).toThrow(
      "WAREHOUSE_RECEIPTS_INCOMPLETE",
    );
    await expect(
      appendWarehouseReceiptManifest(
        { formatVersion: 2, bindingHash, count: 0, hash: bindingHash } as never,
        batch,
      ),
    ).rejects.toThrow("WAREHOUSE_RECEIPTS_INCOMPLETE");
    await expect(
      appendWarehouseReceiptManifest(
        { formatVersion: 1, bindingHash, count: 0, hash: "d".repeat(64) },
        batch,
      ),
    ).rejects.toThrow("WAREHOUSE_RECEIPTS_INCOMPLETE");
  });
});
