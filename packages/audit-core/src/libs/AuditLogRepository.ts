import type { AuditLogEntry, AuditQuery } from "./types";

export abstract class AuditLogRepository {
  abstract create(entry: Omit<AuditLogEntry, "id" | "createdAt">): Promise<AuditLogEntry>;
  abstract find(query: AuditQuery): Promise<AuditLogEntry[]>;
}
