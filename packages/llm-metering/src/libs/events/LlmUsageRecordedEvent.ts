import { DomainEvent } from '@croco/events-core';
import type { LlmUsageRecord } from '../types';

export class LlmUsageRecordedEvent extends DomainEvent {
  static eventName = 'llm.usage_recorded';

  constructor(
    public readonly tenantId: string,
    public readonly usage: LlmUsageRecord
  ) {
    super();
  }
}
