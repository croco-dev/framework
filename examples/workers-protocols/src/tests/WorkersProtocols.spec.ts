import { createProtocolFixture } from "../application";
import { invokeLambdaFixture, fetchThroughLambdaFixture } from "./lambdaFixture";
import "reflect-metadata";
import { print } from "graphql";
import { readFileSync } from "node:fs";
import { GraphQLServer } from "@croco/transports-graphql";
import { createGraphQLFixture } from "../graphqlFixture";
import { getSdk } from "../generated/graphql";
import { execFileSync } from "node:child_process";
import { Miniflare, Response as MiniflareResponse } from "miniflare";
import { createTRPCUntypedClient, httpLink } from "@trpc/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let worker: Miniflare;
beforeAll(async () => {
  execFileSync(process.execPath, ["build.mjs"]);
  let arrivals = 0;
  let release: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  worker = new Miniflare({
    outboundService: async (request) => {
      if (request.url !== "https://request-overlap.invalid/rendezvous") {
        throw new Error("Unexpected outbound request in the local protocol fixture");
      }
      if (++arrivals === 4) release();
      await ready;
      return new MiniflareResponse(null, { status: 204 });
    },
    modules: true,
    scriptPath: "dist/worker.mjs",
    compatibilityDate: "2026-03-12",
    compatibilityFlags: ["nodejs_compat"],
  });
  await worker.ready;
}, 30000);
afterAll(async () => {
  await worker?.dispose();
});

const headers = (tenant = "tenant-a", overlap = false) => ({
  ...(overlap ? { "x-overlap": "four-requests" } : {}),
  authorization: `Bearer ${tenant}`,
  cookie: `session=${tenant}`,
  "content-type": "application/json",
});
const graphql = (query: string, tenant = "tenant-a", extra: Record<string, string> = {}) =>
  worker.dispatchFetch("http://worker/graphql", {
    method: "POST",
    headers: { ...headers(tenant), ...extra },
    body: JSON.stringify({ query }),
  });
const trpc = (tenant = "tenant-a", overlap = false) =>
  createTRPCUntypedClient({
    links: [
      httpLink({
        url: "http://worker/trpc",
        headers: () => headers(tenant, overlap),
        fetch: (url, init) =>
          worker.dispatchFetch(
            String(url),
            init as Parameters<Miniflare["dispatchFetch"]>[1],
          ) as unknown as Promise<Response>,
      }),
    ],
  });

describe("Workers protocol transports on actual workerd", () => {
  it.each(["node-fetch", "workerd"])(
    "runs the generated GraphQL SDK against %s using the same fixture",
    async (runtime) => {
      const server = new GraphQLServer(
        createGraphQLFixture(readFileSync("src/schema.graphql", "utf8")),
      );
      await server.initialize();
      const sdk = getSdk(async (document, variables) => {
        const request = new Request("http://worker/graphql", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ query: print(document), variables }),
        });
        const response =
          runtime === "workerd"
            ? await worker.dispatchFetch(request.url, {
                method: request.method,
                headers: Object.fromEntries(request.headers),
                body: await request.text(),
              })
            : await server.getHandler()(request);
        return response.json();
      });
      expect(await sdk.Echo({ name: "Crocodile" })).toEqual({
        data: { echo: "tenant-a:Crocodile" },
      });
      expect(await sdk.Probe()).toMatchObject({
        data: { probe: "tenant-a:session=tenant-a", broken: null },
        errors: [{ extensions: { code: "workers-protocols/missing" } }],
      });
    },
  );

  it("preserves the shared GraphQL fixture through the Lambda host envelope", async () => {
    const server = new GraphQLServer(
      createGraphQLFixture(readFileSync("src/schema.graphql", "utf8")),
    );
    await server.initialize();
    const response = await invokeLambdaFixture(
      { fetch: server.getHandler() },
      new Request("http://worker/graphql", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ query: "{ probe broken }" }),
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.cookies).toEqual([
      "first=one; HttpOnly; Path=/",
      "second=two; HttpOnly; Path=/",
    ]);
    expect(JSON.parse(response.body ?? "null")).toMatchObject({
      data: { probe: "tenant-a:session=tenant-a", broken: null },
      errors: [{ extensions: { code: "workers-protocols/missing" } }],
    });
  });

  it.each(["node-fetch", "lambda"])(
    "runs the same tRPC controller and client through %s",
    async (runtime) => {
      const app = createProtocolFixture(readFileSync("src/schema.graphql", "utf8"));
      const client = createTRPCUntypedClient({
        links: [
          httpLink({
            url: "http://worker/trpc",
            headers: () => headers("tenant-b"),
            fetch: async (url, init) => {
              const request = new Request(String(url), init);
              return runtime === "lambda"
                ? fetchThroughLambdaFixture(app, request)
                : app.fetch(request);
            },
          }),
        ],
      });
      expect(await client.query("probe.read")).toBe("tenant-b:session=tenant-b");
      expect(await client.mutation("probe.write", { name: "Crocodile" })).toBe(
        "tenant-b:Crocodile",
      );
      await expect(client.mutation("probe.write", { name: "x" })).rejects.toMatchObject({
        data: { code: "BAD_REQUEST" },
      });
    },
  );

  it("reports unsupported subscriptions explicitly in workerd", async () => {
    const response = await worker.dispatchFetch("http://worker/unsupported-subscriptions");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "transports-graphql/fetch-subscriptions-unsupported",
    });
  });
  it("preserves GraphQL partial data, Problem errors and distinct Set-Cookie headers", async () => {
    const response = await graphql("{ probe broken }");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-protocol")).toBe("graphql");
    expect(response.headers.getSetCookie()).toEqual([
      "first=one; HttpOnly; Path=/",
      "second=two; HttpOnly; Path=/",
    ]);
    const body = await response.json();
    expect(body).toMatchObject({
      data: { probe: "tenant-a:session=tenant-a", broken: null },
      errors: [
        { path: ["broken"], extensions: { code: "workers-protocols/missing", status: 404 } },
      ],
    });
  });

  it("isolates overlapping GraphQL and tRPC tenant requests", async () => {
    const results = await Promise.all(
      ["tenant-a", "tenant-b"].flatMap((tenant) => [
        graphql("{ probe }", tenant, { "x-overlap": "four-requests" }).then((response) =>
          response.json(),
        ),
        trpc(tenant, true).query("probe.read"),
      ]),
    );
    expect(results).toEqual([
      { data: { probe: "tenant-a:session=tenant-a" } },
      "tenant-a:session=tenant-a",
      { data: { probe: "tenant-b:session=tenant-b" } },
      "tenant-b:session=tenant-b",
    ]);
  });

  it("uses the native tRPC client wire format and validates body input", async () => {
    expect(await trpc().mutation("probe.write", { name: "Crocodile" })).toBe("tenant-a:Crocodile");
    await expect(trpc().mutation("probe.write", { name: "x" })).rejects.toMatchObject({
      data: { code: "BAD_REQUEST" },
    });
    const response = await worker.dispatchFetch("http://worker/trpc/probe.read", {
      headers: headers(),
    });
    expect(response.headers.getSetCookie()).toEqual(["trpc=three; HttpOnly; Path=/"]);
  });

  it("preserves a host-provided aborted request signal into a tRPC procedure", async () => {
    const response = await worker.dispatchFetch("http://worker/aborted-trpc", {
      headers: headers(),
    });
    expect(await response.json()).toMatchObject({ result: { data: true } });
  });

  it("rejects unsupported content types using each protocol response", async () => {
    expect((await graphql("{ probe }", "tenant-a", { "content-type": "text/plain" })).status).toBe(
      415,
    );
    const response = await worker.dispatchFetch("http://worker/trpc/probe.write", {
      method: "POST",
      headers: { ...headers(), "content-type": "text/plain" },
      body: "{}",
    });
    expect(response.status).toBe(415);
  });

  it("does not return tenant data without authentication", async () => {
    const response = await graphql("{ probe }", "invalid");
    expect(await response.json()).toMatchObject({
      data: { probe: null },
      errors: [{ extensions: { code: "protocols-graphql/auth-invalid-token", status: 401 } }],
    });
    await expect(trpc("invalid").query("probe.read")).rejects.toMatchObject({
      data: { code: "UNAUTHORIZED" },
    });
  });
});
