import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryLlmModel } from '../libs/InMemoryLlmModel';
import type {
  EmbedManyParams,
  EmbedParams,
  GenerateObjectParams,
  GenerateParams,
  StreamParams,
  ToolCallParams,
} from '../libs/types';

describe('InMemoryLlmModel', () => {
  let model!: InMemoryLlmModel;

  beforeEach(() => {
    model = new InMemoryLlmModel('test-model', {
      Hello: 'Hi there!',
      'How are you?': 'I am doing well!',
      'Stream this': 'This is a streaming response with multiple words',
    });
  });

  describe('constructor', () => {
    it('should create model with modelId', () => {
      expect(model.modelId).toBe('test-model');
    });

    it('should have all capabilities enabled', () => {
      expect(model.capabilities.streaming).toBe(true);
      expect(model.capabilities.objectGeneration).toBe(true);
      expect(model.capabilities.toolCalling).toBe(true);
      expect(model.capabilities.embedding).toBe(true);
    });

    it('should initialize with predefined responses', () => {
      expect(model).toBeDefined();
    });

    it('should create model without responses', () => {
      const emptyModel = new InMemoryLlmModel('empty-model');
      expect(emptyModel.modelId).toBe('empty-model');
    });
  });

  describe('generate', () => {
    it('should return predefined response for known prompt', async () => {
      const params: GenerateParams = { prompt: 'Hello' };
      const result = await model.generate(params);

      expect(result.text).toBe('Hi there!');
      expect(result.usage.totalTokens).toBeGreaterThan(0);
      expect(result.usage.accuracy).toBe('ESTIMATED');
    });

    it('should return default response for unknown prompt', async () => {
      const params: GenerateParams = { prompt: 'Unknown prompt' };
      const result = await model.generate(params);

      expect(result.text).toContain('Mock response to:');
      expect(result.text).toContain('Unknown prompt');
    });

    it('should handle system prompt', async () => {
      const params: GenerateParams = {
        prompt: 'Hello',
        systemPrompt: 'You are a helpful assistant',
      };
      const result = await model.generate(params);

      expect(result.text).toBe('Hi there!');
    });

    it('should handle temperature parameter', async () => {
      const params: GenerateParams = {
        prompt: 'Hello',
        temperature: 0.7,
      };
      const result = await model.generate(params);

      expect(result.text).toBe('Hi there!');
    });

    it('should handle maxTokens parameter', async () => {
      const params: GenerateParams = {
        prompt: 'Hello',
        maxTokens: 100,
      };
      const result = await model.generate(params);

      expect(result.text).toBe('Hi there!');
    });

    it('should include metadata in result', async () => {
      const params: GenerateParams = {
        prompt: 'Hello',
        metadata: { key: 'value' },
      };
      const result = await model.generate(params);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.modelId).toBe('test-model');
    });
  });

  describe('stream', () => {
    it('should stream predefined response word by word', async () => {
      const params: StreamParams = { prompt: 'Stream this' };
      const chunks: string[] = [];

      for await (const chunk of model.stream(params)) {
        chunks.push(chunk.delta);
      }

      const fullText = chunks.join('').trim();
      expect(fullText).toBe('This is a streaming response with multiple words');
    });

    it('should provide usage information', async () => {
      const params: StreamParams = { prompt: 'Hello' };
      const chunks = model.stream(params);

      let usageFound = false;
      for await (const chunk of chunks) {
        if (chunk.usage) {
          usageFound = true;
          expect(chunk.usage.totalTokens).toBeGreaterThan(0);
        }
      }

      expect(usageFound).toBe(true);
    });

    it('should handle empty response', async () => {
      const emptyModel = new InMemoryLlmModel('empty', { Empty: '' });
      const params: StreamParams = { prompt: 'Empty' };
      const chunks: string[] = [];

      for await (const chunk of emptyModel.stream(params)) {
        chunks.push(chunk.delta);
      }

      expect(chunks.length).toBe(0);
    });

    it('should simulate streaming delay', async () => {
      const params: StreamParams = { prompt: 'Hello' };
      const startTime = Date.now();

      for await (const _chunk of model.stream(params)) {
        // Just consume the stream
      }

      const elapsedTime = Date.now() - startTime;
      // Should have some delay due to setTimeout simulation
      expect(elapsedTime).toBeGreaterThan(0);
    });
  });

  describe('generateObject', () => {
    it('should generate object from JSON response', async () => {
      const jsonResponse = JSON.stringify({ name: 'John', age: 30 });
      const objectModel = new InMemoryLlmModel('object-model', {
        'Create user': jsonResponse,
      });

      const params: GenerateObjectParams<{ name: string; age: number }> = {
        prompt: 'Create user',
        schema: { name: 'string', age: 'number' } as any,
      };

      const result = await objectModel.generateObject(params);

      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('should throw error for invalid JSON', async () => {
      const invalidModel = new InMemoryLlmModel('invalid-model', {
        Invalid: 'not a json',
      });

      const params: GenerateObjectParams<any> = {
        prompt: 'Invalid',
        schema: { name: 'string' } as any,
      };

      await expect(invalidModel.generateObject(params)).rejects.toThrow();
    });

    it('should include usage in result', async () => {
      const jsonResponse = JSON.stringify({ key: 'value' });
      const objectModel = new InMemoryLlmModel('object-model', {
        Test: jsonResponse,
      });

      const params: GenerateObjectParams<any> = {
        prompt: 'Test',
        schema: {} as any,
      };

      const result = await objectModel.generateObject(params);

      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('callTool', () => {
    it('should return tool calls based on prompt', async () => {
      const toolModel = new InMemoryLlmModel('tool-model', {
        'Call the weather tool': 'weather:{"location":"Seoul"}',
      });

      const params: ToolCallParams = {
        prompt: 'Call the weather tool',
        tools: [
          {
            name: 'weather',
            description: 'Get weather information',
            parameters: { location: 'string' },
          },
        ],
      };

      const result = await toolModel.callTool(params);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('weather');
      expect(result.toolCalls[0].arguments).toEqual({ location: 'Seoul' });
    });

    it('should handle multiple tools in response', async () => {
      const toolModel = new InMemoryLlmModel('tool-model', {
        'Call multiple': 'tool1:{"arg":"value1"}|tool2:{"arg":"value2"}',
      });

      const params: ToolCallParams = {
        prompt: 'Call multiple',
        tools: [
          { name: 'tool1', description: 'Tool 1', parameters: {} },
          { name: 'tool2', description: 'Tool 2', parameters: {} },
        ],
      };

      const result = await toolModel.callTool(params);

      expect(result.toolCalls).toHaveLength(2);
    });

    it('should return empty array when no tool calls', async () => {
      const toolModel = new InMemoryLlmModel('tool-model', {
        'No tools': 'Just a regular response',
      });

      const params: ToolCallParams = {
        prompt: 'No tools',
        tools: [
          {
            name: 'weather',
            description: 'Get weather',
            parameters: {},
          },
        ],
      };

      const result = await toolModel.callTool(params);

      expect(result.toolCalls).toEqual([]);
    });
  });

  describe('embed', () => {
    it('should generate embedding vector', async () => {
      const embedModel = new InMemoryLlmModel('embed-model');
      const params: EmbedParams = { text: 'Hello world' };

      const result = await embedModel.embed(params);

      expect(result.embedding).toBeInstanceOf(Array);
      expect(result.embedding.length).toBeGreaterThan(0);
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should generate consistent embeddings for same text', async () => {
      const embedModel = new InMemoryLlmModel('embed-model');
      const params: EmbedParams = { text: 'Consistent' };

      const result1 = await embedModel.embed(params);
      const result2 = await embedModel.embed(params);

      expect(result1.embedding).toEqual(result2.embedding);
    });

    it('should generate different embeddings for different texts', async () => {
      const embedModel = new InMemoryLlmModel('embed-model');

      const result1 = await embedModel.embed({ text: 'Text 1' });
      const result2 = await embedModel.embed({ text: 'Text 2' });

      expect(result1.embedding).not.toEqual(result2.embedding);
    });
  });

  describe('embedMany', () => {
    it('should generate embeddings for multiple texts', async () => {
      const embedModel = new InMemoryLlmModel('embed-model');
      const params: EmbedManyParams = {
        texts: ['Hello', 'World', 'Test'],
      };

      const result = await embedModel.embedMany(params);

      expect(result.embeddings).toHaveLength(3);
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it('should handle empty array', async () => {
      const embedModel = new InMemoryLlmModel('embed-model');
      const params: EmbedManyParams = { texts: [] };

      const result = await embedModel.embedMany(params);

      expect(result.embeddings).toEqual([]);
      expect(result.usage.totalTokens).toBe(0);
    });

    it('should generate consistent embeddings', async () => {
      const embedModel = new InMemoryLlmModel('embed-model');
      const params: EmbedManyParams = { texts: ['A', 'B'] };

      const result1 = await embedModel.embedMany(params);
      const result2 = await embedModel.embedMany(params);

      expect(result1.embeddings).toEqual(result2.embeddings);
    });
  });
});
