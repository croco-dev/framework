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

export type AuditQuery = {
  tenantId: string;
  limit?: number;
  offset?: number;
};

export abstract class AuditLogRepository {
  abstract create(entry: Omit<AuditLogEntry, "id" | "createdAt">): Promise<AuditLogEntry>;
  abstract find(query: AuditQuery): Promise<AuditLogEntry[]>;
}
