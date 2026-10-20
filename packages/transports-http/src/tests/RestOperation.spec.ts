import { Container } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { ProblemFactory } from "@croco/problems-core";
import {
  buildContractGraph,
  createContractGraphSnapshot,
  createOperation,
  defineOperation,
  extractRouteIR,
} from "@croco/protocols-core";
import { createRestOperationController } from "@croco/protocols-rest";
import type { Interceptor } from "@croco/protocols-rest";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { emitOpenAPIFromContractGraph } from "../../../openapi-spec/src/index";
import { createApp, ErrorHandler, HealthCheckRegistry } from "../index";

type Authority = { tenantId: string; allowed: boolean };
const verified: Authority = { tenantId: "tenant_verified", allowed: true };

function checkout() {
  return createOperation(
    defineOperation({
      id: "checkout.start",
      kind: "command",
      input: z.object({ productId: z.string().min(3) }),
      output: z.object({ productId: z.string(), tenantId: z.string() }),
      authorize(context: Authority) {
        if (!context.allowed) throw ProblemFactory.forbidden("checkout/denied");
      },
      policy(input) {
        if (input.productId === "product_blocked")
          throw ProblemFactory.conflict("checkout/unavailable");
      },
    }),
    (input, context) => ({ ...input, tenantId: context.tenantId, secret: "never-exposed" }),
  );
}

describe("REST operation binding", () => {
  beforeEach(() => {
    Container.reset();
    const logger = {
      info() {},
      warn() {},
      error() {},
      debug() {},
      fatal() {},
      child() {
        return logger;
      },
    };
    Container.set(Logger, logger as unknown as Logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());
  });

  it("runs real REST and direct calls through the same authority, policy and projection", async () => {
    const operation = checkout();
    const Controller = createRestOperationController(operation, {
      method: "POST",
      path: "/checkout/start",
      input: "body",
      successStatus: 201,
      createContext: () => verified,
    });
    const app = createApp({ controllers: [Controller], securityValidation: "off" });
    const response = await app.fetch(
      new Request("http://localhost/checkout/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: "product_27", tenantId: "attacker" }),
      }),
    );
    expect(response.status).toBe(201);
    const expected = { productId: "product_27", tenantId: "tenant_verified" };
    await expect(response.json()).resolves.toEqual(expected);
    await expect(operation.invoke({ productId: "product_27" }, verified)).resolves.toEqual(
      expected,
    );
    const graph = buildContractGraph([Controller], { strictSchemas: true });
    expect(graph.diagnostics.filter((entry) => entry.severity === "error")).toEqual([]);
    const openapi = emitOpenAPIFromContractGraph(graph);
    expect(openapi.paths?.["/checkout/start"]?.post?.responses).toHaveProperty("201");
    expect(openapi.paths?.["/checkout/start"]?.post?.responses).not.toHaveProperty("200");
    expect(createContractGraphSnapshot(graph)).toEqual(
      createContractGraphSnapshot(buildContractGraph([Controller])),
    );
    expect(extractRouteIR(Controller)[0]?.operation).toMatchObject({
      id: "checkout.start",
      kind: "command",
      inputSource: "body",
    });
    expect(extractRouteIR(Controller)[0]?.sourceLocation?.path).toMatch(/RestOperation\.spec\.ts$/);
    expect((await app.fetch(new Request("http://localhost/checkout/start"))).status).toBe(404);
  });

  it("authorizes before malformed JSON, then preserves input, policy and media-type failures", async () => {
    const operation = checkout();
    const allowed = createRestOperationController(operation, {
      method: "POST",
      path: "/allowed",
      input: "body",
      createContext: () => verified,
    });
    const denied = createRestOperationController(operation, {
      method: "POST",
      path: "/denied",
      input: "body",
      createContext: () => ({ ...verified, allowed: false }),
    });
    const app = createApp({ controllers: [allowed, denied], securityValidation: "off" });
    const request = (path: string, body: string, contentType = "application/json") =>
      app.fetch(
        new Request(`http://localhost${path}`, {
          method: "POST",
          headers: { "content-type": contentType },
          body,
        }),
      );
    expect((await request("/denied", "{")).status).toBe(403);
    expect((await request("/allowed", "{")).status).toBe(400);
    expect((await request("/allowed", "{}")).status).toBe(422);
    expect((await request("/allowed", '{"productId":"product_blocked"}')).status).toBe(409);
    expect((await request("/allowed", "{}", "text/plain")).status).toBe(415);
  });

  it("binds path and query domain inputs without repeating schemas", async () => {
    const operation = createOperation(
      defineOperation({
        id: "product.detail",
        kind: "query",
        input: z.object({ id: z.string() }).strict(),
        output: z.number(),
        authorize(_context: Authority) {},
      }),
      ({ id }) => id.length,
    );
    const path = createRestOperationController(operation, {
      method: "GET",
      path: "/product/:id",
      input: "params",
      createContext: () => verified,
    });
    const query = createRestOperationController(operation, {
      method: "GET",
      path: "/product",
      input: "query",
      createContext: () => verified,
    });
    for (const [Controller, url, location] of [
      [path, "/product/{id}", "path"],
      [query, "/product", "query"],
    ] as const) {
      const document = emitOpenAPIFromContractGraph(buildContractGraph([Controller]));
      expect(document.paths?.[url]?.get?.parameters).toEqual([
        expect.objectContaining({ name: "id", in: location, required: true }),
      ]);
    }
    const pathApp = createApp({ controllers: [path], securityValidation: "off" });
    const queryApp = createApp({ controllers: [query], securityValidation: "off" });
    const a = await pathApp.fetch(new Request("http://localhost/product/abc"));
    const b = await queryApp.fetch(new Request("http://localhost/product?id=abc"));
    await expect(a.json()).resolves.toBe(3);
    await expect(b.json()).resolves.toBe(3);
    await expect(operation.invoke({ id: "abc" }, verified)).resolves.toBe(3);
    expect(
      (await queryApp.fetch(new Request("http://localhost/product?id=abc&id=def"))).status,
    ).toBe(422);
    expect(
      (await queryApp.fetch(new Request("http://localhost/product?id=abc&extra=value"))).status,
    ).toBe(422);
  });

  it("normalizes query cardinality only after authorization", async () => {
    const calls: unknown[] = [];
    const operation = createOperation(
      defineOperation({
        id: "product.search",
        kind: "query",
        input: z.object({
          tags: z.array(z.string()),
          value: z.coerce.string(),
          mixed: z.union([z.coerce.string(), z.array(z.string())]),
        }),
        output: z.object({
          tags: z.array(z.string()),
          value: z.string(),
          mixed: z.union([z.string(), z.array(z.string())]),
        }),
        authorize(context: Authority) {
          if (!context.allowed) throw ProblemFactory.forbidden("checkout/denied");
        },
      }),
      (input) => {
        calls.push(input);
        return input;
      },
    );
    const controllers = [true, false].map((allowed) =>
      createRestOperationController(operation, {
        method: "GET",
        path: allowed ? "/search" : "/denied-search",
        input: "query",
        createContext: () => ({ ...verified, allowed }),
      }),
    );
    const app = createApp({ controllers, securityValidation: "off" });
    const response = await app.fetch(
      new Request("http://localhost/search?tags=one&value=a&mixed=x&mixed=y"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tags: ["one"],
      value: "a",
      mixed: ["x", "y"],
    });
    expect(
      (await app.fetch(new Request("http://localhost/search?tags=one&value=a&value=b&mixed=x")))
        .status,
    ).toBe(422);
    expect(
      (
        await app.fetch(
          new Request("http://localhost/denied-search?tags=one&value=a&value=b&mixed=x"),
        )
      ).status,
    ).toBe(403);
    expect(calls).toHaveLength(1);
  });

  it("rejects unsafe exports and missing path bindings before serving requests", () => {
    const operation = checkout();
    const base = {
      method: "POST" as const,
      path: "/checkout/start",
      input: "body" as const,
      createContext: () => verified,
    };
    // @ts-expect-error Invalid JavaScript consumers still fail before serving requests.
    expect(() => createRestOperationController(operation, { ...base, method: "GET" })).toThrow();
    expect(() =>
      createRestOperationController(operation, { ...base, successStatus: 204 }),
    ).toThrow();
    expect(() =>
      createRestOperationController(operation, { ...base, path: "/checkout/:id" }),
    ).toThrow();
    expect(() =>
      createRestOperationController(operation, { ...base, input: "params", path: "/checkout/:id" }),
    ).toThrow();
  });

  it("keeps the existing JSON-safe output gate and final interceptor response validation", async () => {
    const transformed = createOperation(
      defineOperation({
        id: "product.transformed",
        kind: "query",
        input: z.object({ id: z.string() }),
        output: z.number().transform((value) => value + 7),
        authorize(_context: Authority) {},
      }),
      ({ id }) => id.length,
    );
    expect(() =>
      createRestOperationController(transformed, {
        method: "GET",
        path: "/transform",
        input: "query",
        createContext: () => verified,
      }),
    ).toThrow(/contract-schema-json-unsafe/);
    const Controller = createRestOperationController(checkout(), {
      method: "POST",
      path: "/checkout",
      input: "body",
      createContext: () => verified,
    });
    const mutate: Interceptor = {
      async intercept(_context, next) {
        await next.handle();
        return { productId: 7, tenantId: "tenant_verified", secret: "never-exposed" };
      },
    };
    const app = createApp({
      controllers: [Controller],
      securityValidation: "off",
      globalInterceptors: [mutate],
    });
    const response = await app.fetch(
      new Request("http://localhost/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"productId":"product_27"}',
      }),
    );
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("never-exposed");
  });
});
