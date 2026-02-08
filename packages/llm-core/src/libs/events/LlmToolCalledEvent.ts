import { DomainEvent } from '@croco/events-core';
import type { LlmUsage } from '../types';

export type ToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

export class LlmToolCalledEvent extends DomainEvent {
  readonly type = 'llm.tool_called';

  constructor(
    public readonly modelId: string,
    public readonly toolCall: ToolCall,
    public readonly usage: LlmUsage
  ) {
    super();
  }
}
