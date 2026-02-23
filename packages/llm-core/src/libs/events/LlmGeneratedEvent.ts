import { DomainEvent } from '@croco/events-core';
import type { LlmUsage } from '../types';

export class LlmGeneratedEvent extends DomainEvent {
  static eventName = 'llm.generated';
  readonly type = 'llm.generated';

  constructor(
    public readonly modelId: string,
    public readonly prompt: string,
    public readonly result: string,
    public readonly usage: LlmUsage
  ) {
    super();
  }
}
