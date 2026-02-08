import { describe, expect, it } from 'vitest';
import { LlmStreamCompletedEvent } from '../../libs/events/LlmStreamCompletedEvent';
import { LlmToolCalledEvent } from '../../libs/events/LlmToolCalledEvent';
import { LlmUsageRecordedEvent } from '../../libs/events/LlmUsageRecordedEvent';
import type { LlmUsage } from '../../libs/types';

describe('LlmEvents', () => {
  const mockUsage: LlmUsage = {
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
  };

  describe('LlmStreamCompletedEvent', () => {
    it('should create event with correct properties', () => {
      const event = new LlmStreamCompletedEvent('gpt-4', 'full text', mockUsage);

      expect(event.type).toBe('llm.stream_completed');
      expect(event.modelId).toBe('gpt-4');
      expect(event.text).toBe('full text');
      expect(event.usage).toEqual(mockUsage);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should accept optional chunk count', () => {
      const event = new LlmStreamCompletedEvent('gpt-4', 'full text', mockUsage, 5);

      expect(event.chunkCount).toBe(5);
    });

    it('should handle undefined chunk count', () => {
      const event = new LlmStreamCompletedEvent('gpt-4', 'full text', mockUsage);

      expect(event.chunkCount).toBeUndefined();
    });
  });

  describe('LlmToolCalledEvent', () => {
    it('should create event with correct properties', () => {
      const toolCall = {
        name: 'search',
        arguments: { query: 'test' },
      };
      const event = new LlmToolCalledEvent('gpt-4', toolCall, mockUsage);

      expect(event.type).toBe('llm.tool_called');
      expect(event.modelId).toBe('gpt-4');
      expect(event.toolCall).toEqual(toolCall);
      expect(event.usage).toEqual(mockUsage);
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should handle complex tool arguments', () => {
      const toolCall = {
        name: 'database_query',
        arguments: {
          table: 'users',
          filters: { active: true },
          limit: 10,
        },
      };
      const event = new LlmToolCalledEvent('gpt-4', toolCall, mockUsage);

      expect(event.toolCall.arguments).toEqual({
        table: 'users',
        filters: { active: true },
        limit: 10,
      });
    });
  });

  describe('LlmUsageRecordedEvent', () => {
    it('should create event with correct properties', () => {
      const event = new LlmUsageRecordedEvent('gpt-4', mockUsage, 'generate');

      expect(event.type).toBe('llm.usage_recorded');
      expect(event.modelId).toBe('gpt-4');
      expect(event.usage).toEqual(mockUsage);
      expect(event.operation).toBe('generate');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should accept different operation types', () => {
      const streamEvent = new LlmUsageRecordedEvent('gpt-4', mockUsage, 'stream');
      const embedEvent = new LlmUsageRecordedEvent('gpt-4', mockUsage, 'embed');
      const toolEvent = new LlmUsageRecordedEvent('gpt-4', mockUsage, 'callTool');

      expect(streamEvent.operation).toBe('stream');
      expect(embedEvent.operation).toBe('embed');
      expect(toolEvent.operation).toBe('callTool');
    });
  });
});
