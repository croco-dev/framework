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
};

export type RotateApiKeyResult = {
  key: string;
  id: string;
  keyStart: string;
};
