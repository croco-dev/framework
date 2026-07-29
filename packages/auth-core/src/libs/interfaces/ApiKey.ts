export type ApiKeyRateLimit = {
  limit: number;
  duration: number;
};

export type ApiKey = {
  id: string;
  prefix: string;
  shortToken: string;
  hash: string;
  permissions: string[];
  name: string;
  tenantId: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  rateLimit?: ApiKeyRateLimit;
  allowedIps?: string[];
};

export type CreateApiKeyOptions = {
  name: string;
  tenantId: string;
  permissions: string[];
  prefix?: string;
  expiresAt?: Date;
  rateLimit?: ApiKeyRateLimit;
  allowedIps?: string[];
  metadata?: Record<string, unknown>;
};

export type CreateApiKeyResult = {
  key: string;
  id: string;
  keyStart: string;
  degraded?: boolean;
};

export type RotateApiKeyResult = {
  key: string;
  id: string;
  keyStart: string;
  degraded?: boolean;
};

export type RotateApiKeyOptions = {
  idempotencyKey: string;
};

export type ApiKeyRotationPhaseStatus = "pending" | "processing" | "completed";

export type ApiKeyRotation = {
  oldKeyId: string;
  replacement: ApiKey;
  tenantId: string;
  idempotencyKey: string;
  recoveryCiphertext: string;
  eventStatus: ApiKeyRotationPhaseStatus;
  eventClaimId: string | null;
  eventClaimExpiresAt: Date | null;
  eventId: string;
  eventOccurredAt: Date;
  createdAt: Date;
};

export type ApiKeyRotationInput = Omit<ApiKeyRotation, "replacement" | "createdAt"> & {
  replacement: Pick<ApiKey, "id" | "prefix" | "shortToken" | "hash">;
};

export type RevokeApiKeyResult = {
  degraded?: boolean;
};
