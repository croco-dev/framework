import { createHash } from "node:crypto";

export function createMeteringEventId(
  eventName: string,
  tenantId: string,
  meterId: string,
  idempotencyKey: string,
): string {
  return createHash("sha256")
    .update(JSON.stringify([eventName, tenantId, meterId, idempotencyKey]))
    .digest("hex");
}
