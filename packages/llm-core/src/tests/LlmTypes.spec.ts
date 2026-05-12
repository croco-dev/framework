import { describe, expect, it } from "vitest";
import type {
  EmbedManyParams,
  EmbedManyResult,
  EmbedParams,
  EmbedResult,
  GenerateObjectParams,
  GenerateParams,
  GenerateResult,
  LlmCapabilities,
  LlmMetadata,
  LlmModelConfig,
  LlmUsage,
  StreamChunk,
  StreamParams,
  ToolCallParams,
  ToolCallResult,
  ToolDefinition,
  UsageAccuracy,
} from "../libs/types";

describe("types", () => {
  describe("GenerateParams", () => {
    it("should accept minimal params", () => {
      const params: GenerateParams = { prompt: "Hello" };
      expect(params.prompt).toBe("Hello");
    });

    it("should accept all optional fields", () => {
      const params: GenerateParams = {
        prompt: "Hello",
        systemPrompt: "You are helpful",
        temperature: 0.7,
        maxTokens: 100,
        stopSequences: ["END"],
        metadata: { key: "value" },
      };
      expect(params.systemPrompt).toBe("You are helpful");
      expect(params.temperature).toBe(0.7);
      expect(params.maxTokens).toBe(100);
      expect(params.stopSequences).toEqual(["END"]);
      expect(params.metadata).toEqual({ key: "value" });
    });
  });

  describe("GenerateResult", () => {
    it("should have text and usage", () => {
      const result: GenerateResult = {
        text: "Response",
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };
      expect(result.text).toBe("Response");
      expect(result.usage.totalTokens).toBe(30);
    });

    it("should have optional metadata", () => {
      const result: GenerateResult = {
        text: "Response",
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        metadata: {
          modelId: "gpt-4",
          finishReason: "stop",
        },
      };
      expect(result.metadata?.modelId).toBe("gpt-4");
      expect(result.metadata?.finishReason).toBe("stop");
    });
  });

  describe("StreamParams", () => {
    it("should accept GenerateParams fields", () => {
      const params: StreamParams = {
        prompt: "Hello",
        temperature: 0.7,
      };
      expect(params.prompt).toBe("Hello");
      expect(params.temperature).toBe(0.7);
    });
  });

  describe("StreamChunk", () => {
    it("should have delta", () => {
      const chunk: StreamChunk = { delta: "Hello" };
      expect(chunk.delta).toBe("Hello");
    });

    it("should have optional usage", () => {
      const chunk: StreamChunk = {
        delta: "world",
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };
      expect(chunk.usage?.totalTokens).toBe(30);
    });
  });

  describe("GenerateObjectParams", () => {
    it("should accept GenerateParams and schema", () => {
      const params: GenerateObjectParams<{ name: string }> = {
        prompt: "Create object",
        schema: { name: "Test" },
      };
      expect(params.schema.name).toBe("Test");
    });

    it("should accept mode option", () => {
      const params: GenerateObjectParams<{ name: string }> = {
        prompt: "Create object",
        schema: { name: "Test" },
        mode: "json",
      };
      expect(params.mode).toBe("json");
    });
  });

  describe("ToolDefinition", () => {
    it("should have required fields", () => {
      const tool: ToolDefinition = {
        name: "calculator",
        description: "Calculate expressions",
        parameters: {
          type: "object",
          properties: {
            expression: { type: "string" },
          },
        },
      };
      expect(tool.name).toBe("calculator");
      expect(tool.description).toBe("Calculate expressions");
      expect(tool.parameters).not.toBeUndefined();
    });
  });

  describe("ToolCallParams", () => {
    it("should accept tools and prompt", () => {
      const tools: ToolDefinition[] = [
        {
          name: "test",
          description: "Test tool",
          parameters: {},
        },
      ];
      const params: ToolCallParams = {
        tools,
        prompt: "Use tool",
      };
      expect(params.tools).toHaveLength(1);
      expect(params.prompt).toBe("Use tool");
    });

    it("should accept systemPrompt", () => {
      const params: ToolCallParams = {
        tools: [{ name: "test", description: "Test", parameters: {} }],
        prompt: "Use tool",
        systemPrompt: "You are helpful",
      };
      expect(params.systemPrompt).toBe("You are helpful");
    });
  });

  describe("ToolCallResult", () => {
    it("should have toolCalls and usage", () => {
      const result: ToolCallResult = {
        toolCalls: [
          {
            name: "calculator",
            arguments: { expression: "1+1" },
          },
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]?.name).toBe("calculator");
      expect(result.usage.totalTokens).toBe(30);
    });
  });

  describe("EmbedParams", () => {
    it("should accept text", () => {
      const params: EmbedParams = { text: "Hello world" };
      expect(params.text).toBe("Hello world");
    });

    it("should accept optional modelId", () => {
      const params: EmbedParams = {
        text: "Hello",
        modelId: "text-embedding-ada-002",
      };
      expect(params.modelId).toBe("text-embedding-ada-002");
    });
  });

  describe("EmbedResult", () => {
    it("should have embedding and usage", () => {
      const result: EmbedResult = {
        embedding: [0.1, 0.2, 0.3],
        usage: {
          promptTokens: 5,
          completionTokens: 0,
          totalTokens: 5,
        },
      };
      expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(result.usage.totalTokens).toBe(5);
    });
  });

  describe("EmbedManyParams", () => {
    it("should accept texts", () => {
      const params: EmbedManyParams = {
        texts: ["Hello", "world"],
      };
      expect(params.texts).toHaveLength(2);
    });

    it("should accept optional modelId", () => {
      const params: EmbedManyParams = {
        texts: ["Hello"],
        modelId: "text-embedding-ada-002",
      };
      expect(params.modelId).toBe("text-embedding-ada-002");
    });
  });

  describe("EmbedManyResult", () => {
    it("should have embeddings and usage", () => {
      const result: EmbedManyResult = {
        embeddings: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 0,
          totalTokens: 10,
        },
      };
      expect(result.embeddings).toHaveLength(2);
      expect(result.usage.totalTokens).toBe(10);
    });
  });

  describe("LlmUsage", () => {
    it("should have token counts", () => {
      const usage: LlmUsage = {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      };
      expect(usage.promptTokens).toBe(10);
      expect(usage.completionTokens).toBe(20);
      expect(usage.totalTokens).toBe(30);
    });

    it("should accept optional accuracy", () => {
      const usage: LlmUsage = {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        accuracy: "EXACT",
      };
      expect(usage.accuracy).toBe("EXACT");
    });
  });

  describe("UsageAccuracy", () => {
    it("should accept EXACT", () => {
      const accuracy: UsageAccuracy = "EXACT";
      expect(accuracy).toBe("EXACT");
    });

    it("should accept ESTIMATED", () => {
      const accuracy: UsageAccuracy = "ESTIMATED";
      expect(accuracy).toBe("ESTIMATED");
    });

    it("should accept UNKNOWN", () => {
      const accuracy: UsageAccuracy = "UNKNOWN";
      expect(accuracy).toBe("UNKNOWN");
    });
  });

  describe("LlmMetadata", () => {
    it("should have modelId", () => {
      const metadata: LlmMetadata = {
        modelId: "gpt-4",
      };
      expect(metadata.modelId).toBe("gpt-4");
    });

    it("should accept optional finishReason", () => {
      const metadata: LlmMetadata = {
        modelId: "gpt-4",
        finishReason: "stop",
      };
      expect(metadata.finishReason).toBe("stop");
    });

    it("should accept additional fields", () => {
      const metadata: LlmMetadata = {
        modelId: "gpt-4",
        customField: "value",
      };
      expect(metadata.customField).toBe("value");
    });
  });

  describe("LlmModelConfig", () => {
    it("should have modelId", () => {
      const config: LlmModelConfig = { modelId: "gpt-4" };
      expect(config.modelId).toBe("gpt-4");
    });

    it("should accept optional fields", () => {
      const config: LlmModelConfig = {
        modelId: "gpt-4",
        apiKey: "sk-test",
        baseUrl: "https://api.openai.com",
        timeout: 30000,
      };
      expect(config.apiKey).toBe("sk-test");
      expect(config.baseUrl).toBe("https://api.openai.com");
      expect(config.timeout).toBe(30000);
    });
  });

  describe("LlmCapabilities", () => {
    it("should have all capability flags", () => {
      const capabilities: LlmCapabilities = {
        streaming: true,
        objectGeneration: true,
        toolCalling: true,
        embedding: false,
      };
      expect(capabilities.streaming).toBe(true);
      expect(capabilities.objectGeneration).toBe(true);
      expect(capabilities.toolCalling).toBe(true);
      expect(capabilities.embedding).toBe(false);
    });
  });
});
