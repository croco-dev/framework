import type { ILogger } from "@croco/framework-context";
import type { AuditLogRepository } from "./AuditLogRepository";
export type { AuditLogEntry, AuditQuery } from "./AuditLogRepository";

export type AuditableOptions<T = unknown> = {
  dependencies: (instance: T) => { repository: AuditLogRepository; logger: ILogger };
  action: string;
  resourceType: string;
  resourceIdIndex?: number;
  payloadIndex?: number;
  includeResult?: boolean;
  throwOnFailure?: boolean;
};

export type AuditPayload = {
  diff?: Record<string, unknown>;
};

export function isAuditPayload(value: unknown): value is AuditPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    "diff" in obj && (obj.diff === undefined || obj.diff === null || typeof obj.diff === "object")
  );
}

export type AuditParamMetadata = {
  resourceIdIndex?: number;
  payloadIndex?: number;
};
