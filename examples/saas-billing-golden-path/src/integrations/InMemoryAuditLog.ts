import type { AuditEntry } from "../domain/types";

export const AUDIT_LOG_TOKEN = Symbol.for("@croco-example/golden-path/audit-log");

export class InMemoryAuditLog {
  private readonly entries: AuditEntry[] = [];

  append(entry: AuditEntry): void {
    this.entries.push({ ...entry });
  }

  list(): readonly AuditEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }
}
