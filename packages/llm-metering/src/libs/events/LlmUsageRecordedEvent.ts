import { DomainEvent } from '@croco/events-core';
import type { LlmUsageRecord } from '../types';

export class LlmUsageRecordedEvent extends DomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly usage: LlmUsageRecord
  ) {
    super();
  }
}
