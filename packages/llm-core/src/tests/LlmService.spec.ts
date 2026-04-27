import type { EventBus } from '@croco/events-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryLlmModel } from '../libs/InMemoryLlmModel';
import { InMemoryLlmRegistry } from '../libs/InMemoryLlmRegistry';
import { LlmService } from '../libs/LlmService';
import type { StreamChunk, StreamParams } from '../libs/types';

class FailingStreamModel extends InMemoryLlmModel {
  constructor() {
    super('failing-stream-model');
  }

  override async *stream(_params: StreamParams): AsyncIterable<StreamChunk> {
    yield { delta: 'partial ' };
    throw new Error('provider stream failed');
  }
}

async function collectStream(chunks: AsyncIterable<StreamChunk>): Promise<string[]> {
  const deltas: string[] = [];

  for await (const chunk of chunks) {
    deltas.push(chunk.delta);
  }

  return deltas;
}

describe('LlmService', () => {
  let service!: LlmService;
  let registry!: InMemoryLlmRegistry;
  let eventBus!: EventBus;

  beforeEach(() => {
    registry = new InMemoryLlmRegistry();
    eventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      clear: vi.fn(),
    };
    service = new LlmService(registry, eventBus);

    registry.registerProvider(
      'test-model',
      () =>
        new InMemoryLlmModel('test-model', {
          Hello: 'Hi there!',
          'How are you?': 'I am doing well!',
        })
    );

    registry.registerProvider(
      'stream-model',
      () =>
        new InMemoryLlmModel('stream-model', {
          'Stream test': 'This is a streaming response',
        })
    );

    registry.registerProvider('embed-model', () => new InMemoryLlmModel('embed-model'));
  });

  describe('generate', () => {
    it('should generate text successfully', async () => {
      const result = await service.generate({
        prompt: 'Hello',
        modelId: 'test-model',
      });

      expect(result.text).toBe('Hi there!');
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should use default model when modelId is not provided', async () => {
      registry.registerProvider(
        'default',
        () =>
          new InMemoryLlmModel('default', {
            'Default test': 'Default response',
          })
      );

      const result = await service.generate({ prompt: 'Default test' });

      expect(result.text).toBe('Default response');
    });

    it('should emit LlmGeneratedEvent after generation', async () => {
      await service.generate({
        prompt: 'Hello',
        modelId: 'test-model',
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'llm.generated',
          type: 'llm.generated',
          modelId: 'test-model',
          prompt: 'Hello',
          result: 'Hi there!',
        })
      );
    });

    it('should include usage in event payload', async () => {
      await service.generate({
        prompt: 'Hello',
        modelId: 'test-model',
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          usage: expect.objectContaining({
            promptTokens: expect.any(Number),
            completionTokens: expect.any(Number),
            totalTokens: expect.any(Number),
          }),
        })
      );
    });

    it('should throw LlmServiceProblem when model is not found', async () => {
      await expect(
        service.generate({
          prompt: 'Test',
          modelId: 'non-existent',
        })
      ).rejects.toThrow();
    });

    it('should invalidate cached models when a provider is re-registered', async () => {
      const first = await service.generate({
        prompt: 'Hello',
        modelId: 'test-model',
      });

      expect(first.text).toBe('Hi there!');

      registry.registerProvider(
        'test-model',
        () =>
          new InMemoryLlmModel('test-model', {
            Hello: 'Updated response',
          })
      );

      const second = await service.generate({
        prompt: 'Hello',
        modelId: 'test-model',
      });

      expect(second.text).toBe('Updated response');
    });
  });

  describe('stream', () => {
    it('should stream text chunks', async () => {
      const chunks: string[] = [];

      for await (const chunk of service.stream({
        prompt: 'Stream test',
        modelId: 'stream-model',
      })) {
        chunks.push(chunk.delta);
      }

      const fullText = chunks.join('');
      expect(fullText).toContain('streaming');
    });

    it('should provide usage information in chunks', async () => {
      const chunks = service.stream({
        prompt: 'Stream test',
        modelId: 'stream-model',
      });

      for await (const chunk of chunks) {
        if (chunk.usage) {
          expect(chunk.usage.totalTokens).toBeGreaterThan(0);
        }
      }
    });

    it('should handle empty response', async () => {
      registry.registerProvider('empty-model', () => new InMemoryLlmModel('empty-model', { Empty: '' }));

      const chunks: string[] = [];
      for await (const chunk of service.stream({
        prompt: 'Empty',
        modelId: 'empty-model',
      })) {
        chunks.push(chunk.delta);
      }

      expect(chunks.length).toBe(0);
    });

    it('BUG-06 stream 완료 시 LlmStreamCompletedEvent 발행', async () => {
      for await (const _chunk of service.stream({
        prompt: 'Stream test',
        modelId: 'stream-model',
      })) {
      }

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'llm.stream_completed',
          type: 'llm.stream_completed',
          modelId: 'stream-model',
          usage: expect.objectContaining({
            promptTokens: expect.any(Number),
            completionTokens: expect.any(Number),
            totalTokens: expect.any(Number),
          }),
        })
      );
    });

    it('should propagate stream model lookup errors to the consumer', async () => {
      await expect(
        collectStream(
          service.stream({
            prompt: 'Stream test',
            modelId: 'missing-stream-model',
          })
        )
      ).rejects.toThrow();
    });

    it('should propagate provider stream errors to the consumer', async () => {
      registry.registerProvider('failing-stream-model', () => new FailingStreamModel());

      await expect(
        collectStream(
          service.stream({
            prompt: 'Stream test',
            modelId: 'failing-stream-model',
          })
        )
      ).rejects.toThrow(/provider stream failed/);
    });

    it('should propagate stream completion event publish errors to the consumer', async () => {
      vi.mocked(eventBus.publish).mockRejectedValueOnce(new Error('publish failed'));

      await expect(
        collectStream(
          service.stream({
            prompt: 'Stream test',
            modelId: 'stream-model',
          })
        )
      ).rejects.toThrow(/publish failed/);
    });
  });

  describe('embed', () => {
    it('should generate embedding for single text', async () => {
      const result = await service.embed({
        text: 'Hello world',
        modelId: 'embed-model',
      });

      expect(result.embedding).toBeInstanceOf(Array);
      expect(result.embedding.length).toBeGreaterThan(0);
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should use default model when modelId is not provided', async () => {
      registry.registerProvider('default', () => new InMemoryLlmModel('default'));

      const result = await service.embed({ text: 'Test' });

      expect(result.embedding).toBeInstanceOf(Array);
    });
  });

  describe('embedMany', () => {
    it('should generate embeddings for multiple texts', async () => {
      const result = await service.embedMany({
        texts: ['Hello', 'World'],
        modelId: 'embed-model',
      });

      expect(result.embeddings).toBeInstanceOf(Array);
      expect(result.embeddings.length).toBe(2);
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should handle empty array', async () => {
      const result = await service.embedMany({
        texts: [],
        modelId: 'embed-model',
      });

      expect(result.embeddings).toEqual([]);
    });
  });

  describe('generateObject', () => {
    beforeEach(() => {
      registry.registerProvider(
        'object-model',
        () =>
          new InMemoryLlmModel('object-model', {
            'Parse user': '{"name":"John","age":30}',
            'Invalid JSON': 'not a json',
          })
      );
    });

    it('should parse JSON response', async () => {
      const result = await service.generateObject({
        prompt: 'Parse user',
        modelId: 'object-model',
        schema: {},
      });

      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should use default model when modelId is not provided', async () => {
      registry.registerProvider(
        'default',
        () => new InMemoryLlmModel('default', { 'Default object': '{"key":"value"}' })
      );

      const result = await service.generateObject({
        prompt: 'Default object',
        schema: {},
      });

      expect(result).toEqual({ key: 'value' });
    });

    it('should throw error when JSON is invalid', async () => {
      await expect(
        service.generateObject({
          prompt: 'Invalid JSON',
          modelId: 'object-model',
          schema: {},
        })
      ).rejects.toThrow();
    });

    it('should throw LlmServiceProblem when model is not found', async () => {
      await expect(
        service.generateObject({
          prompt: 'Test',
          modelId: 'non-existent',
          schema: {},
        })
      ).rejects.toThrow();
    });
  });

  describe('callTool', () => {
    beforeEach(() => {
      registry.registerProvider(
        'tool-model',
        () =>
          new InMemoryLlmModel('tool-model', {
            'Call weather': 'getWeather:{"city":"Seoul"}',
            'Multiple tools': 'search:{"query":"test"}|calculate:{"a":1,"b":2}',
            'No tools': 'No tools needed',
          })
      );
    });

    it('should execute single tool', async () => {
      const result = await service.callTool({
        prompt: 'Call weather',
        modelId: 'tool-model',
        tools: [
          {
            name: 'getWeather',
            description: 'Get weather',
            parameters: { type: 'object', properties: { city: { type: 'string' } } },
          },
        ],
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]?.name).toBe('getWeather');
      expect(result.toolCalls[0]?.arguments).toEqual({ city: 'Seoul' });
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should execute multiple tools', async () => {
      const result = await service.callTool({
        prompt: 'Multiple tools',
        modelId: 'tool-model',
        tools: [
          { name: 'search', description: 'Search', parameters: { type: 'object' } },
          { name: 'calculate', description: 'Calculate', parameters: { type: 'object' } },
        ],
      });

      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0]?.name).toBe('search');
      expect(result.toolCalls[1]?.name).toBe('calculate');
    });

    it('should handle no tools called', async () => {
      const result = await service.callTool({
        prompt: 'No tools',
        modelId: 'tool-model',
        tools: [{ name: 'test', description: 'Test', parameters: { type: 'object' } }],
      });

      expect(result.toolCalls).toEqual([]);
    });

    it('should use default model when modelId is not provided', async () => {
      registry.registerProvider(
        'default',
        () => new InMemoryLlmModel('default', { 'Default tool': 'defaultAction:{"param":"value"}' })
      );

      const result = await service.callTool({
        prompt: 'Default tool',
        tools: [{ name: 'defaultAction', description: 'Action', parameters: { type: 'object' } }],
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]?.name).toBe('defaultAction');
    });

    it('should throw LlmServiceProblem when model is not found', async () => {
      await expect(
        service.callTool({
          prompt: 'Test',
          modelId: 'non-existent',
          tools: [],
        })
      ).rejects.toThrow();
    });
  });
});
