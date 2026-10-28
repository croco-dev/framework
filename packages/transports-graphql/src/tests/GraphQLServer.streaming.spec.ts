import "reflect-metadata";
import type { Server, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import {
  Container,
  Context,
  Token,
  defineGeneratedDiGraph,
  GENERATED_DI_GRAPH_VERSION,
} from "@croco/framework-context";
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
        if (mode !== "disconnect") await within(expect(reader.read()).rejects.toThrow());
      } finally {
        client.abort();
        release.resolve();
        await server.stop();
      }
    },
  );
  it("stops without waiting for an uncooperative Yoga iterator", async () => {
    const waiting = gate();
    const release = gate();
    const cleaned = gate();
    const aborted = gate();
    let executionSignal: AbortSignal | undefined;
    let iteratorCleaned = false;
    const server = new GraphQLServer({
      schema: subscriptionSchema(async function* (signal) {
        executionSignal = signal;
        signal.addEventListener("abort", () => aborted.resolve(), { once: true });
        try {
          yield { sample: "live" };
          waiting.resolve();
          await release.promise;
        } finally {
          iteratorCleaned = true;
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
      await within(waiting.promise);
      await within(server.stop());
      await within(aborted.promise);
      expect(executionSignal?.aborted).toBe(true);
      expect(iteratorCleaned).toBe(false);
      await within(expect(reader.read()).rejects.toThrow());
    } finally {
      client.abort();
      release.resolve();
      await server.stop();
      await within(cleaned.promise);
    }
  });

  it.each(["socket-error", "write-throw"] as const)(
    "aborts the request signal and cleans the real Yoga iterator on %s",
    async (mode) => {
      const cleaned = gate();
      const next = gate();
      const release = gate();
      let executionSignal: AbortSignal | undefined;
      const server = new GraphQLServer({
        schema: subscriptionSchema(async function* (signal) {
          executionSignal = signal;
          signal.addEventListener("abort", () => release.resolve(), { once: true });
          try {
            yield { sample: "live" };
            await next.promise;
            yield { sample: "second" };
            await release.promise;
          } finally {
            cleaned.resolve();
          }
        }),
      });
      const client = new AbortController();
      await server.start(0);
      const node = Reflect.get(server, "server") as Server;
      let nodeResponse: ServerResponse | undefined;
      node.once("request", (_request, response) => {
        nodeResponse = response;
      });
      try {
        const response = await within(subscribe(endpoint(server), client.signal));
        const reader = response.body?.getReader();
        if (!reader || !nodeResponse) throw new Error("Missing subscription response");
        await within(readUntil(reader, '"sample":"live"'));
        if (mode === "socket-error") {
          nodeResponse.emit("error", new Error("socket failure"));
        } else {
          vi.spyOn(nodeResponse, "write").mockImplementationOnce(() => {
            throw new Error("write failure");
          });
        }
        next.resolve();
        await within(cleaned.promise);
        expect(executionSignal?.aborted).toBe(true);
        await expect(reader.read()).rejects.toThrow();
      } finally {
        client.abort();
        next.resolve();
        release.resolve();
        await server.stop();
      }
    },
  );

  it.each(["text/event-stream", "Text/Event-Stream; charset=utf-8"])(
    "flushes %s headers before a delayed first chunk and preserves separate cookies",
    async (contentType) => {
      const server = new GraphQLServer({ schema: subscriptionSchema(async function* () {}) });
      await server.initialize();
      const headers = new Headers({ "content-type": contentType });
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
    },
  );

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
      const cancelComplete = gate();
      let source: ReadableStreamDefaultController<Uint8Array> | undefined;
      const upstream = new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            source = controller;
            controller.enqueue(new TextEncoder().encode("event: next\ndata: first\n\n"));
          },
          cancel: () => {
            cancelled.resolve();
            return cancelComplete.promise;
          },
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
        await within(expect(reader.read()).rejects.toThrow());
        if (mode !== "source-error") await within(cancelled.promise);
        await vi.waitFor(() => expect(upstream.body?.locked).toBe(false));
      } finally {
        cancelComplete.resolve();
        client.abort();
        await server.stop();
      }
    },
  );
});

describe("GraphQL standalone subscription scope", () => {
  beforeEach(() => Container.reset());
  afterEach(() => Container.reset());

  function ledgerFixture() {
    const disposed = vi.fn();
    const token = new Token<object>("subscription-ledger");
    Container.installGeneratedGraph(
      defineGeneratedDiGraph({
        version: GENERATED_DI_GRAPH_VERSION,
        graphId: "subscription-scope",
        compilerVersion: "test",
        inputHash: "subscription-scope",
        roots: [token],
        providers: [
          {
            token,
            tokenId: "test:subscription-ledger",
            debugName: "SubscriptionLedger",
            scope: "request",
            dependencies: [],
            factory: () => ({ [Symbol.dispose]: disposed }),
            sourceLocation: { file: "GraphQLServer.streaming.spec.ts", line: 1, column: 1 },
          },
        ],
      }),
    );
    return { disposed, token };
  }

  function request(signal?: AbortSignal) {
    return new Request("http://localhost/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ query: "subscription { sample }" }),
      signal,
    });
  }

  it.each(["standalone", "inherited", "node"] as const)(
    "retains the same provider and authority across delayed yields in %s",
    async (mode) => {
      const { token, disposed } = ledgerFixture();
      const second = gate();
      const complete = gate();
      const observations: {
        ledger: object;
        requestId: string | null;
        tenant: string | null;
        user: string | undefined;
      }[] = [];
      const observe = () =>
        observations.push({
          ledger: Container.get(token),
          requestId: Context.getRequestId(),
          tenant: Context.getTenantId(),
          user: Context.getCurrentUser()?.id,
        });
      const server = new GraphQLServer({
        context: () => ({ tenantId: "tenant-42", user: { id: "user-73" } }),
        schema: subscriptionSchema(async function* () {
          observe();
          yield { sample: "first" };
          await second.promise;
          observe();
          yield { sample: "second" };
          await complete.promise;
        }),
      });
      const client = new AbortController();
      await server.initialize();
      const consume = async () => {
        const response =
          mode === "node"
            ? await subscribe(endpoint(server), client.signal)
            : await server.getHandler()(request(client.signal));
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Missing subscription body");
        try {
          expect(disposed).not.toHaveBeenCalled();
          await within(readUntil(reader, '"sample":"first"'));
          second.resolve();
          await within(readUntil(reader, '"sample":"second"'));
          expect(observations).toHaveLength(2);
          expect(observations[0].requestId).toBeTruthy();
          expect(observations[1]).toEqual(observations[0]);
          expect(observations[1]?.ledger).toBe(observations[0]?.ledger);
          expect(observations[1]).toMatchObject({ tenant: "tenant-42", user: "user-73" });
          complete.resolve();
          while (!(await within(reader.read())).done) {
            /* drain the completion event */
          }
          expect(disposed).toHaveBeenCalledTimes(mode === "inherited" ? 0 : 1);
        } finally {
          second.resolve();
          complete.resolve();
          await reader.cancel();
          reader.releaseLock();
        }
      };
      try {
        if (mode === "node") await server.start(0);
        if (mode === "inherited") await Context.run({ requestId: "outer-91" }, consume);
        else await consume();
        expect(disposed).toHaveBeenCalledTimes(1);
      } finally {
        client.abort();
        second.resolve();
        complete.resolve();
        await server.stop();
      }
    },
  );

  it.each(["cancel", "abort"] as const)(
    "disposes once and cancels the real iterator on %s",
    async (mode) => {
      const { token, disposed } = ledgerFixture();
      const cleaned = vi.fn();
      const release = gate();
      const client = new AbortController();
      const server = new GraphQLServer({
        context: () => {
          Container.get(token);
          return { tenantId: "cleanup-tenant" };
        },
        schema: subscriptionSchema(async function* () {
          try {
            yield { sample: "first" };
            await release.promise;
          } finally {
            cleaned(Context.getTenantId());
          }
        }),
      });
      await server.initialize();
      const response = await server.getHandler()(request(client.signal));
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Missing subscription body");
      try {
        await within(readUntil(reader, '"sample":"first"'));
        expect(disposed).not.toHaveBeenCalled();
        release.resolve();
        if (mode === "cancel") await within(reader.cancel("consumer done"));
        else {
          client.abort(new Error("request ended"));
          await within(expect(reader.read()).rejects.toThrow("request ended"));
        }
        await vi.waitFor(() => expect(cleaned).toHaveBeenCalledWith("cleanup-tenant"));
        expect(disposed).toHaveBeenCalledTimes(1);
        expect(cleaned).toHaveBeenCalledTimes(1);
        await reader.cancel().catch(() => undefined);
        client.abort();
        expect(disposed).toHaveBeenCalledTimes(1);
      } finally {
        release.resolve();
        reader.releaseLock();
      }
    },
  );

  it("disposes once on abort while the subscription iterator is still blocked", async () => {
    const { token, disposed } = ledgerFixture();
    const waiting = gate();
    const release = gate();
    const cleaned = vi.fn();
    const client = new AbortController();
    const server = new GraphQLServer({
      context: () => {
        Container.get(token);
        return { tenantId: "blocked-tenant" };
      },
      schema: subscriptionSchema(async function* () {
        try {
          yield { sample: "first" };
          waiting.resolve();
          await release.promise;
        } finally {
          cleaned(Context.getTenantId());
        }
      }),
    });
    await server.initialize();
    const response = await server.getHandler()(request(client.signal));
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing subscription body");
    let pending: Promise<unknown> | undefined;
    try {
      await within(readUntil(reader, '"sample":"first"'));
      pending = reader.read().catch((error: unknown) => error);
      await within(waiting.promise);
      expect(disposed).not.toHaveBeenCalled();
      const failure = new Error("blocked request ended");
      client.abort(failure);
      expect(await within(pending)).toBe(failure);
      expect(disposed).toHaveBeenCalledTimes(1);
      expect(cleaned).not.toHaveBeenCalled();
      release.resolve();
      await vi.waitFor(() => expect(cleaned).toHaveBeenCalledWith("blocked-tenant"));
      expect(disposed).toHaveBeenCalledTimes(1);
    } finally {
      release.resolve();
      client.abort();
      await pending;
      reader.releaseLock();
    }
  });

  it("rejects an abort before response return without waiting for blocked Yoga cleanup", async () => {
    const { token, disposed } = ledgerFixture();
    const waiting = gate();
    const release = gate();
    const cleaned = vi.fn();
    const client = new AbortController();
    const failure = new Error("response hook aborted");
    const server = new GraphQLServer({
      context: () => {
        Container.get(token);
        return { tenantId: "late-response-tenant" };
      },
      schema: subscriptionSchema(async function* () {
        try {
          yield { sample: "first" };
          waiting.resolve();
          await release.promise;
        } finally {
          cleaned(Context.getTenantId());
        }
      }),
      plugins: [
        {
          async onResponse({ response }) {
            const reader = response.body?.getReader();
            if (!reader) throw new Error("Missing Yoga body");
            try {
              await within(readUntil(reader, '"sample":"first"'));
            } finally {
              reader.releaseLock();
            }
            await within(waiting.promise);
            client.abort(failure);
          },
        },
      ],
    });
    await server.initialize();
    const outcome = server
      .getHandler()(request(client.signal))
      .catch((error: unknown) => error);
    try {
      expect(await within(outcome)).toBe(failure);
      expect(disposed).toHaveBeenCalledTimes(1);
      expect(cleaned).not.toHaveBeenCalled();
    } finally {
      release.resolve();
      client.abort();
      await outcome;
    }
    await vi.waitFor(() => expect(cleaned).toHaveBeenCalledWith("late-response-tenant"));
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  it.each(["blocked", "rejected"] as const)(
    "preserves abort while cancelling a late response with %s cleanup",
    async (mode) => {
      const { token, disposed } = ledgerFixture();
      const ready = gate();
      const release = gate();
      const cancelled = gate();
      const client = new AbortController();
      const failure = new Error("request ended before response observation");
      const cleanupFailure = new Error("late cleanup failed");
      const reported = vi.spyOn(console, "error").mockImplementation(() => undefined);
      let originalRequestId: string | null = null;
      let cancellationRequestId: string | null = null;
      let cancellationReason: unknown;
      const upstream = new Response(
        new ReadableStream({
          async cancel(reason: unknown) {
            cancellationRequestId = Context.getRequestId();
            cancellationReason = reason;
            cancelled.resolve();
            if (mode === "rejected") throw cleanupFailure;
            await release.promise;
          },
        }),
      );
      const server = new GraphQLServer({ schema: subscriptionSchema(async function* () {}) });
      await server.initialize();
      Reflect.set(server, "yogaHandler", async () => {
        originalRequestId = Context.getRequestId();
        Container.get(token);
        await ready.promise;
        return upstream;
      });
      const outcome = server
        .getHandler()(request(client.signal))
        .catch((error: unknown) => error);
      try {
        ready.resolve();
        client.abort(failure);
        await within(cancelled.promise);
        expect(await within(outcome)).toBe(failure);
        expect(disposed).toHaveBeenCalledTimes(1);
        expect(originalRequestId).toBeTruthy();
        expect(cancellationRequestId).toBe(originalRequestId);
        expect(cancellationReason).toBe(failure);
        if (mode === "rejected") {
          await vi.waitFor(() =>
            expect(reported).toHaveBeenCalledWith("GraphQL request failed", {
              phase: "response-body",
              problemCode: "transports-graphql/request-handling-failed",
            }),
          );
        }
      } finally {
        ready.resolve();
        release.resolve();
        client.abort(failure);
        await outcome;
        reported.mockRestore();
      }
    },
  );

  it.each(["consume", "cancel"] as const)(
    "retains an ordinary query provider until JSON body %s",
    async (mode) => {
      const { token, disposed } = ledgerFixture();
      const server = new GraphQLServer({
        context: () => {
          Container.get(token);
          return {};
        },
        schema: subscriptionSchema(async function* () {}),
      });
      await server.initialize();
      const response = await server.getHandler()(
        new Request("http://localhost/graphql", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ query: "{ sample }" }),
        }),
      );
      try {
        expect(disposed).not.toHaveBeenCalled();
        if (mode === "consume") {
          expect(await response.json()).toEqual({ data: { sample: "query-result" } });
        } else {
          if (!response.body) throw new Error("Missing query body");
          await response.body.cancel();
        }
        expect(disposed).toHaveBeenCalledTimes(1);
      } finally {
        if (!response.bodyUsed) await response.body?.cancel();
      }
    },
  );

  it.each(["error", "cancel-rejection", "no-body", "handler-rejection", "pre-abort"] as const)(
    "releases owned providers and source locks on %s",
    async (mode) => {
      const { token, disposed } = ledgerFixture();
      const failure = new Error("source failed");
      const server = new GraphQLServer({ schema: subscriptionSchema(async function* () {}) });
      await server.initialize();
      let source: ReadableStreamDefaultController<Uint8Array> | undefined;
      const upstream = new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            source = controller;
          },
          cancel() {
            if (mode === "cancel-rejection") throw failure;
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      );
      const invoked = vi.fn(() => {
        Container.get(token);
        if (mode === "handler-rejection") throw failure;
        return mode === "no-body" ? new Response(null, { status: 204 }) : upstream;
      });
      Reflect.set(server, "yogaHandler", invoked);
      const client = new AbortController();
      if (mode === "pre-abort") client.abort(failure);
      if (mode === "handler-rejection" || mode === "pre-abort") {
        await expect(server.getHandler()(request(client.signal))).rejects.toBe(failure);
        expect(invoked).toHaveBeenCalledTimes(mode === "pre-abort" ? 0 : 1);
      } else {
        const response = await server.getHandler()(request(client.signal));
        if (mode === "error") {
          source?.error(failure);
          await expect(response.text()).rejects.toBe(failure);
        } else if (mode === "cancel-rejection")
          await expect(response.body?.cancel()).rejects.toBe(failure);
        else expect(response.status).toBe(204);
      }
      expect(disposed).toHaveBeenCalledTimes(mode === "pre-abort" ? 0 : 1);
      expect(upstream.body?.locked).toBe(false);
      client.abort();
    },
  );
});
