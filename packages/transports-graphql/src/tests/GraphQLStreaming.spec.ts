import "reflect-metadata";
import type { Server, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { Container } from "@croco/framework-context";
import type * as GraphQL from "graphql";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GraphQLServer } from "../libs/GraphQLServer";

// Use the native GraphQL module instance shared by Yoga.
const { GraphQLObjectType, GraphQLSchema, GraphQLString } = createRequire(import.meta.url)(
  "graphql",
) as typeof GraphQL;

function gate() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function within<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Streaming progress exceeded 1000 ms")), 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function subscriptionSchema(
  subscribe: (signal: AbortSignal) => AsyncGenerator<{ sample: string }>,
) {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: "Query",
      fields: { sample: { type: GraphQLString, resolve: () => "query-result" } },
    }),
    subscription: new GraphQLObjectType({
      name: "Subscription",
      fields: {
        sample: {
          type: GraphQLString,
          subscribe: (_source, _args, context: { request: Request }) =>
            subscribe(context.request.signal),
        },
      },
    }),
  });
}

function endpoint(server: GraphQLServer): string {
  const node = Reflect.get(server, "server") as Server;
  const address = node.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
  return `http://127.0.0.1:${address.port}/graphql`;
}

function subscribe(url: string, signal: AbortSignal) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify({ query: "subscription { sample }" }),
    signal,
  });
}

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  marker: string,
): Promise<string> {
  const decoder = new TextDecoder();
  let text = "";
  while (!text.includes(marker)) {
    const chunk = await reader.read();
    if (chunk.done) throw new Error(`Stream ended before ${marker}`);
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text;
}

describe("GraphQL Node subscription streaming", () => {
  beforeEach(() => Container.reset());
  afterEach(() => Container.reset());

  it("delivers each payload before the next gate and completes the stream", async () => {
    const second = gate();
    const complete = gate();
    const server = new GraphQLServer({
      schema: subscriptionSchema(async function* () {
        yield { sample: "first" };
        await second.promise;
        yield { sample: "second" };
        await complete.promise;
      }),
    });
    const client = new AbortController();
    await server.start(0);
    try {
      const response = await within(subscribe(endpoint(server), client.signal));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Missing subscription body");
      const first = await within(readUntil(reader, '"sample":"first"'));
      expect(first).not.toContain('"sample":"second"');
      second.resolve();
      const next = await within(readUntil(reader, '"sample":"second"'));
      expect(next).not.toContain("event: complete");
      complete.resolve();
      expect(await within(readUntil(reader, "event: complete"))).toContain("event: complete");
      expect((await within(reader.read())).done).toBe(true);
    } finally {
      second.resolve();
      complete.resolve();
      client.abort();
      await server.stop();
    }
  });

  it.each(["disconnect", "stop", "deadline"] as const)(
    "cleans up a live iterator on %s",
    async (mode) => {
      const cleaned = gate();
      const release = gate();
      let executionSignal: AbortSignal | undefined;
      const server = new GraphQLServer({
        requestTimeoutMs: mode === "deadline" ? 300 : undefined,
        schema: subscriptionSchema(async function* (signal) {
          executionSignal = signal;
          signal.addEventListener("abort", () => release.resolve(), { once: true });
          try {
            yield { sample: "live" };
            await release.promise;
          } finally {
            cleaned.resolve();
          }
        }),
      });
      const client = new AbortController();
      await server.start(0);
      try {
        const response = await within(subscribe(endpoint(server), client.signal));
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Missing subscription body");
        await within(readUntil(reader, '"sample":"live"'));
        if (mode === "disconnect") client.abort();
        if (mode === "stop") await within(server.stop());
        await within(cleaned.promise);
        expect(executionSignal?.aborted).toBe(true);
        if (mode !== "disconnect") await expect(within(reader.read())).rejects.toThrow();
      } finally {
        client.abort();
        release.resolve();
        await server.stop();
      }
    },
  );
  it("flushes headers before a delayed first chunk and preserves separate cookies", async () => {
    const server = new GraphQLServer({ schema: subscriptionSchema(async function* () {}) });
    await server.initialize();
    const headers = new Headers({ "content-type": "text/event-stream" });
    headers.append("set-cookie", "session=one; HttpOnly; Path=/");
    headers.append("set-cookie", "csrf=two; SameSite=Strict; Path=/");
    const cancelled = gate();
    const upstream = new Response(new ReadableStream({ cancel: () => cancelled.resolve() }), {
      headers,
    });
    Reflect.set(server, "yogaHandler", async () => upstream);
    const client = new AbortController();
    await server.start(0);
    try {
      const response = await within(subscribe(endpoint(server), client.signal));
      expect(response.headers.getSetCookie()).toEqual([
        "session=one; HttpOnly; Path=/",
        "csrf=two; SameSite=Strict; Path=/",
      ]);
      client.abort();
      await within(cancelled.promise);
      expect(upstream.body?.locked).toBe(false);
    } finally {
      client.abort();
      await server.stop();
    }
  });

  it("waits for Node drain before pulling the next payload", async () => {
    const server = new GraphQLServer({ schema: subscriptionSchema(async function* () {}) });
    await server.initialize();
    let pulls = 0;
    const upstream = new Response(
      new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            pulls++;
            controller.enqueue(new TextEncoder().encode(`event: next\ndata: ${pulls}\n\n`));
            if (pulls === 2) controller.close();
          },
        },
        { highWaterMark: 0 },
      ),
      { headers: { "content-type": "text/event-stream" } },
    );
    Reflect.set(server, "yogaHandler", async () => upstream);
    await server.start(0);
    const node = Reflect.get(server, "server") as Server;
    let nodeResponse: ServerResponse | undefined;
    node.once("request", (_request, response) => {
      nodeResponse = response;
      const originalWrite = response.write;
      vi.spyOn(response, "write").mockImplementationOnce(function (
        this: ServerResponse,
        chunk: Uint8Array,
      ) {
        Reflect.apply(originalWrite, this, [chunk]);
        return false;
      });
    });
    const client = new AbortController();
    try {
      const response = await within(subscribe(endpoint(server), client.signal));
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Missing subscription body");
      await within(readUntil(reader, "data: 1"));
      expect(pulls).toBe(1);
      nodeResponse?.emit("drain");
      await within(readUntil(reader, "data: 2"));
      expect((await within(reader.read())).done).toBe(true);
      expect(upstream.body?.locked).toBe(false);
    } finally {
      client.abort();
      await server.stop();
    }
  });

  it.each(["source-error", "write-error", "disconnect-during-drain"] as const)(
    "closes the committed stream and releases its reader on %s",
    async (mode) => {
      const server = new GraphQLServer({ schema: subscriptionSchema(async function* () {}) });
      await server.initialize();
      const cancelled = gate();
      let source: ReadableStreamDefaultController<Uint8Array> | undefined;
      const upstream = new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            source = controller;
            controller.enqueue(new TextEncoder().encode("event: next\ndata: first\n\n"));
          },
          cancel: () => cancelled.resolve(),
        }),
        { headers: { "content-type": "text/event-stream" } },
      );
      Reflect.set(server, "yogaHandler", async () => upstream);
      await server.start(0);
      const node = Reflect.get(server, "server") as Server;
      let nodeResponse: ServerResponse | undefined;
      node.once("request", (_request, response) => {
        nodeResponse = response;
        if (mode === "disconnect-during-drain") {
          const originalWrite = response.write;
          vi.spyOn(response, "write").mockImplementationOnce(function (
            this: ServerResponse,
            chunk: Uint8Array,
          ) {
            Reflect.apply(originalWrite, this, [chunk]);
            return false;
          });
        }
      });
      const client = new AbortController();
      try {
        const response = await within(subscribe(endpoint(server), client.signal));
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Missing subscription body");
        await within(readUntil(reader, "data: first"));
        if (mode === "source-error") source?.error(new Error("upstream secret"));
        if (mode === "write-error") nodeResponse?.emit("error", new Error("socket secret"));
        if (mode === "disconnect-during-drain") client.abort();
        await expect(within(reader.read())).rejects.toThrow();
        if (mode !== "source-error") await within(cancelled.promise);
        await vi.waitFor(() => expect(upstream.body?.locked).toBe(false));
      } finally {
        client.abort();
        await server.stop();
      }
    },
  );
});
