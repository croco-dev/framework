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
};

export type AuditableOptions = {
  action: string;
  resourceType: string;
  resourceIdParam?: string;
  payloadParam?: string;
  includeResult?: boolean;
};

export type AuditQuery = {
  tenantId: string;
  limit?: number;
  offset?: number;
};
