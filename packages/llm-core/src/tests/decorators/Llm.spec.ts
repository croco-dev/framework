import "reflect-metadata";
import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearLlmService, getLlmService, runWithLlmService, setLlmService } from "../../index";
import { LLM_METADATA_KEY, Llm } from "../../libs/decorators/Llm";
import type { LlmService } from "../../libs/LlmService";
import {
  InvalidLlmPromptProblem,
  LlmServiceNotInitializedProblem,
} from "../../libs/problems/LlmProblems";
import type { LlmMetadata } from "../../libs/types";
import type { LlmInvocationOptions } from "../../index";

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
    clearLlmService();

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

    it("should preserve the not-initialized Problem without a scoped or default service", async () => {
      clearLlmService();

      await expect(testService.generateText("Test")).rejects.toBeInstanceOf(
        LlmServiceNotInitializedProblem,
      );
    });
  });

  describe("runWithLlmService", () => {
    function createScopedService(name: string): LlmService {
      return {
        generate: vi.fn().mockImplementation(async (params) => ({
          text: `${name}: ${params.prompt}`,
          usage: {
            promptTokens: 1,
            completionTokens: 1,
            totalTokens: 2,
          },
          metadata: { modelId: params.modelId ?? "default" },
        })),
      } as unknown as LlmService;
    }

    it("should prefer the scoped service over the process default", async () => {
      const scopedService = createScopedService("scoped");

      const result = await runWithLlmService(scopedService, () => testService.generateText("Test"));

      expect(result).toBe("scoped: Test");
      expect(scopedService.generate).toHaveBeenCalledTimes(1);
      expect(mockLlmService.generate).not.toHaveBeenCalled();
      expect(getLlmService()).toBe(mockLlmService);
    });

    it("should isolate simultaneous execution scopes across async boundaries", async () => {
      const firstService = createScopedService("first");
      const secondService = createScopedService("second");
      let releaseScopes!: () => void;
      const scopesReady = new Promise<void>((resolve) => {
        releaseScopes = resolve;
      });

      const firstResult = runWithLlmService(firstService, async () => {
        await scopesReady;
        return testService.generateText("one");
      });
      const secondResult = runWithLlmService(secondService, async () => {
        await scopesReady;
        return testService.generateText("two");
      });

      releaseScopes();

      await expect(Promise.all([firstResult, secondResult])).resolves.toEqual([
        "first: one",
        "second: two",
      ]);
      expect(firstService.generate).toHaveBeenCalledTimes(1);
      expect(secondService.generate).toHaveBeenCalledTimes(1);
      expect(mockLlmService.generate).not.toHaveBeenCalled();
    });

    it("should restore the outer service after a nested scope ends", async () => {
      const outerService = createScopedService("outer");
      const innerService = createScopedService("inner");

      const results = await runWithLlmService(outerService, async () => {
        const beforeInner = await testService.generateText("before");
        const inner = await runWithLlmService(innerService, () =>
          testService.generateText("inside"),
        );
        await Promise.resolve();
        const afterInner = await testService.generateText("after");
        return [beforeInner, inner, afterInner];
      });

      expect(results).toEqual(["outer: before", "inner: inside", "outer: after"]);
      expect(outerService.generate).toHaveBeenCalledTimes(2);
      expect(innerService.generate).toHaveBeenCalledTimes(1);
      expect(getLlmService()).toBe(mockLlmService);
    });
  });
});
