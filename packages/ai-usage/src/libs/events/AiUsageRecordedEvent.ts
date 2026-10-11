import { createHash } from "node:crypto";
import { DomainEvent } from "@croco/events-core";
import type { AiUsageRecord } from "../types";

export class AiUsageRecordedEvent extends DomainEvent {
  static eventName = "ai-usage/usage-recorded";

  constructor(
    public readonly tenantId: string,
    public readonly usage: AiUsageRecord,
  ) {
    super(
      createHash("sha256")
        .update(JSON.stringify([AiUsageRecordedEvent.eventName, tenantId, usage.idempotencyKey]))
        .digest("hex"),
    );
  }
}
