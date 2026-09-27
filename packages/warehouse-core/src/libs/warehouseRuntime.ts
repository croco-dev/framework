import type { AggregateRange } from "./fixtureImporter";
import type { CanonicalRow, FactDescriptor, TrustedScope } from "./types";

export type WarehouseRole = "read" | "import" | "export" | "drop" | "publish";

/** Resolved by the server, never copied from an untrusted query or cursor. */
export type WarehouseAccess = {
  readonly scope: TrustedScope;
  readonly actor: string;
  readonly roles: readonly WarehouseRole[];
  readonly columns: readonly string[];
  readonly permissionEpoch: number;
  readonly privacyEpoch: number;
};

export type WarehouseAudit = {
  readonly reason: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
};

export type SourceCoverage = {
  readonly sourceRef: string;
  readonly from: string;
  readonly through: string;
  readonly state: "complete" | "empty" | "partial" | "failed" | "unknown";
  readonly gaps: readonly { readonly from: string; readonly through: string }[];
  readonly late: boolean;
};

export type WarehouseQuality = {
  readonly freshness: { readonly observedAt: string; readonly newestEventAt: string | null };
  readonly temporalCompleteness: "complete" | "partial" | "unknown";
  readonly populationCoverage: "complete" | "partial" | "unknown";
  readonly validity: "valid" | "invalid" | "unknown";
  readonly reproducibility: "reproducible" | "unverified";
  readonly sourceCoverage: readonly SourceCoverage[];
};

export type WarehouseCandidate = {
  readonly id: string;
  readonly scope: TrustedScope;
  readonly modelVersion: string;
  readonly transformHash: string;
  readonly sourceRefs: readonly string[];
  readonly expectedHead: string | null;
  readonly fence: number;
  readonly state: "open" | "sealed" | "published" | "failed";
  readonly quality: WarehouseQuality | null;
  readonly partitionSelection: AggregateRange | null;
  readonly permissionEpoch: number;
  readonly privacyEpoch: number;
};

export type WarehouseSnapshot = {
  readonly id: string;
  readonly revision: number;
  readonly modelVersion: string;
  readonly segmentRefs: readonly string[];
  readonly partitionSelection: readonly AggregateRange[];
  readonly quality: WarehouseQuality;
  readonly createdAt: string;
  readonly permissionEpoch: number;
  readonly privacyEpoch: number;
};

export type WriteReceipt = {
  readonly batchId: string;
  readonly attempt: number;
  readonly state: "durable" | "indeterminate" | "rejected";
  readonly providerRef: string;
  readonly inserted: number;
  readonly identical: number;
};

export type WarehouseCandidateRequest = {
  readonly access: WarehouseAccess;
  readonly candidateId: string;
  readonly fence: number;
};

export type WarehouseWriteRequest = WarehouseCandidateRequest & {
  readonly batchId: string;
  readonly attempt: number;
  readonly rows: readonly CanonicalRow[];
};

export type WarehouseReceiptRequest = WarehouseCandidateRequest & {
  readonly batchId: string;
  readonly attempt: number;
};

export interface WarehouseWriter {
  write(request: WarehouseWriteRequest): Promise<WriteReceipt>;
  reconcileReceipt(request: WarehouseReceiptRequest): Promise<WriteReceipt | null>;
}

export type WarehouseCreateCandidateRequest = {
  readonly access: WarehouseAccess;
  readonly id: string;
  readonly transformHash: string;
  readonly sourceRefs: readonly string[];
  readonly expectedHead: string | null;
  readonly partitionSelection: AggregateRange | null;
  readonly audit: WarehouseAudit;
};

export type WarehouseSealRequest = WarehouseCandidateRequest & {
  readonly expectedBatchIds: readonly string[];
  readonly quality: WarehouseQuality;
  readonly audit: WarehouseAudit;
};

export type WarehouseFailRequest = WarehouseCandidateRequest & {
  readonly audit: WarehouseAudit;
};

export type WarehousePublishRequest = WarehouseCandidateRequest & {
  readonly audit: WarehouseAudit;
};

export type WarehouseSnapshotRequest = {
  readonly access: WarehouseAccess;
  readonly snapshotId?: string;
};

export type WarehouseDataset = {
  readonly descriptor: FactDescriptor;
  readonly head: WarehouseSnapshot | null;
  readonly candidates: readonly WarehouseCandidate[];
  readonly revision: number;
  readonly permissionEpoch: number;
  readonly privacyEpoch: number;
};

export type WarehouseSuppressRequest = {
  readonly access: WarehouseAccess;
  readonly identities: readonly string[];
  readonly audit: WarehouseAudit;
};

export type WarehouseExpireRequest = {
  readonly access: WarehouseAccess;
  readonly before: string;
  readonly audit: WarehouseAudit;
};

export type WarehousePermissionEpochRequest = {
  readonly access: WarehouseAccess;
  readonly audit: WarehouseAudit;
};

export type WarehouseRemovePublicationRequest = {
  readonly access: WarehouseAccess;
  readonly snapshotId: string;
  readonly audit: WarehouseAudit;
};

export interface CatalogStore {
  createCandidate(request: WarehouseCreateCandidateRequest): Promise<WarehouseCandidate>;
  getCandidate(request: {
    readonly access: WarehouseAccess;
    readonly candidateId: string;
  }): Promise<WarehouseCandidate>;
  sealCandidate(request: WarehouseSealRequest): Promise<WarehouseCandidate>;
  failCandidate(request: WarehouseFailRequest): Promise<WarehouseCandidate>;
  publishCandidate(request: WarehousePublishRequest): Promise<WarehouseSnapshot>;
  pinSnapshot(request: WarehouseSnapshotRequest): Promise<WarehouseSnapshot>;
  describeDataset(request: { readonly access: WarehouseAccess }): Promise<WarehouseDataset>;
  suppress(request: WarehouseSuppressRequest): Promise<{ readonly privacyEpoch: number }>;
  expireSnapshots(request: WarehouseExpireRequest): Promise<{ readonly expired: number }>;
  synchronizePermissionEpoch(
    request: WarehousePermissionEpochRequest,
  ): Promise<{ readonly permissionEpoch: number }>;
  removePublication(
    request: WarehouseRemovePublicationRequest,
  ): Promise<{ readonly privacyEpoch: number }>;
}

export type WarehouseFilter = {
  readonly column: string;
  readonly operator: "eq" | "ne" | "lt" | "lte" | "gt" | "gte";
  readonly value: string | boolean | null;
};

export type WarehouseOrder = {
  readonly column: string;
  readonly direction: "asc" | "desc";
};

export type WarehouseReadRequest = {
  readonly access: WarehouseAccess;
  readonly snapshotId: string;
  readonly cursor?: string;
  readonly projection: readonly string[];
  readonly filters: readonly WarehouseFilter[];
  readonly order: readonly WarehouseOrder[];
  readonly maxRows: number;
  readonly maxBytes: number;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
};

export type WarehousePage = {
  readonly snapshotId: string;
  readonly rows: readonly CanonicalRow[];
  readonly nextCursor: string | null;
  readonly permissionEpoch: number;
  readonly privacyEpoch: number;
  readonly exactness: "exact";
};

/** Providers reject expired snapshots and changed epochs instead of repinning current. */
export interface WarehouseReader {
  read(request: WarehouseReadRequest): Promise<WarehousePage>;
}
