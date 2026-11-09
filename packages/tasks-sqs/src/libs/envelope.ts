import { createHash } from "node:crypto";
import { SqsTaskConfigurationProblem, SqsTaskMessageProblem } from "./problems/SqsTaskProblems";

export type SqsTaskEnvelope = {
  readonly version: 1;
  readonly tenantId: string;
  readonly taskId: string;
  readonly dispatchId: string;
  readonly idempotencyKey?: string;
  readonly payload: unknown;
};

export function requiredString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function requireConfiguration(value: unknown, field: string): asserts value is string {
  if (!requiredString(value)) throw new SqsTaskConfigurationProblem(field);
}

export function taskIdentity(queue: string, tenantId: string, taskId: string, key: string): string {
  return `sqs:v1:${createHash("sha256")
    .update(JSON.stringify([queue, tenantId, taskId, key]))
    .digest("hex")}`;
}

export function decodeEnvelope(body: string, tenantId: string): SqsTaskEnvelope {
  let candidate: unknown;
  try {
    candidate = JSON.parse(body);
  } catch {
    throw new SqsTaskMessageProblem();
  }
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    throw new SqsTaskMessageProblem();
  }
  const value = candidate as Record<string, unknown>;
  if (
    value.version !== 1 ||
    value.tenantId !== tenantId ||
    !requiredString(value.taskId) ||
    !requiredString(value.dispatchId) ||
    !Object.hasOwn(value, "payload") ||
    (value.idempotencyKey !== undefined && !requiredString(value.idempotencyKey)) ||
    Object.keys(value).some(
      (key) =>
        !["version", "tenantId", "taskId", "dispatchId", "idempotencyKey", "payload"].includes(key),
    )
  ) {
    throw new SqsTaskMessageProblem();
  }
  return value as SqsTaskEnvelope;
}
