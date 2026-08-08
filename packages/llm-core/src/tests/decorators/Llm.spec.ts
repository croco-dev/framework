import "reflect-metadata";
import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LLM_METADATA_KEY, Llm, setLlmService } from "../../libs/decorators/Llm";
import type { LlmService } from "../../libs/LlmService";
import { InvalidLlmPromptProblem } from "../../libs/problems/LlmProblems";
import type { LlmMetadata } from "../../libs/types";
import type { LlmInvocationOptions } from "../../libs/decorators/Llm";

describe("@Llm Decorator", () => {
  let mockLlmService!: LlmService;
  let testService!: TestService;

  // 테스트용 서비스 클래스
  class TestService {
    @Llm({ modelId: "gpt-4" })
    async generateText(prompt: string, _options?: LlmInvocationOptions): Promise<string> {
      return prompt; // 데코레이터가 오버라이드함
    }

    @Llm({ modelId: "gpt-3.5-turbo", systemPrompt: "You are helpful." })
    async chat(userPrompt: string): Promise<string> {
      return userPrompt; // 데코레이터가 오버라이드함
    }

    @Llm()
    async defaultModel(prompt: string): Promise<string> {
      return prompt;
    }
  }

  beforeEach(() => {
    Container.reset();

    // Mock LlmService 생성
    mockLlmService = {
      generate: vi.fn().mockImplementation(async (params) => {
        return {
          text: `Generated: ${params.prompt}`,
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          metadata: {
            modelId: params.modelId ?? "default",
          },
        };
      }),
    } as unknown as LlmService;

    // LlmService 설정
    setLlmService(mockLlmService);

    // 테스트 서비스 인스턴스 생성
    testService = new TestService();
  });

  describe("metadata storage", () => {
    it("should store metadata with modelId", () => {
      const metadata: LlmMetadata = Reflect.getMetadata(
        LLM_METADATA_KEY,
        TestService.prototype,
        "generateText",
      );

      expect(metadata).not.toBeUndefined();
      expect(metadata?.modelId).toBe("gpt-4");
    });

    it("should use default modelId if not provided", () => {
      const metadata: LlmMetadata = Reflect.getMetadata(
        LLM_METADATA_KEY,
        TestService.prototype,
        "defaultModel",
      );

      expect(metadata).not.toBeUndefined();
      expect(metadata?.modelId).toBe("default");
    });
  });

  describe("method wrapping", () => {
    it("should call LlmService.generate with correct params", async () => {
      await testService.generateText("Hello, world!");

      expect(mockLlmService.generate).toHaveBeenCalledWith({
        modelId: "gpt-4",
        prompt: "Hello, world!",
      });
    });

    it("should return generated text from LlmService", async () => {
      const result = await testService.generateText("Test prompt");

      expect(result).toBe("Generated: Test prompt");
    });

    it("should forward a per-call abort signal", async () => {
      const controller = new AbortController();

      await testService.generateText("Cancel this", { signal: controller.signal });

      expect(mockLlmService.generate).toHaveBeenCalledWith(
        expect.objectContaining({ signal: controller.signal }),
      );
    });

    it("should handle multiple parameters", async () => {
      await testService.chat("What is AI?");

      expect(mockLlmService.generate).toHaveBeenCalledWith({
        modelId: "gpt-3.5-turbo",
        systemPrompt: "You are helpful.",
        prompt: "What is AI?",
      });
    });

    it("should use default modelId when not specified", async () => {
      await testService.defaultModel("Test");

      expect(mockLlmService.generate).toHaveBeenCalledWith({
        modelId: "default",
        prompt: "Test",
      });
    });

    it("should fail fast when the first argument is not a string", async () => {
      await expect(testService.generateText(123 as unknown as string)).rejects.toBeInstanceOf(
        InvalidLlmPromptProblem,
      );
      expect(mockLlmService.generate).not.toHaveBeenCalled();
    });

    it("should fail fast when the first argument is missing", async () => {
      await expect(testService.generateText(undefined as unknown as string)).rejects.toBeInstanceOf(
        InvalidLlmPromptProblem,
      );
      expect(mockLlmService.generate).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should propagate errors from LlmService", async () => {
      const error = new Error("LLM service error");
      vi.mocked(mockLlmService.generate).mockRejectedValueOnce(error);

      await expect(testService.generateText("Test")).rejects.toThrow("LLM service error");
    });
  });
});
