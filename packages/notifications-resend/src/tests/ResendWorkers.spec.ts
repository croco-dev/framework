import { createHash } from "node:crypto";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import type { Request as MiniflareRequest } from "miniflare";
import { describe, expect, it } from "vitest";

const apiKey = "re_workers_synthetic_secret";
const payload = {
  to: "Member <private@example.com>",
  subject: "Private receipt 73",
  content: "<p>Private balance 29</p>",
  text: "Private balance 29",
  replyTo: "support@example.com",
  headers: { "X-Business-Reference": "private-reference" },
};
const key = "tenant-a:receipt:73";

// Bundle the real package, including its SDK and retry policy, without source aliases or SDK mocks.
const bundle = await build({
  stdin: {
    resolveDir: import.meta.dirname,
    sourcefile: "resend-worker.ts",
    contents: `
      import { ResendProvider } from '@croco/notifications-resend';
      export default { async fetch(request, env) {
        try {
          const { payload, key } = await request.json();
          const result = await new ResendProvider({ apiKey: env.RESEND_API_KEY, from: 'Croco <sender@example.com>' })
            .send(payload, { idempotencyKey: key });
          return Response.json(result.success
            ? { success: true, messageId: result.messageId }
            : { success: false, problem: result.problem.toJSON() });
        } catch (error) {
          if (!error.toJSON) throw error;
          return Response.json({ problem: error.toJSON() }, { status: error.status });
        }
      } };
    `,
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  mainFields: ["module", "main"],
  conditions: ["workerd", "worker", "browser"],
  external: ["node:*"],
});

async function withWorker(
  upstream: (request: MiniflareRequest) => Promise<Response> | Response,
  run: (worker: Miniflare) => Promise<void>,
  secret = apiKey,
) {
  const worker = new Miniflare({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: "2026-03-12",
    compatibilityFlags: ["nodejs_compat"],
    bindings: { RESEND_API_KEY: secret },
    outboundService: upstream,
  });
  try {
    await run(worker);
  } finally {
    await worker.dispose();
  }
}

async function send(worker: Miniflare, idempotencyKey: string | undefined = key) {
  return worker.dispatchFetch("https://fixture.invalid/send", {
    method: "POST",
    body: JSON.stringify({ payload, key: idempotencyKey }),
  });
}

describe("Resend on actual workerd with a synthetic HTTP upstream", () => {
  it("sends rendered email using the secret binding and reports provider acceptance", async () => {
    let requests = 0;
    await withWorker(
      async (request) => {
        requests++;
        expect(request.url).toBe("https://api.resend.com/emails");
        expect(request.method).toBe("POST");
        expect(request.headers.get("Authorization")).toBe(`Bearer ${apiKey}`);
        expect(request.headers.get("Idempotency-Key")).toBe(key);
        expect(await request.json()).toEqual({
          from: "Croco <sender@example.com>",
          to: payload.to,
          subject: payload.subject,
          html: payload.content,
          text: payload.text,
          reply_to: payload.replyTo,
          headers: payload.headers,
        });
        return Response.json({ id: "accepted-email-73" });
      },
      async (worker) => {
        const response = await send(worker);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ success: true, messageId: "accepted-email-73" });
      },
    );
    expect(requests).toBe(1);
  });

  it("keeps a deterministic bounded key across retries and separate Worker callbacks", async () => {
    const longKey = `tenant-a:${"business-object:".repeat(24)}73`;
    const expectedKey = `croco:v1:${createHash("sha256").update(longKey).digest("hex")}`;
    const keys: (string | null)[] = [];
    await withWorker(
      (request) => {
        keys.push(request.headers.get("Idempotency-Key"));
        return keys.length === 1
          ? Response.json({ name: "rate_limit_exceeded", message: "Rate limited" }, { status: 429 })
          : Response.json({ id: "accepted-email-73" });
      },
      async (worker) => {
        expect(await (await send(worker, longKey)).json()).toEqual({
          success: true,
          messageId: "accepted-email-73",
        });
        expect(await (await send(worker, longKey)).json()).toEqual({
          success: true,
          messageId: "accepted-email-73",
        });
      },
    );
    expect(keys).toEqual([expectedKey, expectedKey, expectedKey]);
  });

  it.each([
    [503, "internal_server_error", "notifications-resend/retryable-upstream", true, 3],
    [408, "request_timeout", "notifications-resend/retryable-upstream", true, 3],
    [403, "invalid_api_key", "notifications-resend/terminal-upstream", false, 1],
    [409, "invalid_idempotent_request", "notifications-resend/idempotency-conflict", false, 1],
  ] as const)(
    "classifies HTTP %i without exposing private send inputs",
    async (status, name, code, retryable, attempts) => {
      let requests = 0;
      await withWorker(
        () => {
          requests++;
          return Response.json(
            {
              name,
              statusCode: status,
              message: `Authorization: Bearer ${apiKey}; ${payload.to}; ${payload.subject}; ${payload.content}; ${payload.text}; ${payload.replyTo}; ${payload.headers["X-Business-Reference"]}; ${key}`,
            },
            { status },
          );
        },
        async (worker) => {
          const result = await (await send(worker)).json();
          expect(result).toMatchObject({
            success: false,
            problem: { code, retryable },
          });
          const diagnostic = JSON.stringify(result);
          for (const privateValue of [
            apiKey,
            payload.to,
            payload.subject,
            payload.content,
            payload.text,
            payload.replyTo,
            payload.headers["X-Business-Reference"],
            key,
          ]) {
            expect(diagnostic).not.toContain(privateValue);
          }
        },
      );
      expect(requests).toBe(attempts);
    },
  );

  it("rejects a missing secret binding before contacting the provider", async () => {
    let requests = 0;
    await withWorker(
      () => {
        requests++;
        return Response.json({ id: "should-not-send" });
      },
      async (worker) => {
        expect(await (await send(worker)).json()).toMatchObject({
          problem: { code: "notifications-resend/missing-config" },
        });
      },
      "",
    );
    expect(requests).toBe(0);
  });
});
