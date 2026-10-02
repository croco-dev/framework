import { createServer } from "node:http";
import { selectedIds } from "./fixture";
import type { AnalysisModelRequest } from "@croco/analytics-core";

/** Deterministic HTTP fixture for the real native SDK; never forwards to a vendor. */
export async function startLocalProvider(
  options: { status?: string; error?: { code: string; message: string } } = {},
) {
  const requests: Record<string, unknown>[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += String(chunk);
    const payload = JSON.parse(body) as Record<string, unknown>;
    requests.push(payload);
    if (requests.length > 32) requests.shift();
    const input = JSON.parse(String(payload.input)) as AnalysisModelRequest;
    const slow = input.question.includes("slow");
    await new Promise((resolve) => setTimeout(resolve, slow ? 2500 : 150));
    if (response.destroyed) return;
    response.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({
        id: "resp_synthetic",
        object: "response",
        created_at: 0,
        status:
          options.status ?? (input.question.includes("truncated") ? "incomplete" : "completed"),
        model: payload.model,
        error: options.error ?? null,
        incomplete_details: null,
        output: [
          {
            id: "msg_synthetic",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: input.question.includes("invalid-json")
                  ? "{invalid"
                  : JSON.stringify({ choiceIds: selectedIds(input) }),
                annotations: [],
              },
            ],
          },
        ],
        usage: {
          input_tokens: 100,
          output_tokens: 10,
          total_tokens: 110,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens_details: { reasoning_tokens: 0 },
        },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Local provider address unavailable");
  return {
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
