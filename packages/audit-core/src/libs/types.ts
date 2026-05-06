export type AuditLogEntry = {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
  diff: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  sequence?: number;
  parentHash?: string;
  integrityHash?: string;
};

export type AuditableOptions = {
  action: string;
  resourceType: string;
  resourceIdParam?: string;
  payloadParam?: string;
  includeResult?: boolean;
  throwOnFailure?: boolean;
};

export type AuditQuery = {
  tenantId: string;
  limit?: number;
  offset?: number;
};

export type AuditPayload = {
  diff?: Record<string, unknown>;
};

export function isAuditPayload(value: unknown): value is AuditPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return 'diff' in obj && (obj.diff === undefined || obj.diff === null || typeof obj.diff === 'object');
}

export type AuditParamMetadata = {
  resourceIdIndex?: number;
  payloadIndex?: number;
};
