import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createOpenAIGenerate,
  createTenantOpenAIClient,
  deterministicGenerate,
} from "../aiGenerate";

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanups.splice(0)) close();
  vi.unstubAllEnvs();
});

async function fixture(handle: (request: IncomingMessage, response: ServerResponse) => void) {
  const server = createServer(handle);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture port");
  return `http://127.0.0.1:${address.port}/v1`;
}

function completed(response: ServerResponse, usage = true, status = "completed") {
  response.setHeader("content-type", "application/json");
  response.setHeader("x-request-id", "request-fixture");
  response.end(
    JSON.stringify({
      id: "response-fixture",
      object: "response",
      model: "fixture-model",
      status,
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Hello", annotations: [] }],
        },
      ],
      ...(usage ? { usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } } : {}),
    }),
  );
}
const input = () => ({
  tenantId: "a",
  modelId: "fixture-model",
  prompt: "Hello",
  signal: new AbortController().signal,
  deadline: Date.now() + 2000,
});

describe("direct OpenAI Responses reference", () => {
  it("enforces the same expired-deadline contract before either implementation dispatches", async () => {
    let requests = 0;
    const baseURL = await fixture((_request, response) => {
      requests++;
      completed(response);
    });
    const implementations = [
      deterministicGenerate,
      createOpenAIGenerate(() => createTenantOpenAIClient({ apiKey: "test", baseURL })),
    ];

    for (const generate of implementations) {
      await expect(generate({ ...input(), deadline: Date.now() - 1 })).rejects.toThrow();
    }
    expect(requests).toBe(0);
  });

  it("maps completed text, usage, ids and isolates tenant auth/context", async () => {
    vi.stubEnv("OPENAI_API_KEY", "ambient-key-must-not-be-used");
    vi.stubEnv("OPENAI_ORG_ID", "ambient-org-must-not-be-used");
    vi.stubEnv("OPENAI_PROJECT_ID", "ambient-project-must-not-be-used");
    const calls: {
      auth: string | undefined;
      organization: string | undefined;
      project: string | undefined;
      body: string;
    }[] = [];
    const baseURL = await fixture((request, response) => {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        calls.push({
          auth: request.headers.authorization,
          organization: request.headers["openai-organization"] as string | undefined,
          project: request.headers["openai-project"] as string | undefined,
          body,
        });
        completed(response);
      });
    });
    const clients = new Map(
      ["a", "b"].map((tenant) => [
        tenant,
        createTenantOpenAIClient({ apiKey: `key-${tenant}`, baseURL }),
      ]),
    );
    const generate = createOpenAIGenerate((tenant) => {
      const client = clients.get(tenant);
      if (!client) throw new Error("Unknown tenant");
      return client;
    });
    const result = await generate(input());
    await generate({ ...input(), tenantId: "b" });
    expect(result).toMatchObject({
      text: "Hello",
      provider: "openai",
      modelId: "fixture-model",
      providerResponseId: "response-fixture",
      providerRequestId: "request-fixture",
      usage: { state: "known", inputTokens: 3, outputTokens: 2, totalTokens: 5 },
    });
    expect(calls.map((call) => call.auth)).toEqual(["Bearer key-a", "Bearer key-b"]);
    for (const call of calls) {
      expect(call.organization).toBeUndefined();
      expect(call.project).toBeUndefined();
      expect(JSON.parse(call.body)).toMatchObject({ store: false, max_output_tokens: 512 });
    }
  });

  it("preserves missing usage and rejects non-completed responses", async () => {
    let status = "completed";
    const baseURL = await fixture((_request, response) => completed(response, false, status));
    const generate = createOpenAIGenerate(() =>
      createTenantOpenAIClient({ apiKey: "test", baseURL }),
    );
    expect((await generate(input())).usage).toEqual({ state: "unknown" });
    status = "incomplete";
    await expect(generate(input())).rejects.toThrow();
  });

  it.each(["headers", "body"])("cancels a stalled %s without retrying", async (stall) => {
    let requests = 0;
    const baseURL = await fixture((_request, response) => {
      requests++;
      if (stall === "body") {
        response.writeHead(200, { "content-type": "application/json" });
        response.write('{"id":');
      }
    });
    const generate = createOpenAIGenerate(() =>
      createTenantOpenAIClient({ apiKey: "test", baseURL }),
    );
    await expect(
      generate({ ...input(), signal: AbortSignal.timeout(100), deadline: Date.now() + 500 }),
    ).rejects.toThrow();
    expect(requests).toBe(1);
  });
});
