import { DomainEvent } from '@croco/events-core';
import type { LlmUsage } from '../types';

export class LlmStreamCompletedEvent extends DomainEvent {
  readonly type = 'llm.stream_completed';

  constructor(
    public readonly modelId: string,
    public readonly text: string,
    public readonly usage: LlmUsage,
    public readonly chunkCount?: number
  ) {
    super();
  }
}
