import "reflect-metadata";
import { Container, Context, Token } from "@croco/framework-context";
import { InMemoryLlmModel, type GenerateParams, type GenerateResult } from "@croco/llm-core";
import { ProblemFactory } from "@croco/problems-core";
import { Controller, Get, Param } from "@croco/protocols-rest";
import { InMemoryStorageProvider } from "@croco/storage-core";
import { beforeEach, describe, expect, it } from "vitest";
import {
  assertOpenAPIRoute,
  assertProblemResponse,
  createLlmProviderConformanceSuite,
  createStorageProviderConformanceSuite,
  createRpcTestFetch,
  createTestingApp,
  resetCrocoTestingContext,
} from "../index";

class GreetingService {
  constructor(private readonly prefix: string = "Hello") {}

  greet(name: string): string {
    return `${this.prefix}, ${name}`;
  }
}

class FailingLlmModel extends InMemoryLlmModel {
  override async generate(_params: GenerateParams): Promise<GenerateResult> {
    throw ProblemFactory.internalServerError(
      "testing/llm-provider-failed",
      "provider generate failed",
    );
  }
}

type TokenValue = {
  readonly value: string;
};

const TOKEN_VALUE = new Token<TokenValue>("testing.value");

@Controller("/greetings")
class GreetingController {
  constructor(private readonly service: GreetingService) {}

  @Get("/:name")
  getGreeting(@Param("name") name: string) {
    return {
      message: this.service.greet(name),
    };
  }

  @Get("/problems/missing")
  missing() {
    throw ProblemFactory.notFound("testing/greeting-not-found", "Greeting was not found");
  }
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function greetingProviders(prefix = "Hello") {
  const service = new GreetingService(prefix);

  return [
    { token: GreetingService, useValue: service },
    { token: GreetingController, useValue: new GreetingController(service) },
  ];
}

describe("@croco/testing", () => {
  beforeEach(() => {
    Container.reset();
  });

  it("creates an isolated app that injects controller requests without manual bootstrap", async () => {
    const app = createTestingApp({
      controllers: [GreetingController],
      providers: greetingProviders(),
    });

    const response = await app.get("/greetings/Ada");

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ message: "Hello, Ada" });
  });

  it("resets provider state between testing apps", async () => {
    const first = createTestingApp({
      controllers: [GreetingController],
      providers: greetingProviders("First"),
    });

    await expect(readJson(await first.get("/greetings/Ada"))).resolves.toEqual({
      message: "First, Ada",
    });

    const second = createTestingApp({
      controllers: [GreetingController],
      providers: greetingProviders("Second"),
    });

    await expect(readJson(await second.get("/greetings/Ada"))).resolves.toEqual({
      message: "Second, Ada",
    });
  });

  it("does not leak request context after request injection", async () => {
    const app = createTestingApp({
      controllers: [GreetingController],
      providers: greetingProviders(),
    });

    expect(Context.isActive()).toBe(false);
    await app.get("/greetings/Ada");
    expect(Context.isActive()).toBe(false);
  });

  it("asserts Problem Details responses through the HTTP runtime", async () => {
    const app = createTestingApp({
      controllers: [GreetingController],
      providers: greetingProviders(),
    });

    const response = await app.get("/greetings/problems/missing");
    const problem = await assertProblemResponse(response, {
      code: "testing/greeting-not-found",
      detailIncludes: "Greeting was not found",
      status: 404,
      title: "Not Found",
    });

    expect(problem.instance).toBe("http://localhost/greetings/problems/missing");
  });

  it("asserts OpenAPI route contracts from controllers", () => {
    const operation = assertOpenAPIRoute([GreetingController], {
      contentType: "application/problem+json",
      method: "GET",
      path: "/greetings/:name",
      status: 422,
    });

    expect(operation.operationId).toBe("GreetingController_getGreeting");
  });

  it("routes generated-style RPC clients through the in-memory app", async () => {
    const app = createTestingApp({
      controllers: [GreetingController],
      providers: greetingProviders(),
    });
    const rpcFetch = createRpcTestFetch(app);

    const generatedStyleClient = {
      getGreeting: async (name: string) => {
        const response = await rpcFetch(`/greetings/${name}`, { method: "GET" });
        return readJson(response);
      },
    };

    await expect(generatedStyleClient.getGreeting("Grace")).resolves.toEqual({
      message: "Hello, Grace",
    });
  });

  it("seeds reset defaults for apps created outside createTestingApp", async () => {
    resetCrocoTestingContext({ providers: greetingProviders() });
    const app = createTestingApp({
      controllers: [GreetingController],
      resetContainer: false,
    });

    await expect(readJson(await app.get("/greetings/Lynn"))).resolves.toEqual({
      message: "Hello, Lynn",
    });
  });

  it("registers token-backed testing providers", () => {
    resetCrocoTestingContext({
      providers: [{ token: TOKEN_VALUE, useValue: { value: "registered" } }],
    });

    expect(Container.get(TOKEN_VALUE)).toEqual({ value: "registered" });
  });

  describe("storage provider conformance", () => {
    it.each(
      createStorageProviderConformanceSuite({
        createProvider: () => new InMemoryStorageProvider("https://storage.example.com"),
        keyPrefix: "testing-conformance",
        metadata: {
          contentType: "required",
          customMetadata: "required",
        },
        providerName: "in-memory-storage",
        publicUrl: "https://storage.example.com/",
        signedUrl: "expires=",
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });

  describe("LLM provider conformance", () => {
    const modelId = "conformance-model";
    const createModel = () =>
      new InMemoryLlmModel(modelId, {
        "croco conformance generate": "governed response",
        "croco conformance stream": "streaming governed response",
        "croco conformance object": '{"ok":true,"label":"croco"}',
        "croco conformance tool": 'lookup:{"topic":"croco"}',
      });

    it.each(
      createLlmProviderConformanceSuite({
        createFailingModel: () => new FailingLlmModel(modelId),
        createModel,
        modelId,
        providerName: "in-memory-llm",
        prompts: {
          generate: {
            prompt: "croco conformance generate",
            expectedText: "governed response",
          },
          stream: {
            prompt: "croco conformance stream",
            minimumChunks: 2,
          },
          object: {
            prompt: "croco conformance object",
            schema: { type: "object" },
            assertObject: (value) => {
              expect(value).toEqual({ ok: true, label: "croco" });
            },
          },
          tool: {
            prompt: "croco conformance tool",
            tools: [
              {
                name: "lookup",
                description: "Lookup a topic",
                parameters: {
                  type: "object",
                  properties: {
                    topic: { type: "string" },
                  },
                  required: ["topic"],
                },
              },
            ],
            assertToolResult: (result) => {
              expect(result.toolCalls).toEqual([
                {
                  name: "lookup",
                  arguments: { topic: "croco" },
                },
              ]);
            },
          },
          embed: {
            text: "croco embedding",
            expectedDimensions: 1536,
          },
          embedMany: {
            texts: ["croco one", "croco two"],
            expectedDimensions: 1536,
          },
        },
      }).cases,
    )("$name", async ({ run }) => {
      await run();
    });
  });
});
