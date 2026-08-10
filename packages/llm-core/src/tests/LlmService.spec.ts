import type { EventBus } from "@croco/events-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LlmStreamCompletedEvent } from "../libs/events/LlmStreamCompletedEvent";
import { InMemoryLlmModel } from "../libs/InMemoryLlmModel";
import { InMemoryLlmRegistry } from "../libs/InMemoryLlmRegistry";
import type {
  LlmCompletionEventIntent,
  LlmCompletionEventIntentStore,
} from "../libs/LlmCompletionEvents";
import { LlmService } from "../libs/LlmService";
import { LlmOperationAbortedProblem } from "../libs/problems/LlmProblems";
import {
  LlmCompletionEventPublicationProblem,
  LlmServiceProblem,
} from "../libs/problems/LlmServiceProblem";
import type { GenerateParams, GenerateResult, StreamChunk, StreamParams } from "../libs/types";

class FailingStreamModel extends InMemoryLlmModel {
  constructor() {
    super("failing-stream-model");
  }

  override async *stream(_params: StreamParams): AsyncIterable<StreamChunk> {
    yield { delta: "partial " };
    throw new Error("provider stream failed");
  }
}

class CountingStreamModel extends InMemoryLlmModel {
  produced = 0;
  observedAbort = false;

  constructor() {
    super("counting-stream-model");
  }

  override async *stream(params: StreamParams): AsyncIterable<StreamChunk> {
    try {
      while (!params.signal?.aborted) {
        this.produced += 1;
        yield { delta: `${this.produced} ` };
      }
    } finally {
      this.observedAbort = params.signal?.aborted ?? false;
    }
  }
}

class DeltaStreamModel extends InMemoryLlmModel {
  streamCalls = 0;

  constructor(
    modelId: string,
    private readonly deltas: string[],
  ) {
    super(modelId);
  }

  override async *stream(params: StreamParams): AsyncIterable<StreamChunk> {
    this.streamCalls += 1;
    for (const delta of this.deltas) {
      if (params.signal?.aborted) {
        return;
      }

      yield { delta };
    }
  }
}

class CountingGenerateModel extends InMemoryLlmModel {
  generateCalls = 0;

  override async generate(params: GenerateParams): Promise<GenerateResult> {
    this.generateCalls += 1;
    return super.generate(params);
  }
}

class IgnoringAbortGenerateModel extends InMemoryLlmModel {
  observedSignal?: AbortSignal;
  complete?: () => void;

  constructor() {
    super("ignoring-abort-generate-model");
  }

  override async generate(params: GenerateParams): Promise<GenerateResult> {
    this.observedSignal = params.signal;

    return await new Promise<GenerateResult>((resolve) => {
      this.complete = () =>
        resolve({
          text: "completed after cancellation",
          usage: {
            promptTokens: 1,
            completionTokens: 1,
            totalTokens: 2,
          },
        });
    });
  }
}

async function collectStream(chunks: AsyncIterable<StreamChunk>): Promise<string[]> {
  const deltas: string[] = [];

  for await (const chunk of chunks) {
    deltas.push(chunk.delta);
  }

  return deltas;
}

describe("LlmService", () => {
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
      "test-model",
      () =>
        new InMemoryLlmModel("test-model", {
          Hello: "Hi there!",
          "How are you?": "I am doing well!",
        }),
    );

    registry.registerProvider(
      "stream-model",
      () =>
        new InMemoryLlmModel("stream-model", {
          "Stream test": "This is a streaming response",
        }),
    );

    registry.registerProvider("embed-model", () => new InMemoryLlmModel("embed-model"));
  });

  describe("generate", () => {
    it("should generate text successfully", async () => {
      const result = await service.generate({
        prompt: "Hello",
        modelId: "test-model",
      });

      expect(result.text).toBe("Hi there!");
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it("should use default model when modelId is not provided", async () => {
      registry.registerProvider(
        "default",
        () =>
          new InMemoryLlmModel("default", {
            "Default test": "Default response",
          }),
      );

      const result = await service.generate({ prompt: "Default test" });

      expect(result.text).toBe("Default response");
    });

    it("should emit LlmGeneratedEvent after generation", async () => {
      await service.generate({
        prompt: "Hello",
        modelId: "test-model",
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: "llm.generated",
          type: "llm.generated",
          modelId: "test-model",
          prompt: "Hello",
          result: "Hi there!",
        }),
      );
    });

    it("should include usage in event payload", async () => {
      await service.generate({
        prompt: "Hello",
        modelId: "test-model",
      });

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          usage: expect.objectContaining({
            promptTokens: expect.any(Number),
            completionTokens: expect.any(Number),
            totalTokens: expect.any(Number),
          }),
        }),
      );
    });

    it("should throw LlmServiceProblem when model is not found", async () => {
      await expect(
        service.generate({
          prompt: "Test",
          modelId: "non-existent",
        }),
      ).rejects.toThrow();
    });

    it("should invalidate cached models when a provider is re-registered", async () => {
      const first = await service.generate({
        prompt: "Hello",
        modelId: "test-model",
      });

      expect(first.text).toBe("Hi there!");

      registry.registerProvider(
        "test-model",
        () =>
          new InMemoryLlmModel("test-model", {
            Hello: "Updated response",
          }),
      );

      const second = await service.generate({
        prompt: "Hello",
        modelId: "test-model",
      });

      expect(second.text).toBe("Updated response");
    });

    it("should reject an active abort without publishing a completion event", async () => {
      const model = new IgnoringAbortGenerateModel();
      const controller = new AbortController();
      registry.registerProvider(model.modelId, () => model);

      const generation = service.generate({
        modelId: model.modelId,
        prompt: "cancel me",
        signal: controller.signal,
      });

      await vi.waitFor(() => expect(model.observedSignal).toBe(controller.signal));
      controller.abort();
      model.complete?.();

      await expect(generation).rejects.toBeInstanceOf(LlmOperationAbortedProblem);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it("should not let abort reclassify completed generation during publication", async () => {
      const controller = new AbortController();
      let releasePublish: (() => void) | undefined;
      vi.mocked(eventBus.publish).mockImplementationOnce(
        async () =>
          await new Promise<void>((resolve) => {
            releasePublish = resolve;
          }),
      );

      const generation = service.generate({
        modelId: "test-model",
        prompt: "Hello",
        signal: controller.signal,
      });

      await vi.waitFor(() => expect(eventBus.publish).toHaveBeenCalledOnce());
      controller.abort();
      releasePublish?.();

      await expect(generation).resolves.toMatchObject({ text: "Hi there!" });
    });

    it("should preserve completed output and retry event delivery without invoking the model again", async () => {
      const model = new CountingGenerateModel("counting-generate-model", {
        Billable: "completed output",
      });
      registry.registerProvider(model.modelId, () => model);
      vi.mocked(eventBus.publish)
        .mockRejectedValueOnce(new Error("event bus unavailable"))
        .mockResolvedValueOnce();

      const generation = service.generate({
        modelId: model.modelId,
        prompt: "Billable",
      });

      const problem = await generation.catch((error: unknown) => error);
      expect(problem).toBeInstanceOf(LlmCompletionEventPublicationProblem);
      if (!(problem instanceof LlmCompletionEventPublicationProblem)) {
        throw new Error("Expected completion publication Problem");
      }

      expect(problem.completion).toMatchObject({
        operation: "generate",
        result: {
          text: "completed output",
          usage: expect.objectContaining({ totalTokens: expect.any(Number) }),
        },
      });
      expect(problem.extensions).toMatchObject({
        eventDeliveryRetryable: true,
        modelExecutionCompleted: true,
        retryable: false,
      });

      const firstEventId = problem.intent.eventId;
      const firstPublishedEvent = vi.mocked(eventBus.publish).mock.calls[0]?.[0];
      await service.retryCompletionEvent(problem);

      expect(model.generateCalls).toBe(1);
      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      expect(vi.mocked(eventBus.publish).mock.calls[1]?.[0]).toMatchObject({
        eventId: firstEventId,
        eventName: "llm.generated",
        result: "completed output",
        timestamp: firstPublishedEvent?.timestamp,
      });
    });

    it("should persist a durable completion intent before publishing and confirm it after recovery", async () => {
      const intentStore: LlmCompletionEventIntentStore = {
        recordPending: vi.fn().mockResolvedValue(undefined),
        markPublished: vi.fn().mockResolvedValue(undefined),
      };
      const durableService = new LlmService(registry, eventBus, {
        completionEventIntentStore: intentStore,
      });
      vi.mocked(eventBus.publish)
        .mockRejectedValueOnce(new Error("event bus unavailable"))
        .mockResolvedValueOnce();

      const problem = await durableService
        .generate({ modelId: "test-model", prompt: "Hello" })
        .catch((error: unknown) => error);
      expect(problem).toBeInstanceOf(LlmCompletionEventPublicationProblem);
      if (!(problem instanceof LlmCompletionEventPublicationProblem)) {
        throw new Error("Expected completion publication Problem");
      }

      expect(problem.durableIntentRecorded).toBe(true);
      expect(intentStore.recordPending).toHaveBeenCalledBefore(vi.mocked(eventBus.publish));
      expect(intentStore.markPublished).not.toHaveBeenCalled();

      const restoredIntent = JSON.parse(JSON.stringify(problem.intent)) as LlmCompletionEventIntent;
      await durableService.retryCompletionEvent(restoredIntent);

      expect(intentStore.recordPending).toHaveBeenCalledTimes(2);
      expect(intentStore.recordPending).toHaveBeenNthCalledWith(2, restoredIntent);
      expect(intentStore.markPublished).toHaveBeenCalledWith(problem.intent.id);
    });

    it("should expose an unconfirmed state when publication succeeds but durable confirmation fails", async () => {
      const model = new CountingGenerateModel("unconfirmed-generate-model", {
        Billable: "completed output",
      });
      registry.registerProvider(model.modelId, () => model);
      const intentStore: LlmCompletionEventIntentStore = {
        recordPending: vi.fn().mockResolvedValue(undefined),
        markPublished: vi
          .fn()
          .mockRejectedValueOnce(new Error("intent confirmation failed"))
          .mockResolvedValueOnce(undefined),
      };
      const durableService = new LlmService(registry, eventBus, {
        completionEventIntentStore: intentStore,
      });

      const problem = await durableService
        .generate({ modelId: model.modelId, prompt: "Billable" })
        .catch((error: unknown) => error);
      expect(problem).toBeInstanceOf(LlmCompletionEventPublicationProblem);
      if (!(problem instanceof LlmCompletionEventPublicationProblem)) {
        throw new Error("Expected completion publication Problem");
      }

      expect(problem.deliveryState).toBe("published_unconfirmed");
      expect(problem.durableIntentRecorded).toBe(true);

      await durableService.retryCompletionEvent(problem);

      expect(model.generateCalls).toBe(1);
      expect(intentStore.markPublished).toHaveBeenCalledTimes(2);
      expect(eventBus.publish).toHaveBeenCalledOnce();
    });

    it("should retain provider failure classification without creating a completion intent", async () => {
      const model = new CountingGenerateModel("provider-failure-model");
      vi.spyOn(model, "generate").mockRejectedValueOnce(new Error("provider failed"));
      registry.registerProvider(model.modelId, () => model);

      await expect(
        service.generate({ modelId: model.modelId, prompt: "Fail" }),
      ).rejects.toBeInstanceOf(LlmServiceProblem);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });
  });

  it.each([
    ["generate", (signal: AbortSignal) => service.generate({ prompt: "x", signal })],
    ["stream", (signal: AbortSignal) => collectStream(service.stream({ prompt: "x", signal }))],
    [
      "generateObject",
      (signal: AbortSignal) => service.generateObject({ prompt: "x", schema: {}, signal }),
    ],
    ["callTool", (signal: AbortSignal) => service.callTool({ prompt: "x", tools: [], signal })],
    ["embed", (signal: AbortSignal) => service.embed({ text: "x", signal })],
    ["embedMany", (signal: AbortSignal) => service.embedMany({ texts: ["x"], signal })],
  ])("should normalize pre-aborted %s operations", async (_operation, invoke) => {
    const controller = new AbortController();
    controller.abort();

    await expect(invoke(controller.signal)).rejects.toBeInstanceOf(LlmOperationAbortedProblem);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  describe("stream", () => {
    it("should stream text chunks", async () => {
      const chunks: string[] = [];

      for await (const chunk of service.stream({
        prompt: "Stream test",
        modelId: "stream-model",
      })) {
        chunks.push(chunk.delta);
      }

      const fullText = chunks.join("");
      expect(fullText).toContain("streaming");
    });

    it("should provide usage information in chunks", async () => {
      const chunks = service.stream({
        prompt: "Stream test",
        modelId: "stream-model",
      });

      for await (const chunk of chunks) {
        if (chunk.usage) {
          expect(chunk.usage.totalTokens).toBeGreaterThan(0);
        }
      }
    });

    it("should handle empty response", async () => {
      registry.registerProvider(
        "empty-model",
        () => new InMemoryLlmModel("empty-model", { Empty: "" }),
      );

      const chunks: string[] = [];
      for await (const chunk of service.stream({
        prompt: "Empty",
        modelId: "empty-model",
      })) {
        chunks.push(chunk.delta);
      }

      expect(chunks.length).toBe(0);
    });

    it("BUG-06 stream 완료 시 LlmStreamCompletedEvent 발행", async () => {
      for await (const _chunk of service.stream({
        prompt: "Stream test",
        modelId: "stream-model",
      })) {
      }

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: "llm.stream_completed",
          type: "llm.stream_completed",
          modelId: "stream-model",
          usage: expect.objectContaining({
            promptTokens: expect.any(Number),
            completionTokens: expect.any(Number),
            totalTokens: expect.any(Number),
          }),
        }),
      );
    });

    it("should propagate stream model lookup errors to the consumer", async () => {
      await expect(
        collectStream(
          service.stream({
            prompt: "Stream test",
            modelId: "missing-stream-model",
          }),
        ),
      ).rejects.toThrow();
    });

    it("should propagate provider stream errors to the consumer", async () => {
      registry.registerProvider("failing-stream-model", () => new FailingStreamModel());

      await expect(
        collectStream(
          service.stream({
            prompt: "Stream test",
            modelId: "failing-stream-model",
          }),
        ),
      ).rejects.toThrow(/provider stream failed/);
    });

    it("should preserve delivered chunks and retry completion publication without replaying the stream", async () => {
      const model = new DeltaStreamModel("recoverable-stream-model", ["paid ", "output"]);
      registry.registerProvider(model.modelId, () => model);
      vi.mocked(eventBus.publish)
        .mockRejectedValueOnce(new Error("publish failed"))
        .mockResolvedValueOnce();
      const delivered: string[] = [];
      let problem: unknown;

      try {
        for await (const chunk of service.stream({
          prompt: "Stream test",
          modelId: model.modelId,
        })) {
          delivered.push(chunk.delta);
        }
      } catch (error) {
        problem = error;
      }

      expect(delivered).toEqual(["paid ", "output"]);
      expect(problem).toBeInstanceOf(LlmCompletionEventPublicationProblem);
      if (!(problem instanceof LlmCompletionEventPublicationProblem)) {
        throw new Error("Expected completion publication Problem");
      }

      expect(problem.completion).toMatchObject({
        operation: "stream",
        text: "paid output",
        chunkCount: 2,
        chunksDelivered: true,
      });
      expect(problem.extensions).toMatchObject({
        chunksDelivered: true,
        modelExecutionCompleted: true,
        retryable: false,
      });
      expect(problem.intent).not.toHaveProperty("prompt");

      const firstPublishedEvent = vi.mocked(eventBus.publish).mock.calls[0]?.[0];
      await service.retryCompletionEvent(problem);

      expect(model.streamCalls).toBe(1);
      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      expect(vi.mocked(eventBus.publish).mock.calls[1]?.[0]).toMatchObject({
        eventId: problem.intent.eventId,
        eventName: "llm.stream_completed",
        text: "paid output",
        timestamp: firstPublishedEvent?.timestamp,
      });
    });

    it("should stop producing when the consumer breaks from the stream", async () => {
      const model = new CountingStreamModel();
      registry.registerProvider("counting-stream-model", () => model);

      for await (const _chunk of service.stream({
        prompt: "Count",
        modelId: "counting-stream-model",
      })) {
        break;
      }

      expect(model.observedAbort).toBe(true);
      expect(eventBus.publish).not.toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: "llm.stream_completed",
          modelId: "counting-stream-model",
        }),
      );
    });

    it("should not publish completion when the consumer breaks after the producer finishes", async () => {
      registry.registerProvider(
        "fast-finite-stream-model",
        () => new DeltaStreamModel("fast-finite-stream-model", ["0", "1", "2", "3", "4"]),
      );

      for await (const chunk of service.stream({
        prompt: "Fast",
        modelId: "fast-finite-stream-model",
      })) {
        expect(chunk.delta).toBe("0");
        await new Promise((resolve) => setTimeout(resolve, 0));
        break;
      }

      expect(eventBus.publish).not.toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: "llm.stream_completed",
          modelId: "fast-finite-stream-model",
        }),
      );
    });

    it("should pause the producer when the stream buffer is full", async () => {
      const model = new CountingStreamModel();
      registry.registerProvider("buffered-stream-model", () => model);

      const iterator = service
        .stream({
          prompt: "Count",
          modelId: "buffered-stream-model",
        })
        [Symbol.asyncIterator]();

      await expect(iterator.next()).resolves.toMatchObject({ done: false });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(model.produced).toBe(1001);

      await iterator.return?.();
    });

    it("should bound retained completion event text for long streams", async () => {
      const chunkCount = 1001;
      const delta = "x".repeat(101);
      const totalCompletionLength = chunkCount * delta.length;
      const model = new DeltaStreamModel(
        "long-stream-model",
        Array.from({ length: chunkCount }, () => delta),
      );
      registry.registerProvider("long-stream-model", () => model);

      const chunks = await collectStream(
        service.stream({
          prompt: "Long",
          modelId: "long-stream-model",
        }),
      );

      const publishedEvent = vi
        .mocked(eventBus.publish)
        .mock.calls.find(([event]) => event instanceof LlmStreamCompletedEvent)?.[0];

      if (!(publishedEvent instanceof LlmStreamCompletedEvent)) {
        throw new Error("Expected LlmStreamCompletedEvent to be published");
      }

      expect(chunks.join("")).toHaveLength(totalCompletionLength);
      expect(publishedEvent.chunkCount).toBe(chunkCount);
      expect(publishedEvent.textTruncated).toBe(true);
      expect(publishedEvent.text.length).toBeLessThan(totalCompletionLength);
      expect(publishedEvent.usage).toEqual({
        promptTokens: "Long".length,
        completionTokens: totalCompletionLength,
        totalTokens: "Long".length + totalCompletionLength,
        accuracy: undefined,
      });
    });

    it("should not mark exact-limit stream event text as truncated for empty final chunks", async () => {
      const exactLimitDelta = "x".repeat(100_000);
      const model = new DeltaStreamModel("exact-limit-stream-model", [exactLimitDelta, ""]);
      registry.registerProvider("exact-limit-stream-model", () => model);

      await collectStream(
        service.stream({
          prompt: "Exact",
          modelId: "exact-limit-stream-model",
        }),
      );

      const publishedEvent = vi
        .mocked(eventBus.publish)
        .mock.calls.find(([event]) => event instanceof LlmStreamCompletedEvent)?.[0];

      if (!(publishedEvent instanceof LlmStreamCompletedEvent)) {
        throw new Error("Expected LlmStreamCompletedEvent to be published");
      }

      expect(publishedEvent.text).toHaveLength(exactLimitDelta.length);
      expect(publishedEvent.textTruncated).toBe(false);
    });

    it("should stop streaming when the abort signal is aborted", async () => {
      const model = new CountingStreamModel();
      const abortController = new AbortController();
      registry.registerProvider("abortable-stream-model", () => model);

      const consume = async (): Promise<void> => {
        for await (const _chunk of service.stream({
          prompt: "Count",
          modelId: "abortable-stream-model",
          signal: abortController.signal,
        })) {
          abortController.abort();
        }
      };

      await expect(consume()).rejects.toBeInstanceOf(LlmOperationAbortedProblem);
      expect(model.observedAbort).toBe(true);
      expect(eventBus.publish).not.toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: "llm.stream_completed",
          modelId: "abortable-stream-model",
        }),
      );
    });

    it("should not let abort reclassify a completed stream during publication", async () => {
      const controller = new AbortController();
      let releasePublish: (() => void) | undefined;
      vi.mocked(eventBus.publish).mockImplementationOnce(
        async () =>
          await new Promise<void>((resolve) => {
            releasePublish = resolve;
          }),
      );

      const consumption = collectStream(
        service.stream({
          prompt: "Stream test",
          modelId: "stream-model",
          signal: controller.signal,
        }),
      );

      await vi.waitFor(() => expect(eventBus.publish).toHaveBeenCalledOnce());
      controller.abort();
      releasePublish?.();

      await expect(consumption).resolves.toEqual(expect.arrayContaining([expect.any(String)]));
    });
  });

  describe("embed", () => {
    it("should generate embedding for single text", async () => {
      const result = await service.embed({
        text: "Hello world",
        modelId: "embed-model",
      });

      expect(result.embedding).toBeInstanceOf(Array);
      expect(result.embedding.length).toBeGreaterThan(0);
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it("should use default model when modelId is not provided", async () => {
      registry.registerProvider("default", () => new InMemoryLlmModel("default"));

      const result = await service.embed({ text: "Test" });

      expect(result.embedding).toBeInstanceOf(Array);
    });
  });

  describe("embedMany", () => {
    it("should generate embeddings for multiple texts", async () => {
      const result = await service.embedMany({
        texts: ["Hello", "World"],
        modelId: "embed-model",
      });

      expect(result.embeddings).toBeInstanceOf(Array);
      expect(result.embeddings.length).toBe(2);
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it("should handle empty array", async () => {
      const result = await service.embedMany({
        texts: [],
        modelId: "embed-model",
      });

      expect(result.embeddings).toEqual([]);
    });
  });

  describe("generateObject", () => {
    beforeEach(() => {
      registry.registerProvider(
        "object-model",
        () =>
          new InMemoryLlmModel("object-model", {
            "Parse user": '{"name":"John","age":30}',
            "Invalid JSON": "not a json",
          }),
      );
    });

    it("should parse JSON response", async () => {
      const result = await service.generateObject({
        prompt: "Parse user",
        modelId: "object-model",
        schema: {},
      });

      expect(result).toEqual({ name: "John", age: 30 });
    });

    it("should use default model when modelId is not provided", async () => {
      registry.registerProvider(
        "default",
        () => new InMemoryLlmModel("default", { "Default object": '{"key":"value"}' }),
      );

      const result = await service.generateObject({
        prompt: "Default object",
        schema: {},
      });

      expect(result).toEqual({ key: "value" });
    });

    it("should throw error when JSON is invalid", async () => {
      await expect(
        service.generateObject({
          prompt: "Invalid JSON",
          modelId: "object-model",
          schema: {},
        }),
      ).rejects.toThrow();
    });

    it("should throw LlmServiceProblem when model is not found", async () => {
      await expect(
        service.generateObject({
          prompt: "Test",
          modelId: "non-existent",
          schema: {},
        }),
      ).rejects.toThrow();
    });
  });

  describe("callTool", () => {
    beforeEach(() => {
      registry.registerProvider(
        "tool-model",
        () =>
          new InMemoryLlmModel("tool-model", {
            "Call weather": 'getWeather:{"city":"Seoul"}',
            "Multiple tools": 'search:{"query":"test"}|calculate:{"a":1,"b":2}',
            "No tools": "No tools needed",
          }),
      );
    });

    it("should execute single tool", async () => {
      const result = await service.callTool({
        prompt: "Call weather",
        modelId: "tool-model",
        tools: [
          {
            name: "getWeather",
            description: "Get weather",
            parameters: { type: "object", properties: { city: { type: "string" } } },
          },
        ],
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]?.name).toBe("getWeather");
      expect(result.toolCalls[0]?.arguments).toEqual({ city: "Seoul" });
      expect(result.usage.totalTokens).toBeGreaterThan(0);
    });

    it("should execute multiple tools", async () => {
      const result = await service.callTool({
        prompt: "Multiple tools",
        modelId: "tool-model",
        tools: [
          { name: "search", description: "Search", parameters: { type: "object" } },
          { name: "calculate", description: "Calculate", parameters: { type: "object" } },
        ],
      });

      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0]?.name).toBe("search");
      expect(result.toolCalls[1]?.name).toBe("calculate");
    });

    it("should handle no tools called", async () => {
      const result = await service.callTool({
        prompt: "No tools",
        modelId: "tool-model",
        tools: [{ name: "test", description: "Test", parameters: { type: "object" } }],
      });

      expect(result.toolCalls).toEqual([]);
    });

    it("should use default model when modelId is not provided", async () => {
      registry.registerProvider(
        "default",
        () =>
          new InMemoryLlmModel("default", { "Default tool": 'defaultAction:{"param":"value"}' }),
      );

      const result = await service.callTool({
        prompt: "Default tool",
        tools: [{ name: "defaultAction", description: "Action", parameters: { type: "object" } }],
      });

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0]?.name).toBe("defaultAction");
    });

    it("should throw LlmServiceProblem when model is not found", async () => {
      await expect(
        service.callTool({
          prompt: "Test",
          modelId: "non-existent",
          tools: [],
        }),
      ).rejects.toThrow();
    });
  });
});
