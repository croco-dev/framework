import * as assert from "node:assert/strict";
import { Problem } from "@croco/problems-core";
import type {
  EmbedManyParams,
  EmbedParams,
  GenerateObjectParams,
  GenerateParams,
  LlmModel,
  LlmUsage,
  StreamChunk,
  ToolCallParams,
  ToolCallResult,
  ToolDefinition,
} from "@croco/llm-core";

export type LlmProviderConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type LlmProviderConformancePromptSet<TObject = unknown> = {
  readonly generate: {
    readonly prompt: string;
    readonly expectedText?: string | RegExp;
  };
  readonly stream: {
    readonly prompt: string;
    readonly minimumChunks?: number;
  };
  readonly object: {
    readonly prompt: string;
    readonly schema: GenerateObjectParams<TObject>["schema"];
    readonly assertObject?: (value: TObject) => void;
  };
  readonly tool: {
    readonly prompt: string;
    readonly tools: readonly ToolDefinition[];
    readonly assertToolResult?: (result: ToolCallResult) => void;
  };
  readonly embed: {
    readonly text: string;
    readonly expectedDimensions?: number;
  };
  readonly embedMany: {
    readonly texts: readonly string[];
    readonly expectedDimensions?: number;
  };
};

export type LlmProviderConformanceOptions<TObject = unknown> = {
  readonly createModel: () => LlmModel | Promise<LlmModel>;
  readonly createFailingModel?: () => LlmModel | Promise<LlmModel>;
  readonly modelId: string;
  readonly providerName: string;
  readonly prompts: LlmProviderConformancePromptSet<TObject>;
};

export type LlmProviderConformanceSuite = {
  readonly cases: readonly LlmProviderConformanceCase[];
};

export function createLlmProviderConformanceSuite<TObject = unknown>(
  options: LlmProviderConformanceOptions<TObject>,
): LlmProviderConformanceSuite {
  const createModel = async (): Promise<LlmModel> => await options.createModel();

  const cases: LlmProviderConformanceCase[] = [
    {
      name: "generates text with model identity and token usage",
      run: async () => {
        const model = await createModel();
        assert.equal(model.modelId, options.modelId);
        const result = await model.generate({
          modelId: options.modelId,
          prompt: options.prompts.generate.prompt,
        } satisfies GenerateParams);

        assert.equal(typeof result.text, "string");
        assert.ok(result.text.length > 0, `${options.providerName} returned an empty response.`);
        assertExpectedText(result.text, options.prompts.generate.expectedText);
        assertUsage(result.usage, "generate");
        assertOptionalModelId(result.metadata?.modelId, model.modelId);
      },
    },
    {
      name: "streams deltas and final usage without losing abort propagation",
      run: async () => {
        const model = await createModel();
        assert.equal(model.capabilities.streaming, true, `${options.providerName} must stream.`);

        const chunks = await collectStream(
          model.stream({
            modelId: options.modelId,
            prompt: options.prompts.stream.prompt,
          }),
        );
        const minimumChunks = options.prompts.stream.minimumChunks ?? 1;
        assert.ok(
          chunks.length >= minimumChunks,
          `${options.providerName} returned fewer stream chunks than expected.`,
        );
        assert.ok(
          chunks.every((chunk) => typeof chunk.delta === "string"),
          `${options.providerName} stream chunks must contain string deltas.`,
        );

        const finalUsage = [...chunks].reverse().find((chunk) => chunk.usage)?.usage;
        assert.ok(finalUsage, `${options.providerName} stream must include final usage.`);
        assertPartialUsage(finalUsage, "stream");

        const controller = new AbortController();
        const iterator = model
          .stream({
            modelId: options.modelId,
            prompt: options.prompts.stream.prompt,
            signal: controller.signal,
          })
          [Symbol.asyncIterator]();
        const first = await iterator.next();

        if (!first.done) {
          controller.abort();
          let next = await iterator.next();
          let bufferedChunks = 0;
          while (!next.done && bufferedChunks < 2) {
            assert.equal(
              typeof next.value.delta,
              "string",
              `${options.providerName} must emit only valid chunks while draining after abort.`,
            );
            bufferedChunks += 1;
            next = await iterator.next();
          }
          assert.ok(next.done, `${options.providerName} must stop streaming promptly after abort.`);
        }

        await iterator.return?.();
      },
    },
    {
      name: "generates structured objects through the provider contract",
      run: async () => {
        const model = await createModel();
        assert.equal(
          model.capabilities.objectGeneration,
          true,
          `${options.providerName} must support object generation.`,
        );

        const value = await model.generateObject<TObject>({
          modelId: options.modelId,
          prompt: options.prompts.object.prompt,
          schema: options.prompts.object.schema,
        });

        if (options.prompts.object.assertObject) {
          options.prompts.object.assertObject(value);
          return;
        }

        assert.equal(typeof value, "object", `${options.providerName} returned a non-object.`);
        assert.notEqual(value, null, `${options.providerName} returned null.`);
      },
    },
    {
      name: "returns deterministic tool calls with usage",
      run: async () => {
        const model = await createModel();
        assert.equal(
          model.capabilities.toolCalling,
          true,
          `${options.providerName} must support tool calling.`,
        );

        const result = await model.callTool({
          modelId: options.modelId,
          prompt: options.prompts.tool.prompt,
          tools: [...options.prompts.tool.tools],
        } satisfies ToolCallParams);

        assertUsage(result.usage, "tool");
        if (options.prompts.tool.assertToolResult) {
          options.prompts.tool.assertToolResult(result);
          return;
        }

        assert.ok(
          result.toolCalls.length > 0,
          `${options.providerName} must return at least one tool call.`,
        );
      },
    },
    {
      name: "embeds one input with stable dimensions and usage",
      run: async () => {
        const model = await createModel();
        assert.equal(model.capabilities.embedding, true, `${options.providerName} must embed.`);

        const result = await model.embed({
          modelId: options.modelId,
          text: options.prompts.embed.text,
        } satisfies EmbedParams);

        assertEmbeddingDimensions(
          result.embedding,
          options.prompts.embed.expectedDimensions,
          options.providerName,
        );
        assertUsage(result.usage, "embed");
      },
    },
    {
      name: "embeds many inputs with one vector per input and usage",
      run: async () => {
        const model = await createModel();
        assert.equal(model.capabilities.embedding, true, `${options.providerName} must embed.`);

        const result = await model.embedMany({
          modelId: options.modelId,
          texts: [...options.prompts.embedMany.texts],
        } satisfies EmbedManyParams);

        assert.equal(
          result.embeddings.length,
          options.prompts.embedMany.texts.length,
          `${options.providerName} must return one embedding per input.`,
        );
        for (const embedding of result.embeddings) {
          assertEmbeddingDimensions(
            embedding,
            options.prompts.embedMany.expectedDimensions,
            options.providerName,
          );
        }
        assertUsage(result.usage, "embedMany");
      },
    },
  ];

  if (options.createFailingModel) {
    cases.push({
      name: "surfaces provider errors instead of hiding them",
      run: async () => {
        const model = await options.createFailingModel?.();
        assert.ok(model, `${options.providerName} error model was not created.`);

        await assert.rejects(
          () =>
            model.generate({
              modelId: options.modelId,
              prompt: options.prompts.generate.prompt,
            }),
          Problem,
        );
      },
    });
  }

  return { cases };
}

async function collectStream(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return chunks;
}

function assertExpectedText(text: string, expected: string | RegExp | undefined): void {
  if (expected === undefined) {
    return;
  }

  if (typeof expected === "string") {
    assert.equal(text, expected);
    return;
  }

  assert.match(text, expected);
}

function assertOptionalModelId(actual: string | undefined, expected: string): void {
  if (actual === undefined) {
    return;
  }

  assert.equal(actual, expected);
}

function assertUsage(usage: LlmUsage, operation: string): void {
  assert.equal(typeof usage.promptTokens, "number", `${operation} promptTokens must be numeric.`);
  assert.equal(
    typeof usage.completionTokens,
    "number",
    `${operation} completionTokens must be numeric.`,
  );
  assert.equal(typeof usage.totalTokens, "number", `${operation} totalTokens must be numeric.`);
  assert.ok(usage.promptTokens >= 0, `${operation} promptTokens must not be negative.`);
  assert.ok(usage.completionTokens >= 0, `${operation} completionTokens must not be negative.`);
  assert.ok(usage.totalTokens >= 0, `${operation} totalTokens must not be negative.`);
  assert.equal(
    usage.totalTokens,
    usage.promptTokens + usage.completionTokens,
    `${operation} totalTokens must equal promptTokens + completionTokens.`,
  );
}

function assertPartialUsage(usage: Partial<LlmUsage>, operation: string): void {
  const hasAnyTokenField =
    usage.promptTokens !== undefined ||
    usage.completionTokens !== undefined ||
    usage.totalTokens !== undefined;
  assert.ok(hasAnyTokenField, `${operation} usage must include at least one token field.`);

  if (usage.promptTokens !== undefined) {
    assert.ok(usage.promptTokens >= 0, `${operation} promptTokens must not be negative.`);
  }
  if (usage.completionTokens !== undefined) {
    assert.ok(usage.completionTokens >= 0, `${operation} completionTokens must not be negative.`);
  }
  if (usage.totalTokens !== undefined) {
    assert.ok(usage.totalTokens >= 0, `${operation} totalTokens must not be negative.`);
  }
  if (
    usage.promptTokens !== undefined &&
    usage.completionTokens !== undefined &&
    usage.totalTokens !== undefined
  ) {
    assert.equal(
      usage.totalTokens,
      usage.promptTokens + usage.completionTokens,
      `${operation} totalTokens must equal promptTokens + completionTokens when all fields are present.`,
    );
  }
}

function assertEmbeddingDimensions(
  embedding: readonly number[],
  expectedDimensions: number | undefined,
  providerName: string,
): void {
  assert.ok(embedding.length > 0, `${providerName} returned an empty embedding.`);
  assert.ok(
    embedding.every((value) => Number.isFinite(value)),
    `${providerName} embedding values must be finite numbers.`,
  );

  if (expectedDimensions !== undefined) {
    assert.equal(embedding.length, expectedDimensions);
  }
}
