import { Window } from "happy-dom";
import { act, createElement } from "react";
import type { ReactElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";

import { PageDataProvider, usePageData, usePageMeta } from "@croco/frontend-react";
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

function readRuntimeEnvValue(context: RuntimeContext | undefined, key: string): string {
  if (!context?.env || typeof context.env !== "object" || !(key in context.env)) {
    return "none";
  }

  return String((context.env as Record<string, unknown>)[key]);
}

function SmokePage(): ReactElement {
  const data = usePageData<{
    readonly envValue: string;
    readonly message: string;
    readonly platform: string;
  }>();
  const meta = usePageMeta();

  return createElement(
    "main",
    { "data-croco-page-title": meta.title },
    `page-data:${data.message}:${data.platform}:${data.envValue}:${meta.urlOriginal ?? "none"}`,
  );
}

type HydrationPageData = {
  readonly message: string;
  readonly count: number;
};

function HydratedPage() {
  const data = usePageData<HydrationPageData>();
  const meta = usePageMeta();

  if (!data) {
    throw new Error("Generated page data was not available during hydration");
  }

  return createElement(
    "main",
    { "data-croco-hydrated": "true" },
    createElement("h1", null, meta.title ?? "missing-title"),
    createElement("p", { id: "page-data" }, `${data.message}:${data.count}:${meta.urlOriginal}`),
  );
}

function createHydrationElement(pageData: HydrationPageData) {
  return createElement(
    PageDataProvider,
    {
      value: {
        data: pageData,
        description: "Generated browser hydration smoke",
        title: "Generated Meta Vite page",
        urlOriginal: "/hydration-smoke",
      },
    },
    createElement(HydratedPage),
  );
}

function installBrowserGlobals(window: Window): void {
  const globals = globalThis as Record<string, unknown>;

  globals.window = window;
  globals.document = window.document;
  globals.HTMLElement = window.HTMLElement;
  globals.Node = window.Node;
  globals.Text = window.Text;
  globals.Event = window.Event;
  globals.requestAnimationFrame = window.requestAnimationFrame.bind(window);
  globals.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  globals.IS_REACT_ACT_ENVIRONMENT = true;

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: window.navigator,
  });
}

function createHydrationRoot(serverHtml: string): HTMLElement {
  const window = new Window({ url: "https://presentation.test/hydration-smoke" });
  installBrowserGlobals(window);
  window.document.body.innerHTML = `<div id="root">${serverHtml}</div>`;

  const rootElement = window.document.getElementById("root");
  assert(rootElement, "Hydration smoke root was not created");

  return rootElement;
}

async function assertBrowserHydrationSmoke(): Promise<void> {
  const pageData = { count: 7, message: "Hello from generated page data" };
  const app = createHydrationElement(pageData);
  const serverHtml = renderToString(app);
  const rootElement = createHydrationRoot(serverHtml);
  const hydrationErrors: unknown[] = [];

  await act(async () => {
    hydrateRoot(rootElement, app, {
      onRecoverableError(error) {
        hydrationErrors.push(error);
      },
    });
  });

  const hydratedText = rootElement.querySelector("#page-data")?.textContent;
  assert(
    hydratedText === "Hello from generated page data:7:/hydration-smoke",
    "Page data did not survive hydration",
  );
  assert(
    hydrationErrors.length === 0,
    `Hydration reported recoverable errors: ${hydrationErrors.join(", ")}`,
  );
}

async function assertHydrationMismatchIsVisible(): Promise<void> {
  const pageData = { count: 7, message: "Hello from generated page data" };
  const staleServerHtml = renderToString(
    createHydrationElement({ ...pageData, message: "stale server data" }),
  );
  const rootElement = createHydrationRoot(staleServerHtml);
  const hydrationErrors: unknown[] = [];

  await act(async () => {
    hydrateRoot(rootElement, createHydrationElement(pageData), {
      onRecoverableError(error) {
        hydrationErrors.push(error);
      },
    });
  });

  assert(
    hydrationErrors.length > 0,
    "Hydration mismatch did not surface through onRecoverableError and could look successful",
  );
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
          PageDataProvider,
          {
            value: {
              data: {
                envValue: readRuntimeEnvValue(context, "SMOKE_FLAG"),
                message: "hydrated",
                platform: context?.platform ?? "none",
              },
              title: "Presentation Smoke",
              urlOriginal: new URL(request.url).pathname,
            },
          },
          createElement(SmokePage),
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

  const pageResponse = await handler(new Request("https://presentation.test/"), {
    env: { SMOKE_FLAG: "node-env" },
    platform: "node",
  });
  const pageHtml = await pageResponse.text();
  assert(pageHtml.includes('id="root"'), "Generated page response is missing hydration root");
  assert(
    pageHtml.includes('data-croco-page-title="Presentation Smoke"'),
    "Generated page response is missing PageDataProvider meta flow",
  );
  assert(
    pageHtml.includes("page-data:hydrated:node:node-env:/"),
    `Generated page data flow did not render through usePageData, got '${pageHtml}'`,
  );

  await expectText(
    await handler(new Request("https://presentation.test/"), { platform: "node" }),
    "page-data:hydrated:node:none:/",
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

  await assertBrowserHydrationSmoke();
  await assertHydrationMismatchIsVisible();

  console.log("meta-vite presentation smoke passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
