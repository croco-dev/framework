import { DomainEvent } from "@croco/events-core";

export class UsageRecordedEvent extends DomainEvent {
  static eventName = "metering.usage_recorded";

  constructor(
    public readonly tenantId: string,
    public readonly meterId: string,
    public readonly value: number,
    public readonly idempotencyKey: string,
    metadata?: Record<string, unknown>,
  ) {
    super();
    if (metadata !== undefined) {
      this.metadata = { ...this.metadata, ...metadata };
    } else {
      this.metadata = undefined as never;
    }
  }
}
