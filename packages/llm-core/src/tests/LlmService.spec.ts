import type { EventBus } from '@croco/events-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryLlmModel } from '../libs/InMemoryLlmModel';
import { InMemoryLlmRegistry } from '../libs/InMemoryLlmRegistry';
import { LlmService } from '../libs/LlmService';

describe('LlmService', () => {
  let service!: LlmService;
  let registry!: InMemoryLlmRegistry;
  let eventBus: EventBus;

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
          eventName: 'LlmGeneratedEvent',
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
  });

  describe('embed', () => {
    it('should generate embedding for single text', async () => {
      const result = await service.embed({
        text: 'Hello world',
        model: 'embed-model',
      });

      expect(result.embedding).toBeInstanceOf(Array);
      expect(result.embedding.length).toBeGreaterThan(0);
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should use default model when model is not provided', async () => {
      registry.registerProvider('default', () => new InMemoryLlmModel('default'));

      const result = await service.embed({ text: 'Test' });

      expect(result.embedding).toBeInstanceOf(Array);
    });
  });

  describe('embedMany', () => {
    it('should generate embeddings for multiple texts', async () => {
      const result = await service.embedMany({
        texts: ['Hello', 'World'],
        model: 'embed-model',
      });

      expect(result.embeddings).toBeInstanceOf(Array);
      expect(result.embeddings.length).toBe(2);
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should handle empty array', async () => {
      const result = await service.embedMany({
        texts: [],
        model: 'embed-model',
      });

      expect(result.embeddings).toEqual([]);
    });
  });
});
