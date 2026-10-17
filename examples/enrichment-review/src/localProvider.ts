import { createServer } from "node:http";
import { EnrichmentProblem } from "@croco/analytics-core/enrichment";

/** Loopback-only protocol fixture. No vendor requests or credentials. */
export async function startLocalProvider(
  options: {
    status?: string;
    output?: string;
    usage?: boolean;
    httpStatus?: number;
    hold?: boolean;
    error?: string;
  } = {},
) {
  const requests: Record<string, unknown>[] = [];
  let received: (() => void) | undefined;
  const firstRequest = new Promise<void>((resolve) => {
    received = resolve;
  });
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
    requests.push(payload);
    received?.();
    if (options.hold) return;
    if (options.httpStatus) {
      response.writeHead(options.httpStatus, { "content-type": "application/json" }).end(
        JSON.stringify({
          error: { message: "synthetic quota failure", type: "rate_limit_error" },
        }),
      );
      return;
    }
    const input = JSON.parse(String(payload.input)) as { text: string };
    response
      .writeHead(200, { "content-type": "application/json", "x-request-id": "req-local" })
      .end(
        JSON.stringify({
          id: "resp_local",
          object: "response",
          created_at: 0,
          status: options.status ?? "completed",
          model: payload.model,
          error: options.error ? { code: "fixture_failure", message: options.error } : null,
          output: [
            {
              id: "msg_local",
              type: "message",
              role: "assistant",
              status: "completed",
              content: [
                {
                  type: "output_text",
                  text:
                    options.output ??
                    JSON.stringify({ labelId: input.text.includes("buy") ? "purchase" : null }),
                  annotations: [],
                },
              ],
            },
          ],
          ...(options.usage === false
            ? {}
            : {
                usage: {
                  input_tokens: 73,
                  output_tokens: 11,
                  total_tokens: 84,
                  input_tokens_details: { cached_tokens: 0 },
                  output_tokens_details: { reasoning_tokens: 0 },
                },
              }),
        }),
      );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new EnrichmentProblem("local-provider-unavailable");
  return {
    baseURL: `http://127.0.0.1:${address.port}/v1`,
    requests,
    firstRequest,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
