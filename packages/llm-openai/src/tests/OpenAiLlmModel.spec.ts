import { describe, expect, it } from "vitest";
import { withSpan } from "@croco/telemetry-api";
import { OpenAiLlmModel } from "../libs/OpenAiLlmModel";
import {
  OpenAiAbortProblem,
  OpenAiInvalidResponseProblem,
  OpenAiMissingConfigProblem,
} from "../libs/problems/OpenAiProblems";
import type {
  OpenAiEmbeddingRequest,
  OpenAiEmbeddingResponse,
  OpenAiOutputItem,
  OpenAiRequestOptions,
  OpenAiResponse,
  OpenAiResponseRequest,
  OpenAiStreamEvent,
  OpenAiTransport,
} from "../libs/types";
import { createLlmProviderConformanceSuite } from "../../../testing/src/libs/llm-provider-conformance";
import { installTestingTelemetryCapture } from "../../../testing/src/libs/telemetry-testing";

const MODEL_ID = "gpt-croco-test";
const EMBEDDING_MODEL_ID = "text-embedding-croco-test";

class MockOpenAiTransport implements OpenAiTransport {
  readonly responseRequests: OpenAiResponseRequest[] = [];
  readonly embeddingRequests: OpenAiEmbeddingRequest[] = [];
  readonly requestSignals: Array<AbortSignal | undefined> = [];

  async createResponse(
    request: OpenAiResponseRequest,
    options?: OpenAiRequestOptions,
  ): Promise<OpenAiResponse> {
    this.responseRequests.push(request);
    this.requestSignals.push(options?.signal);

    if (request.text?.format.type === "json_schema") {
      return createTextResponse(JSON.stringify({ label: "conformant", count: 2 }), request.model);
    }

    if (request.tools && request.tools.length > 0) {
      return {
        ...createTextResponse("", request.model),
        output_text: undefined,
        output: [
          {
            type: "function_call",
            name: request.tools[0]?.name,
            arguments: JSON.stringify({ location: "Paris, France" }),
          },
        ],
      };
    }

    return createTextResponse("OpenAI mock response", request.model);
  }

  async streamResponse(
    request: OpenAiResponseRequest,
    options?: OpenAiRequestOptions,
  ): Promise<AsyncIterable<OpenAiStreamEvent>> {
    this.responseRequests.push({
      ...request,
      stream: true,
    });

    return createStream(options?.signal);
  }

  async createEmbedding(
    request: OpenAiEmbeddingRequest,
    options?: OpenAiRequestOptions,
  ): Promise<OpenAiEmbeddingResponse> {
    this.embeddingRequests.push(request);
    this.requestSignals.push(options?.signal);
    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    return {
      data: inputs.map((input, index) => ({
        index,
        embedding: createEmbedding(input),
      })),
      model: request.model,
      usage: {
        prompt_tokens: inputs.reduce((sum, input) => sum + input.length, 0),
        total_tokens: inputs.reduce((sum, input) => sum + input.length, 0),
      },
    };
  }
}

class AbortableOpenAiTransport extends MockOpenAiTransport {
  override async createResponse(
    request: OpenAiResponseRequest,
    options?: OpenAiRequestOptions,
  ): Promise<OpenAiResponse> {
    this.responseRequests.push(request);
    this.requestSignals.push(options?.signal);
    return await rejectOnAbort(options?.signal);
  }

  override async createEmbedding(
    request: OpenAiEmbeddingRequest,
    options?: OpenAiRequestOptions,
  ): Promise<OpenAiEmbeddingResponse> {
    this.embeddingRequests.push(request);
    this.requestSignals.push(options?.signal);
    return await rejectOnAbort(options?.signal);
  }
}

class FailingOpenAiTransport extends MockOpenAiTransport {
  override async createResponse(): Promise<OpenAiResponse> {
    throw {
      status: 500,
      code: "server_error",
      request_id: "req-failing",
    };
  }
}

class ToolOutputTransport extends MockOpenAiTransport {
  constructor(private readonly output: readonly OpenAiOutputItem[]) {
    super();
  }

  override async createResponse(request: OpenAiResponseRequest): Promise<OpenAiResponse> {
    return {
      ...createTextResponse("", request.model),
      output_text: undefined,
      output: this.output,
    };
  }
}

class MissingEmbeddingIndexTransport extends MockOpenAiTransport {
  override async createEmbedding(
    request: OpenAiEmbeddingRequest,
  ): Promise<OpenAiEmbeddingResponse> {
    this.embeddingRequests.push(request);

    return {
      data: [
        {
          embedding: createEmbedding("alpha"),
        },
        {
          index: 1,
          embedding: createEmbedding("beta"),
        },
      ],
      model: request.model,
      usage: {
        prompt_tokens: 2,
        total_tokens: 2,
      },
    };
  }
}

describe("OpenAiLlmModel", () => {
  describe("provider conformance", () => {
    it.each(
      createLlmProviderConformanceSuite<Record<string, unknown>>({
        createModel: () =>
          new OpenAiLlmModel({
            modelId: MODEL_ID,
            embeddingModelId: EMBEDDING_MODEL_ID,
            transport: new MockOpenAiTransport(),
          }),
        createFailingModel: () =>
          new OpenAiLlmModel({
            modelId: MODEL_ID,
            transport: new FailingOpenAiTransport(),
          }),
        modelId: MODEL_ID,
        providerName: "llm-openai",
        prompts: {
          generate: {
            prompt: "Generate deterministic text",
            expectedText: "OpenAI mock response",
          },
          stream: {
            prompt: "Stream deterministic text",
            minimumChunks: 2,
          },
          object: {
            prompt: "Return structured JSON",
            schema: {
              type: "object",
              properties: {
                label: { type: "string" },
                count: { type: "number" },
              },
              required: ["label", "count"],
              additionalProperties: false,
            },
            assertObject: (value) => {
              expect(value).toEqual({ label: "conformant", count: 2 });
            },
          },
          tool: {
            prompt: "Call a weather tool",
            tools: [
              {
                name: "get_weather",
                description: "Get weather by location",
                parameters: {
                  type: "object",
                  properties: {
                    location: { type: "string" },
                  },
                  required: ["location"],
                  additionalProperties: false,
                },
              },
            ],
            assertToolResult: (result) => {
              expect(result.toolCalls).toEqual([
                {
                  name: "get_weather",
                  arguments: { location: "Paris, France" },
                },
              ]);
            },
          },
          embed: {
            text: "single embedding",
            expectedDimensions: 4,
          },
          embedMany: {
            texts: ["first", "second"],
            expectedDimensions: 4,
          },
        },
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  it("maps generate params into a Responses API request", async () => {
    const transport = new MockOpenAiTransport();
    const model = new OpenAiLlmModel({ modelId: MODEL_ID, transport });

    await model.generate({
      prompt: "Hello",
      systemPrompt: "Be precise",
      temperature: 0.2,
      maxTokens: 64,
      stopSequences: ["END"],
    });

    expect(transport.responseRequests[0]).toEqual({
      model: MODEL_ID,
      input: [
        { role: "system", content: "Be precise" },
        { role: "user", content: "Hello" },
      ],
      temperature: 0.2,
      max_output_tokens: 64,
      stop: ["END"],
      store: false,
    });
  });

  it("requests strict JSON schema output through Responses text.format", async () => {
    const transport = new MockOpenAiTransport();
    const model = new OpenAiLlmModel({ modelId: MODEL_ID, transport });
    const schema = {
      type: "object",
      properties: {
        ok: { type: "boolean" },
      },
      required: ["ok"],
      additionalProperties: false,
    };

    await model.generateObject({
      prompt: "Return JSON",
      schema,
    });

    expect(transport.responseRequests[0]?.text).toEqual({
      format: {
        type: "json_schema",
        name: "croco_response",
        strict: true,
        schema,
      },
    });
  });

  it("maps Croco tools into strict OpenAI function tools", async () => {
    const transport = new MockOpenAiTransport();
    const model = new OpenAiLlmModel({ modelId: MODEL_ID, transport });

    await model.callTool({
      prompt: "Use tool",
      tools: [
        {
          name: "lookup",
          description: "Lookup a value",
          parameters: {
            type: "object",
            properties: {
              id: { type: "string" },
            },
            required: ["id"],
            additionalProperties: false,
          },
        },
      ],
    });

    expect(transport.responseRequests[0]?.tools).toEqual([
      {
        type: "function",
        name: "lookup",
        description: "Lookup a value",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
          additionalProperties: false,
        },
        strict: true,
      },
    ]);
    expect(transport.responseRequests[0]?.tool_choice).toBe("auto");
  });

  it("uses the configured embedding model for batch embeddings", async () => {
    const transport = new MockOpenAiTransport();
    const model = new OpenAiLlmModel({
      modelId: MODEL_ID,
      embeddingModelId: EMBEDDING_MODEL_ID,
      transport,
    });

    const result = await model.embedMany({ texts: ["alpha", "beta"] });

    expect(result.embeddings).toHaveLength(2);
    expect(transport.embeddingRequests[0]).toEqual({
      model: EMBEDDING_MODEL_ID,
      input: ["alpha", "beta"],
      encoding_format: "float",
    });
  });

  it("rejects batch embedding responses that omit expected indexes", async () => {
    const model = new OpenAiLlmModel({
      modelId: MODEL_ID,
      embeddingModelId: EMBEDDING_MODEL_ID,
      transport: new MissingEmbeddingIndexTransport(),
    });

    await expect(model.embedMany({ texts: ["alpha", "beta"] })).rejects.toThrow(
      OpenAiInvalidResponseProblem,
    );
  });

  it("uses per-call embedding model overrides for requests and telemetry", async () => {
    const capture = installTestingTelemetryCapture();
    const transport = new MockOpenAiTransport();
    const model = new OpenAiLlmModel({
      modelId: MODEL_ID,
      embeddingModelId: EMBEDDING_MODEL_ID,
      transport,
    });

    await capture.run(async () => {
      await model.embed({ text: "override embedding", modelId: "text-embedding-override" });
    });

    expect(transport.embeddingRequests[0]?.model).toBe("text-embedding-override");
    expect(capture.spans[0]).toMatchObject({
      name: "llm.openai.embed",
      attributes: {
        "gen_ai.request.model": "text-embedding-override",
      },
    });
    expect(capture.spans[0]?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "llm.openai.usage",
          attributes: expect.objectContaining({
            model: "text-embedding-override",
          }),
        }),
      ]),
    );
  });

  it("surfaces pre-aborted streams as Croco Problems", async () => {
    const controller = new AbortController();
    controller.abort();
    const model = new OpenAiLlmModel({
      modelId: MODEL_ID,
      transport: new MockOpenAiTransport(),
    });

    await expect(
      collectStream(
        model.stream({
          prompt: "Stream deterministic text",
          signal: controller.signal,
        }),
      ),
    ).rejects.toThrow(OpenAiAbortProblem);
  });

  it("surfaces mid-stream aborts as Croco Problems", async () => {
    const controller = new AbortController();
    const model = new OpenAiLlmModel({
      modelId: MODEL_ID,
      transport: new MockOpenAiTransport(),
    });
    const iterator = model
      .stream({
        prompt: "Stream deterministic text",
        signal: controller.signal,
      })
      [Symbol.asyncIterator]();

    const first = await iterator.next();
    expect(first.done).toBe(false);

    controller.abort();
    await expect(iterator.next()).rejects.toThrow(OpenAiAbortProblem);
    await iterator.return?.();
  });

  it("does not record stream usage when aborted after the final usage chunk", async () => {
    const capture = installTestingTelemetryCapture();
    const controller = new AbortController();
    const model = new OpenAiLlmModel({
      modelId: MODEL_ID,
      transport: new MockOpenAiTransport(),
    });

    await capture.run(
      async () =>
        await withSpan(
          async () => {
            const iterator = model
              .stream({
                prompt: "Stream deterministic text",
                signal: controller.signal,
              })
              [Symbol.asyncIterator]();

            await iterator.next();
            await iterator.next();
            const finalChunk = await iterator.next();
            expect(finalChunk.value?.usage).toBeDefined();

            controller.abort();
            await expect(iterator.next()).rejects.toThrow(OpenAiAbortProblem);
            await iterator.return?.();
          },
          { name: "test.openai.stream.abort" },
        ),
    );

    expect(capture.spans.flatMap((span) => span.events)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "llm.openai.usage" })]),
    );
  });

  it("records stream usage only after clean iterator completion", async () => {
    const capture = installTestingTelemetryCapture();
    const model = new OpenAiLlmModel({
      modelId: MODEL_ID,
      transport: new MockOpenAiTransport(),
    });

    await capture.run(
      async () =>
        await withSpan(
          async () => await collectStream(model.stream({ prompt: "Stream deterministic text" })),
          { name: "test.openai.stream.complete" },
        ),
    );

    expect(capture.spans.flatMap((span) => span.events)).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "llm.openai.usage" })]),
    );
  });

  it.each([
    [
      "generate",
      (model: OpenAiLlmModel, signal: AbortSignal) => model.generate({ prompt: "x", signal }),
    ],
    [
      "generateObject",
      (model: OpenAiLlmModel, signal: AbortSignal) =>
        model.generateObject({ prompt: "x", schema: {}, signal }),
    ],
    [
      "callTool",
      (model: OpenAiLlmModel, signal: AbortSignal) =>
        model.callTool({ prompt: "x", tools: [], signal }),
    ],
    ["embed", (model: OpenAiLlmModel, signal: AbortSignal) => model.embed({ text: "x", signal })],
    [
      "embedMany",
      (model: OpenAiLlmModel, signal: AbortSignal) => model.embedMany({ texts: ["x"], signal }),
    ],
  ])("forwards active aborts for %s without recording usage", async (_operation, invoke) => {
    const capture = installTestingTelemetryCapture();
    const transport = new AbortableOpenAiTransport();
    const controller = new AbortController();
    const model = new OpenAiLlmModel({ modelId: MODEL_ID, transport });

    const operation = capture.run(async () => await invoke(model, controller.signal));
    await Promise.resolve();
    controller.abort();

    await expect(operation).rejects.toBeInstanceOf(OpenAiAbortProblem);
    expect(transport.requestSignals).toContain(controller.signal);
    expect(capture.spans.flatMap((span) => span.events)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "llm.openai.usage" })]),
    );
  });

  it.each([
    [
      "generate",
      (model: OpenAiLlmModel, signal: AbortSignal) => model.generate({ prompt: "x", signal }),
    ],
    [
      "generateObject",
      (model: OpenAiLlmModel, signal: AbortSignal) =>
        model.generateObject({ prompt: "x", schema: {}, signal }),
    ],
    [
      "callTool",
      (model: OpenAiLlmModel, signal: AbortSignal) =>
        model.callTool({ prompt: "x", tools: [], signal }),
    ],
    ["embed", (model: OpenAiLlmModel, signal: AbortSignal) => model.embed({ text: "x", signal })],
    [
      "embedMany",
      (model: OpenAiLlmModel, signal: AbortSignal) => model.embedMany({ texts: ["x"], signal }),
    ],
  ])("rejects pre-aborted %s before starting transport work", async (_operation, invoke) => {
    const transport = new MockOpenAiTransport();
    const controller = new AbortController();
    const model = new OpenAiLlmModel({ modelId: MODEL_ID, transport });
    controller.abort();

    await expect(invoke(model, controller.signal)).rejects.toBeInstanceOf(OpenAiAbortProblem);
    expect(transport.responseRequests).toHaveLength(0);
    expect(transport.embeddingRequests).toHaveLength(0);
  });

  it("fails deterministically when SDK-backed configuration is missing", () => {
    expect(() => new OpenAiLlmModel({ modelId: MODEL_ID, env: {} })).toThrow(
      OpenAiMissingConfigProblem,
    );
  });

  it("rejects invalid provider payloads with Croco Problems", async () => {
    const transport: OpenAiTransport = {
      createResponse: async () => ({ output_text: "", usage: null }),
      streamResponse: async () => createStream(),
      createEmbedding: async () => ({ data: [], usage: null }),
    };
    const model = new OpenAiLlmModel({ modelId: MODEL_ID, transport });

    await expect(model.generate({ prompt: "bad payload" })).rejects.toThrow(
      OpenAiInvalidResponseProblem,
    );
  });

  it.each([
    ["generate", (model: OpenAiLlmModel) => model.generate({ prompt: "x" })],
    [
      "generateObject",
      (model: OpenAiLlmModel) => model.generateObject({ prompt: "x", schema: {} }),
    ],
    ["callTool", (model: OpenAiLlmModel) => model.callTool({ prompt: "x", tools: [] })],
  ])(
    "rejects incomplete buffered responses from %s with the upstream reason",
    async (_name, invoke) => {
      const response: OpenAiResponse = {
        output_text: "partial answer",
        output_parsed: { partial: true },
        output: [
          {
            type: "function_call",
            name: "lookup",
            arguments: "{}",
          },
        ],
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        usage: {
          input_tokens: 2,
          output_tokens: 1,
          total_tokens: 3,
        },
      };
      const model = new OpenAiLlmModel({
        modelId: MODEL_ID,
        transport: createStaticResponseTransport(response),
      });

      await expect(invoke(model)).rejects.toMatchObject({
        code: OpenAiInvalidResponseProblem.CODE,
        extensions: expect.objectContaining({
          operation: _name,
          reason: "max_output_tokens",
        }),
      });
    },
  );

  it("rejects an incomplete stream after preserving previously yielded deltas", async () => {
    const model = new OpenAiLlmModel({
      modelId: MODEL_ID,
      transport: createStaticResponseTransport(
        createTextResponse("unused", MODEL_ID),
        createIncompleteStream(),
      ),
    });
    const iterator = model.stream({ prompt: "x" })[Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({
      done: false,
      value: { delta: "partial" },
    });
    await expect(iterator.next()).rejects.toMatchObject({
      code: OpenAiInvalidResponseProblem.CODE,
      extensions: expect.objectContaining({
        operation: "stream",
        reason: "max_output_tokens",
      }),
    });
  });

  it.each([
    [
      "a missing function name",
      { type: "function_call", arguments: '{"id":"123"}' } as const,
      "function call at output index 0: missing or blank name",
    ],
    [
      "a blank function name",
      { type: "function_call", name: "   ", arguments: '{"id":"123"}' } as const,
      "function call at output index 0: missing or blank name",
    ],
    [
      "missing arguments",
      { type: "function_call", name: "lookup" } as const,
      "function call at output index 0: missing string arguments",
    ],
    [
      "invalid JSON arguments",
      { type: "function_call", name: "lookup", arguments: "{" } as const,
      "function call at output index 0: arguments were not valid JSON",
    ],
    [
      "non-object arguments",
      { type: "function_call", name: "lookup", arguments: "[]" } as const,
      "function call at output index 0: arguments were not an object",
    ],
  ])("rejects function calls with %s", async (_case, output, reason) => {
    const model = new OpenAiLlmModel({
      modelId: MODEL_ID,
      transport: new ToolOutputTransport([output]),
    });

    const result = model.callTool({
      prompt: "Use tool",
      tools: [
        {
          name: "lookup",
          description: "Lookup a value",
          parameters: {},
        },
      ],
    });

    await expect(result).rejects.toMatchObject({
      code: OpenAiInvalidResponseProblem.CODE,
      extensions: {
        operation: "callTool",
        provider: "openai",
        reason,
      },
    });
  });

  it("preserves valid function calls while ignoring non-tool output items", async () => {
    const model = new OpenAiLlmModel({
      modelId: MODEL_ID,
      transport: new ToolOutputTransport([
        {
          type: "message",
          content: [{ type: "output_text", text: "Calling lookup" }],
        },
        {
          type: "function_call",
          name: "lookup",
          arguments: '{"id":"123"}',
        },
      ]),
    });

    await expect(
      model.callTool({
        prompt: "Use tool",
        tools: [
          {
            name: "lookup",
            description: "Lookup a value",
            parameters: {},
          },
        ],
      }),
    ).resolves.toMatchObject({
      toolCalls: [
        {
          name: "lookup",
          arguments: { id: "123" },
        },
      ],
    });
  });
});

async function collectStream(stream: AsyncIterable<unknown>): Promise<unknown[]> {
  const chunks: unknown[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return chunks;
}

function createTextResponse(text: string, model: string): OpenAiResponse {
  return {
    output_text: text,
    model,
    status: "completed",
    usage: {
      input_tokens: 12,
      output_tokens: text.length,
      total_tokens: 12 + text.length,
    },
  };
}

async function* createStream(signal?: AbortSignal): AsyncIterable<OpenAiStreamEvent> {
  const events: OpenAiStreamEvent[] = [
    { type: "response.output_text.delta", delta: "OpenAI " },
    { type: "response.output_text.delta", delta: "stream" },
    {
      type: "response.completed",
      response: {
        usage: {
          input_tokens: 4,
          output_tokens: 2,
          total_tokens: 6,
        },
      },
    },
  ];

  for (const event of events) {
    if (signal?.aborted) {
      return;
    }

    yield event;
    await Promise.resolve();
  }
}

async function* createIncompleteStream(): AsyncIterable<OpenAiStreamEvent> {
  yield { type: "response.output_text.delta", delta: "partial" };
  yield {
    type: "response.incomplete",
    response: {
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
    },
  };
}

function createStaticResponseTransport(
  response: OpenAiResponse,
  stream: AsyncIterable<OpenAiStreamEvent> = createStream(),
): OpenAiTransport {
  return {
    createResponse: async () => response,
    streamResponse: async () => stream,
    createEmbedding: async () => ({ data: [], usage: null }),
  };
}

function createEmbedding(input: string): number[] {
  const base = input.length || 1;
  return [base / 10, base / 20, base / 30, base / 40];
}

async function rejectOnAbort<T>(signal: AbortSignal | undefined): Promise<T> {
  return await new Promise<T>((_resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted", "AbortError"));
      return;
    }

    signal?.addEventListener(
      "abort",
      () => reject(new DOMException("The operation was aborted", "AbortError")),
      { once: true },
    );
  });
}
