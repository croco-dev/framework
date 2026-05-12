import { beforeEach, describe, expect, it } from "vitest";
import { LlmModel } from "../libs/LlmModel";
import type {
  EmbedManyParams,
  EmbedManyResult,
  EmbedParams,
  EmbedResult,
  GenerateObjectParams,
  GenerateParams,
  GenerateResult,
  LlmCapabilities,
  StreamChunk,
  StreamParams,
  ToolCallParams,
  ToolCallResult,
  ToolDefinition,
} from "../libs/types";

describe("LlmModel", () => {
  class TestLlmModel extends LlmModel {
    readonly modelId = "test-model";
    readonly capabilities: LlmCapabilities = {
      streaming: true,
      objectGeneration: true,
      toolCalling: true,
      embedding: true,
    };

    async generate(params: GenerateParams): Promise<GenerateResult> {
      return {
        text: `Response to: ${params.prompt}`,
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };
    }

    async *stream(params: StreamParams): AsyncIterable<StreamChunk> {
      const words = `Response to: ${params.prompt}`.split(" ");
      for (const word of words) {
        yield { delta: `${word} ` };
      }
      yield {
        delta: "",
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };
    }

    async generateObject<T>(params: GenerateObjectParams<T>): Promise<T> {
      // 간단한 테스트용 구현
      return params.schema as T;
    }

    async callTool(params: ToolCallParams): Promise<ToolCallResult> {
      return {
        toolCalls: [
          {
            name: params.tools[0]?.name || "test",
            arguments: { input: params.prompt },
          },
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
      };
    }

    async embed(_params: EmbedParams): Promise<EmbedResult> {
      return {
        embedding: Array.from({ length: 1536 }, () => Math.random()),
        usage: {
          promptTokens: 5,
          completionTokens: 0,
          totalTokens: 5,
        },
      };
    }

    async embedMany(params: EmbedManyParams): Promise<EmbedManyResult> {
      return {
        embeddings: params.texts.map(() => Array.from({ length: 1536 }, () => Math.random())),
        usage: {
          promptTokens: params.texts.length * 5,
          completionTokens: 0,
          totalTokens: params.texts.length * 5,
        },
      };
    }
  }

  let model!: TestLlmModel;

  beforeEach(() => {
    model = new TestLlmModel();
  });

  it("should have token", () => {
    expect(LlmModel.token.name).toBe("LlmModel");
  });

  it("should have modelId", () => {
    expect(model.modelId).toBe("test-model");
  });

  it("should have capabilities", () => {
    expect(model.capabilities).toEqual({
      streaming: true,
      objectGeneration: true,
      toolCalling: true,
      embedding: true,
    });
  });

  describe("generate", () => {
    it("should generate text response", async () => {
      const result = await model.generate({ prompt: "Hello" });
      expect(result.text).toContain("Hello");
      expect(result.usage.totalTokens).toBe(30);
    });

    it("should support system prompt", async () => {
      const result = await model.generate({
        prompt: "Hello",
        systemPrompt: "You are a helpful assistant",
      });
      expect(result.text).not.toBeUndefined();
    });

    it("should support temperature option", async () => {
      const result = await model.generate({
        prompt: "Hello",
        temperature: 0.7,
      });
      expect(result.text).not.toBeUndefined();
    });

    it("should support maxTokens option", async () => {
      const result = await model.generate({
        prompt: "Hello",
        maxTokens: 100,
      });
      expect(result.text).not.toBeUndefined();
    });

    it("should support stop sequences", async () => {
      const result = await model.generate({
        prompt: "Hello",
        stopSequences: ["END"],
      });
      expect(result.text).not.toBeUndefined();
    });

    it("should support metadata", async () => {
      const result = await model.generate({
        prompt: "Hello",
        metadata: { requestId: "123" },
      });
      expect(result.text).not.toBeUndefined();
    });
  });

  describe("stream", () => {
    it("should stream text response", async () => {
      const chunks: string[] = [];
      for await (const chunk of model.stream({ prompt: "Hello" })) {
        chunks.push(chunk.delta);
      }
      expect(chunks.length).toBeGreaterThan(0);
    });

    it("should include usage in final chunk", async () => {
      const chunks: StreamChunk[] = [];
      for await (const chunk of model.stream({ prompt: "Hello" })) {
        chunks.push(chunk);
      }
      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.usage).not.toBeUndefined();
      expect(lastChunk.usage?.totalTokens).toBe(30);
    });
  });

  describe("generateObject", () => {
    it("should generate object from schema", async () => {
      const schema = { name: "Test", value: 42 };
      const result = await model.generateObject({
        prompt: "Create an object",
        schema,
      });
      expect(result).toEqual(schema);
    });
  });

  describe("callTool", () => {
    it("should call tools and return results", async () => {
      const tools: ToolDefinition[] = [
        {
          name: "calculator",
          description: "Calculate",
          parameters: {
            type: "object",
            properties: {
              expression: { type: "string" },
            },
          },
        },
      ];
      const result = await model.callTool({
        tools,
        prompt: "Calculate 1+1",
      });
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]?.name).toBe("calculator");
      expect(result.usage.totalTokens).toBe(15);
    });
  });

  describe("embed", () => {
    it("should generate embedding for single text", async () => {
      const result = await model.embed({ text: "Hello world" });
      expect(result.embedding).toHaveLength(1536);
      expect(result.usage.totalTokens).toBe(5);
    });
  });

  describe("embedMany", () => {
    it("should generate embeddings for multiple texts", async () => {
      const texts = ["Hello", "world", "test"];
      const result = await model.embedMany({ texts });
      expect(result.embeddings).toHaveLength(3);
      expect(result.embeddings[0]).toHaveLength(1536);
      expect(result.usage.totalTokens).toBe(15);
    });
  });
});
