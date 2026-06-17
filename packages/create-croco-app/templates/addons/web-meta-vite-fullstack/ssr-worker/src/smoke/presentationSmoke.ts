import { createElement } from "react";
import {
  createIsrMiddleware,
  createMetaFetchHandler,
  createServerAction,
  createServerActionHandler,
  defineApiRoute,
  defineRoute,
  RenderServer,
  resetServerActions,
  RouteRegistry,
} from "@croco/meta-vite";
import type { IsrCacheStore, RuntimeContext } from "@croco/meta-vite";

class SmokeResponseCache implements IsrCacheStore {
  private readonly entries = new Map<
    string,
    { readonly response: Response; readonly expiresAt?: number }
  >();

  async getOrSet(
    key: string,
    factory: () => Promise<Response>,
    options?: { readonly ttlMs?: number },
  ): Promise<Response> {
    const cached = this.entries.get(key);
    if (cached && (cached.expiresAt === undefined || cached.expiresAt > Date.now())) {
      return cached.response.clone();
    }

    const response = await factory();
    const expiresAt = options?.ttlMs ? Date.now() + options.ttlMs : undefined;
    this.entries.set(key, { response: response.clone(), ...(expiresAt ? { expiresAt } : {}) });

    return response;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectText(response: Response, expected: string): Promise<void> {
  const text = await response.text();
  assert(text.includes(expected), `Expected response text to include '${expected}', got '${text}'`);
}

async function main(): Promise<void> {
  resetServerActions();

  const registry = new RouteRegistry();
  registry.register(
    defineRoute({
      path: "/",
      mode: "ssr",
      component: ({ request, context }) =>
        createElement(
          "main",
          null,
          `page:${new URL(request.url).pathname}:${context?.platform ?? "none"}`,
        ),
    }),
  );
  registry.register(
    defineRoute({
      path: "/cached",
      mode: "isr",
      revalidate: 60,
      component: () => createElement("main", null, "cached route metadata"),
    }),
  );
  registry.registerApiRoute(
    defineApiRoute({
      path: "/api/ping",
      method: "GET",
      handler: async (_request, context?: RuntimeContext) =>
        Response.json({ ok: true, platform: context?.platform ?? "none" }),
    }),
  );

  createServerAction({
    name: "subscribe",
    handler: async (data) =>
      Response.json({ accepted: (data as { readonly email?: string }).email }),
  });

  const compiledRoutes = registry.compile();
  const isrRoute = compiledRoutes.find((route) => route.path === "/cached");
  assert(isrRoute?.mode === "isr", "Generated ISR route did not compile as mode=isr");
  assert(
    isrRoute.revalidateMs === 60_000,
    "Generated ISR route did not compile revalidate seconds",
  );

  const server = new RenderServer(compiledRoutes);
  let isrRenderCount = 0;
  const isrMiddleware = createIsrMiddleware({
    cache: new SmokeResponseCache(),
    ttlMs: isrRoute.revalidateMs,
    render: async (request) => {
      isrRenderCount += 1;
      return new Response(`isr:${isrRenderCount}:${new URL(request.url).pathname}`, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  });
  const handler = createMetaFetchHandler({
    apiRoutes: [...registry.getApiRoutes(), createServerActionHandler()],
    pageHandler: async (request, context) => {
      if (new URL(request.url).pathname === isrRoute.path) {
        return isrMiddleware(request);
      }

      return server.handle(request, context);
    },
  });

  await expectText(
    await handler(new Request("https://presentation.test/"), { platform: "node" }),
    "page:/:node",
  );

  const apiResponse = await handler(new Request("https://presentation.test/api/ping"), {
    platform: "cloudflare",
  });
  assert(apiResponse.status === 200, `Expected API status 200, got ${apiResponse.status}`);
  assert(
    JSON.stringify(await apiResponse.json()) ===
      JSON.stringify({ ok: true, platform: "cloudflare" }),
    "Generated API route returned an unexpected payload",
  );

  const formData = new FormData();
  formData.append("email", "demo@example.test");
  const actionResponse = await handler(
    new Request("https://presentation.test/api/action/subscribe", {
      method: "POST",
      body: formData,
    }),
    { platform: "lambda" },
  );
  assert(actionResponse.status === 200, `Expected action status 200, got ${actionResponse.status}`);
  assert(
    JSON.stringify(await actionResponse.json()) ===
      JSON.stringify({ accepted: "demo@example.test" }),
    "Generated server action returned an unexpected payload",
  );

  await expectText(await handler(new Request("https://presentation.test/cached")), "isr:1:/cached");
  await expectText(await handler(new Request("https://presentation.test/cached")), "isr:1:/cached");
  assert(isrRenderCount === 1, `Expected ISR cache hit after first render, got ${isrRenderCount}`);

  console.log("meta-vite presentation smoke passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
