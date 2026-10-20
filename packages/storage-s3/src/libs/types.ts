import type { S3ClientConfig } from "@aws-sdk/client-s3";
import type { PutOptions, StorageOperationOptions } from "@croco/storage-core";

export type S3StorageOptions = {
  readonly bucket: string;
  readonly region: string;
  /** Literal namespace; must end with / when non-empty. Not an authorization boundary. */
  readonly keyPrefix?: string;
  /** Application-owned CDN/public bucket origin; objects remain private by default. */
  readonly publicUrlBase?: string;
  /** Omit for the SDK default chain (Lambda role, IRSA/web identity, workload identity). */
  readonly credentials?: S3ClientConfig["credentials"];
  /** Trusted application configuration for private endpoints or local conformance fixtures. */
  readonly endpoint?: string;
  readonly forcePathStyle?: boolean;
  /** Independent abort-cleanup budget; defaults to 5000 ms. Reserve it in the host deadline. */
  readonly cleanupTimeoutMs?: number;
};

export type S3PutOptions = PutOptions & {
  readonly ifMatch?: string;
  readonly ifNoneMatch?: "*";
};

export type S3ReadOptions = StorageOperationOptions & {
  /** Inclusive byte offsets; invalid ranges are rejected before I/O. */
  readonly range?: { readonly start: number; readonly end?: number };
};
