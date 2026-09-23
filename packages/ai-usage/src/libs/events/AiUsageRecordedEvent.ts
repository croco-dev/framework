import { DomainEvent } from "@croco/events-core";
import type { AiUsageRecord } from "../types";

export class AiUsageRecordedEvent extends DomainEvent {
  static eventName = "ai-usage/usage-recorded";

  constructor(
    public readonly tenantId: string,
    public readonly usage: AiUsageRecord,
  ) {
    super();
  }
}
