import type { EventBus } from "@croco/events-core";
import { Container } from "@croco/framework-context";
import type { MeteringService } from "@croco/metering-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiMetered, setLlmMeteringService } from "../../libs/decorators/AiMetered";
import { LlmMeteringService } from "../../libs/LlmMeteringService";
import { LlmMeteringRecordFailedProblem } from "../../libs/problems/LlmMeteringProblems";

describe("@AiMetered decorator", () => {
  let mockMeteringService!: MeteringService;
  let mockEventBus!: EventBus;
  let llmMeteringService!: LlmMeteringService;

  beforeEach(() => {
    Container.reset();

    // Mock MeteringService
    mockMeteringService = {
      record: vi.fn().mockResolvedValue({ id: "test-record-id", tenantId: "tenant-123" }),
      getUsage: vi.fn().mockResolvedValue(1000),
    } as unknown as MeteringService;

    // Mock EventBus
    mockEventBus = {
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockReturnValue(() => {}),
    } as unknown as EventBus;

    llmMeteringService = new LlmMeteringService({
      meteringService: mockMeteringService,
      eventBus: mockEventBus,
    });

    // Set service for decorator
    setLlmMeteringService(llmMeteringService);
  });

  describe("generate/stream methods", () => {
    it("should automatically record usage when method returns GenerateResult", async () => {
      class TestService {
        tenantId = "tenant-123";

        @AiMetered()
        async generateText(_prompt: string) {
          // Simulate LlmService.generate() response
          return {
            text: "Hello, world!",
            usage: {
              promptTokens: 10,
              completionTokens: 20,
              totalTokens: 30,
              accuracy: "EXACT" as const,
            },
            metadata: {
              modelId: "gpt-4",
              provider: "openai",
            },
          };
        }
      }

      const service = new TestService();
      const result = await service.generateText("test");

      expect(result.text).toBe("Hello, world!");
      expect(mockMeteringService.record).toHaveBeenCalled();
    });

    it("should extract usage from result and record 3 meters", async () => {
      class TestService {
        @AiMetered()
        async generate() {
          return {
            text: "Response",
            usage: {
              promptTokens: 100,
              completionTokens: 50,
              totalTokens: 150,
            },
            metadata: {
              modelId: "gpt-4",
              provider: "openai",
            },
          };
        }
      }

      const service = new TestService();
      await service.generate();

      // Verify 3 records: prompt, completion, cost
      expect(mockMeteringService.record).toHaveBeenCalledTimes(3);
    });

    it("should use custom idempotencyKeyExtractor", async () => {
      class TestService {
        @AiMetered({
          idempotencyKeyExtractor: (args) => args[0] as string,
        })
        async generate(_id: string, text: string) {
          return {
            text,
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            metadata: { modelId: "gpt-4", provider: "openai" },
          };
        }
      }

      const service = new TestService();
      await service.generate("custom-key-123", "test");

      expect(mockMeteringService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "custom-key-123:prompt",
        }),
      );
    });

    it("should use custom metadataExtractor", async () => {
      class TestService {
        @AiMetered({
          metadataExtractor: (args, _result) => ({
            customField: "custom-value",
            prompt: args[0],
          }),
        })
        async generate(_prompt: string) {
          return {
            text: "Response",
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            metadata: { modelId: "gpt-4", provider: "openai" },
          };
        }
      }

      const service = new TestService();
      await service.generate("my prompt");

      expect(mockMeteringService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            customField: "custom-value",
            prompt: "my prompt",
          }),
        }),
      );
    });

    it("should generate stable default idempotency keys for identical inputs", async () => {
      class TestService {
        @AiMetered()
        async generate(prompt: string, options: { temperature: number }) {
          return {
            text: prompt,
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            metadata: { modelId: "gpt-4", provider: "openai" },
            options,
          };
        }
      }

      const service = new TestService();

      await service.generate("hello", { temperature: 0.7 });
      await service.generate("hello", { temperature: 0.7 });

      const firstKey = vi.mocked(mockMeteringService.record).mock.calls[0]?.[0]?.idempotencyKey;
      const secondKey = vi.mocked(mockMeteringService.record).mock.calls[3]?.[0]?.idempotencyKey;

      expect(firstKey).toBe(secondKey);
    });

    it("should ignore object key order when generating default idempotency keys", async () => {
      class TestService {
        @AiMetered()
        async generate(payload: Record<string, unknown>) {
          return {
            text: "Response",
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            metadata: { modelId: "gpt-4", provider: "openai" },
            payload,
          };
        }
      }

      const service = new TestService();

      await service.generate({ a: 1, b: 2, nested: { x: 1, y: 2 } });
      await service.generate({ b: 2, a: 1, nested: { y: 2, x: 1 } });

      const firstKey = vi.mocked(mockMeteringService.record).mock.calls[0]?.[0]?.idempotencyKey;
      const secondKey = vi.mocked(mockMeteringService.record).mock.calls[3]?.[0]?.idempotencyKey;

      expect(firstKey).toBe(secondKey);
    });

    it("BUG-07 스트림 결과의 토큰 사용량 기록", async () => {
      class TestService {
        @AiMetered()
        stream() {
          return this.createStream();
        }

        private async *createStream() {
          yield { delta: "Hello " };
          yield {
            delta: "world",
            usage: {
              promptTokens: 11,
              completionTokens: 12,
              totalTokens: 23,
              accuracy: "EXACT" as const,
            },
          };
        }
      }

      const service = new TestService();
      const stream = await Promise.resolve(service.stream());
      const chunks: string[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk.delta);
      }

      expect(chunks.join("")).toBe("Hello world");
      expect(mockMeteringService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          meterId: "llm.prompt_tokens",
          value: 11,
          metadata: expect.objectContaining({
            operationType: "stream",
          }),
        }),
      );
      expect(mockMeteringService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          meterId: "llm.completion_tokens",
          value: 12,
        }),
      );
      expect(mockMeteringService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          meterId: "llm.cost_usd",
          metadata: expect.objectContaining({
            operationType: "stream",
          }),
        }),
      );
    });
  });

  describe("embed/embedMany methods", () => {
    it("should record embedding usage for embed results", async () => {
      class TestService {
        @AiMetered()
        async embed(_text: string) {
          return {
            embedding: [0.1, 0.2, 0.3],
            usage: {
              tokens: 5,
            },
            metadata: {
              modelId: "text-embedding-3-small",
              provider: "openai",
            },
          };
        }
      }

      const service = new TestService();
      const result = await service.embed("test");

      expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(mockMeteringService.record).toHaveBeenCalled();
    });
  });

  describe("metering failure behavior", () => {
    it("should throw when metering fails", async () => {
      class TestService {
        @AiMetered()
        async generate() {
          return {
            text: "Response",
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            metadata: { modelId: "gpt-4", provider: "openai" },
          };
        }
      }

      // Mock record to throw
      vi.mocked(mockMeteringService.record).mockRejectedValue(new Error("Metering failed"));

      const service = new TestService();
      await expect(service.generate()).rejects.toThrow(LlmMeteringRecordFailedProblem);
    });

    it("should work when LlmMeteringService is not set", async () => {
      // Clear service
      setLlmMeteringService(null as unknown as LlmMeteringService);

      class TestService {
        @AiMetered()
        async generate() {
          return {
            text: "Response",
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
            metadata: { modelId: "gpt-4", provider: "openai" },
          };
        }
      }

      const service = new TestService();
      const result = await service.generate();

      // Should return result without metering
      expect(result.text).toBe("Response");
      expect(mockMeteringService.record).not.toHaveBeenCalled();
    });
  });

  describe("metadata storage", () => {
    it("should store metadata on the method", () => {
      class TestService {
        @AiMetered({
          tenantId: "custom-tenant",
        })
        async generate() {
          return {
            text: "test",
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
          };
        }
      }

      const prototype = TestService.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, "generate");
      expect(descriptor).not.toBeUndefined();
    });
  });
});
