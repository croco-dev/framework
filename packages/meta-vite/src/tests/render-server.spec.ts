import { inspect } from "node:util";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLambdaHandler } from "../libs/providers/lambda";
import { createNodeHandler } from "../libs/providers/node";
import { createMetaFetchHandler } from "../libs/render/composeHandler";
import { RenderServer } from "../libs/render/renderServer";
import type { CrocoApiHandlerResult } from "../libs/render/types";
import { defineRoute } from "../libs/routes/defineRoute";
import { RouteRegistry } from "../libs/routes/routeRegistry";
import type { RenderRouteComponentProps, RenderRouteIR } from "../libs/routes/types";

const writeConsoleError = console.error.bind(console);

const INTERNAL_SERVER_ERROR_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Internal Server Error</title>
    <meta name="description" content="An unexpected error occurred">
  </head>
  <body>
    <div id="root"><h1>Internal Server Error</h1></div>
  </body>
</html>`;

function createRoute(
  path: string,
  component: React.ComponentType<RenderRouteComponentProps>,
): RenderRouteIR {
  return {
    path,
    mode: "ssr",
    componentLoader: async () => ({ default: component }),
  };
}

function createGate<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function runApiFirst(
  result: CrocoApiHandlerResult,
  server: RenderServer,
  request: Request,
): Promise<Response> {
  if (result.handled) {
    return result.response;
  }

  return server.handle(request);
}

describe("RenderServer", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["omitted", "empty"] as const)(
    "uses the remaining deadline for an SSR loader with %s regions",
    async (regions) => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] });
      const shell = createGate<{ kind: "render" }>();
      const module = createGate<Awaited<ReturnType<RenderRouteIR["componentLoader"]>>>();
      const render = vi.fn(() => createElement("main", null, "Late private content"));
      const componentLoader = vi.fn(() => module.promise);
      const server = new RenderServer([
        {
          path: "/deadline",
          mode: "ssr",
          ...(regions === "empty" ? { regions: [] } : {}),
          resolveShell: () => shell.promise,
          componentLoader,
          stream: { deadlineMs: 100 },
        },
      ]);

      try {
        const response = server.handle(new Request("https://example.com/deadline"));
        const settled = vi.fn();
        void response.then(settled);
        await vi.advanceTimersByTimeAsync(70);
        shell.resolve({ kind: "render" });
        await vi.advanceTimersByTimeAsync(0);
        expect(componentLoader).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(29);
        expect(settled).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(settled).toHaveBeenCalledOnce();
        expect((await response).status).toBe(503);
      } finally {
        module.resolve({ default: render });
        await vi.advanceTimersByTimeAsync(0);
        vi.useRealTimers();
      }
      expect(render).not.toHaveBeenCalled();
    },
  );

  it.each(["omitted", "empty"] as const)(
    "does not start the shell or component loader for a cancelled request with %s regions",
    async (regions) => {
      const componentLoader = vi.fn(async () => ({
        default: () => createElement("main", null, "Must not render"),
      }));
      const resolveShell = vi.fn(async () => ({ kind: "render" as const }));
      const server = new RenderServer([
        {
          path: "/aborted",
          mode: "ssr",
          ...(regions === "empty" ? { regions: [], resolveShell } : {}),
          componentLoader,
        },
      ]);
      const request = new Request("https://example.com/aborted", {
        signal: AbortSignal.abort(new Error("disconnected")),
      });

      expect((await server.handle(request)).status).toBe(503);
      expect(resolveShell).not.toHaveBeenCalled();
      expect(componentLoader).not.toHaveBeenCalled();
    },
  );

  it("ends a pending component load on request abort and ignores its late failure", async () => {
    const controller = new AbortController();
    const module = createGate<Awaited<ReturnType<RenderRouteIR["componentLoader"]>>>();
    const server = new RenderServer([
      { path: "/cancel", mode: "ssr", componentLoader: () => module.promise },
    ]);
    const response = server.handle(
      new Request("https://example.com/cancel", { signal: controller.signal }),
      { platform: "node" },
    );
    const settled = vi.fn();
    void response.then(settled);
    await new Promise<void>((resolve) => setImmediate(resolve));
    controller.abort(new Error("socket closed"));
    try {
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(settled).toHaveBeenCalledOnce();
      expect((await response).status).toBe(503);
    } finally {
      module.reject(new Error("late component failure"));
      await response;
    }
    expect(console.error).not.toHaveBeenCalled();
  });

  it.each(["shell", "loader", "head", "deferred-loader"] as const)(
    "returns 503 when the %s phase fails after the deadline but before the timer fires",
    async (phase) => {
      let time = 0;
      vi.spyOn(performance, "now").mockImplementation(() => time);
      const failAfterDeadline = () => {
        time = 101;
        throw new Error("private failure after the render deadline");
      };
      const onSettle = vi.fn();
      const server = new RenderServer([
        {
          path: "/expired-error",
          mode: "ssr",
          resolveShell: async () => (phase === "shell" ? failAfterDeadline() : { kind: "render" }),
          componentLoader: async () =>
            phase === "loader" || phase === "deferred-loader"
              ? failAfterDeadline()
              : { default: () => createElement("main", null, "Must not commit") },
          head: () => (phase === "head" ? failAfterDeadline() : { title: "Product" }),
          ...(phase === "deferred-loader"
            ? { regions: [{ id: "details", loader: async () => "Region" }] }
            : {}),
          stream: { deadlineMs: 100, onSettle },
        },
      ]);

      const response = await server.handle(new Request("https://example.com/expired-error"));
      expect(response.status).toBe(503);
      const html = await response.text();
      expect(html).not.toContain("Must not commit");
      expect(console.error).not.toHaveBeenCalled();
      if (phase === "deferred-loader") {
        expect(onSettle).toHaveBeenCalledExactlyOnceWith(
          expect.objectContaining({
            timedOut: true,
            abortReason: "deadline",
            shellCommitted: false,
          }),
        );
      }
    },
  );

  it.each(["cancellation", "deadline"] as const)(
    "honors %s at the final buffered response handoff",
    async (termination) => {
      const controller = new AbortController();
      let time = 0;
      vi.spyOn(performance, "now").mockImplementation(() => time);
      const server = new RenderServer([
        {
          ...createRoute("/handoff", () => createElement("main", null, "Must not commit")),
          head: () => {
            queueMicrotask(() => {
              if (termination === "cancellation") controller.abort();
              else time = 101;
            });
            return { title: "Product" };
          },
          stream: { deadlineMs: 100 },
        },
      ]);
      const request = new Request("https://example.com/handoff", { signal: controller.signal });
      const response = await server.handle(request);
      expect(response.status).toBe(503);
      await expect(response.text()).resolves.not.toContain("Must not commit");
    },
  );

  it.each(["cancellation", "deadline"] as const)(
    "honors %s before committing a terminal shell redirect",
    async (termination) => {
      const controller = new AbortController();
      let time = 0;
      vi.spyOn(performance, "now").mockImplementation(() => time);
      const server = new RenderServer([
        {
          ...createRoute("/shell-handoff", () => createElement("main", null, "Must not render")),
          resolveShell: async () => ({
            kind: "redirect",
            get location() {
              if (termination === "cancellation") controller.abort();
              else time = 101;
              return "/another-page";
            },
          }),
          stream: { deadlineMs: 100 },
        },
      ]);
      const response = await server.handle(
        new Request("https://example.com/shell-handoff", { signal: controller.signal }),
      );
      expect(response.status).toBe(503);
      expect(response.headers.has("location")).toBe(false);
    },
  );

  it("keeps a long Node SSR deadline open across the maximum timer interval", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    const maxTimerMs = 2 ** 31 - 1;
    const module = createGate<Awaited<ReturnType<RenderRouteIR["componentLoader"]>>>();
    const server = new RenderServer([
      {
        path: "/long-deadline",
        mode: "ssr",
        componentLoader: () => module.promise,
        stream: { deadlineMs: maxTimerMs + 10 },
      },
    ]);
    try {
      const result = server.handle(new Request("https://example.com/long-deadline"), {
        platform: "node",
      });
      const settled = vi.fn();
      void result.then(settled);
      await vi.advanceTimersByTimeAsync(maxTimerMs + 9);
      expect(settled).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toHaveBeenCalledOnce();
      expect((await result).status).toBe(503);
    } finally {
      module.resolve({ default: () => createElement("main", null, "Late product") });
      await vi.advanceTimersByTimeAsync(0);
      vi.useRealTimers();
    }
  });

  it("does not let a timer callback expire SSR before the elapsed deadline", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let time = 0;
    vi.spyOn(performance, "now").mockImplementation(() => time);
    const module = createGate<Awaited<ReturnType<RenderRouteIR["componentLoader"]>>>();
    const server = new RenderServer([
      {
        path: "/timer",
        mode: "ssr",
        componentLoader: () => module.promise,
        stream: { deadlineMs: 10 },
      },
    ]);
    try {
      const result = server.handle(new Request("https://example.com/timer"), { platform: "node" });
      const settled = vi.fn();
      void result.then(settled);
      await vi.advanceTimersByTimeAsync(0);
      time = 9.5;
      await vi.advanceTimersByTimeAsync(10);
      expect(settled).not.toHaveBeenCalled();
      time = 10;
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toHaveBeenCalledOnce();
      expect((await result).status).toBe(503);
    } finally {
      module.resolve({ default: () => createElement("main", null, "Late page") });
      await vi.advanceTimersByTimeAsync(0);
      vi.useRealTimers();
    }
  });

  it("enforces the Lambda byte limit on the full UTF-8 HTML at the adapter boundary", async () => {
    const component = () => createElement("main", null, "漢".repeat(300));
    const nodeRequest = new Request("https://example.com/product");
    const lambdaEvent = { version: "2.0", rawPath: "/product" };
    const createHandler = (maxBufferedBytes?: number) =>
      createMetaFetchHandler({
        pageHandler: new RenderServer([
          {
            ...createRoute("/product", component),
            head: () => ({ title: "Product page" }),
            stream: maxBufferedBytes === undefined ? {} : { maxBufferedBytes },
          },
        ]),
      });
    const rendered = await createNodeHandler(createHandler()).fetch(nodeRequest);
    const html = await rendered.text();
    const responseBytes = Buffer.byteLength(html, "utf8");
    expect(html).toContain("<title>Product page</title>");
    expect(html).toContain("<main>漢");
    expect(html.length).toBeLessThan(responseBytes - 1);

    const atLimit = await createLambdaHandler(createHandler(responseBytes))(lambdaEvent, {});
    expect(atLimit.statusCode).toBe(200);
    expect(atLimit.body).toBe(html);

    const overLimit = createHandler(responseBytes - 1);
    const rejected = await createLambdaHandler(overLimit)(lambdaEvent, {});
    expect(rejected.statusCode).toBe(500);
    expect(rejected.body).toBe(INTERNAL_SERVER_ERROR_HTML);
    expect(console.error).toHaveBeenCalledWith(
      "SSR rendering failed",
      expect.objectContaining({
        error: expect.objectContaining({ code: "meta-vite/shell-stream-max-buffered-bytes" }),
      }),
    );
    const uncapped = await createNodeHandler(overLimit).fetch(nodeRequest);
    expect(uncapped.status).toBe(200);
    await expect(uncapped.text()).resolves.toBe(html);
  });

  it.each(["loader", "component", "head"] as const)(
    "logs the original %s failure and route while preserving the exact safe 500 HTML",
    async (stage) => {
      const error = new Error("private render detail");
      const route: RenderRouteIR = {
        path: "/broken",
        mode: "ssr",
        componentLoader: async () => {
          if (stage === "loader") throw error;
          return {
            default: () => {
              if (stage === "component") throw error;
              return createElement("main", null, "Partial private content");
            },
          };
        },
        head: () => {
          if (stage === "head") throw error;
          return { title: "Private page title" };
        },
      };
      const server = new RenderServer([route]);

      const response = await server.handle(new Request("https://example.com/broken?secret=hidden"));

      expect(console.error).toHaveBeenCalledExactlyOnceWith("SSR rendering failed", {
        route: "/broken",
        error,
      });
      expect(vi.mocked(console.error).mock.calls[0]?.[1].error).toBe(error);
      expect(response.status).toBe(500);
      expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
      await expect(response.text()).resolves.toBe(INTERNAL_SERVER_ERROR_HTML);
    },
  );

  it("logs a non-Error rejection without exposing it in the response", async () => {
    const error = { detail: "private rejection" };
    const server = new RenderServer([
      {
        path: "/rejected",
        mode: "ssr",
        componentLoader: async () => {
          throw error;
        },
      },
    ]);

    const response = await server.handle(new Request("https://example.com/rejected"));

    expect(console.error).toHaveBeenCalledExactlyOnceWith("SSR rendering failed", {
      route: "/rejected",
      error,
    });
    expect(vi.mocked(console.error).mock.calls[0]?.[1].error).toBe(error);
    expect(response.status).toBe(500);
    const html = await response.text();
    expect(html).toContain("<h1>Internal Server Error</h1>");
    expect(html).not.toContain("private rejection");
  });

  it.each(["inspector", "primary sink", "both sinks"] as const)(
    "preserves the exact safe 500 HTML when the %s fails while logging",
    async (failure) => {
      const inspectError = vi.fn(() => {
        throw new Error("private inspection detail");
      });
      const error = { detail: "private rejection", [inspect.custom]: inspectError };
      const server = new RenderServer([
        {
          path: "/logging-failure",
          mode: "ssr",
          componentLoader: async () => {
            throw error;
          },
        },
      ]);
      vi.mocked(console.error).mockImplementation(
        failure === "inspector"
          ? writeConsoleError
          : () => {
              throw new Error("private primary sink detail");
            },
      );
      if (failure === "both sinks") {
        vi.mocked(console.warn).mockImplementation(() => {
          throw new Error("private secondary sink detail");
        });
      }

      const response = await server.handle(new Request("https://example.com/logging-failure"));

      expect(inspectError).toHaveBeenCalledTimes(failure === "inspector" ? 1 : 0);
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(vi.mocked(console.error).mock.calls[0]?.[0]).toBe("SSR rendering failed");
      expect(vi.mocked(console.error).mock.calls[0]?.[1].route).toBe("/logging-failure");
      expect(vi.mocked(console.error).mock.calls[0]?.[1].error).toBe(error);
      expect(console.warn).toHaveBeenCalledExactlyOnceWith(
        "SSR rendering failed; error logging failed",
        "/logging-failure",
      );
      expect(response.status).toBe(500);
      expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
      await expect(response.text()).resolves.toBe(INTERNAL_SERVER_ERROR_HTML);
    },
  );

  it("does not log SSR failures for successful, unmatched, or RSC requests", async () => {
    const server = new RenderServer(
      [
        createRoute("/ok", () => createElement("main", null, "OK")),
        {
          path: "/rsc-failure",
          mode: "rsc",
          componentLoader: async () => {
            throw new Error("RSC failure");
          },
        },
      ],
      {
        encodeFlight: async () => {
          throw new Error("RSC failure");
        },
      },
    );

    expect((await server.handle(new Request("https://example.com/ok"))).status).toBe(200);
    expect((await server.handle(new Request("https://example.com/missing"))).status).toBe(404);
    const rscResponse = await server.handle(new Request("https://example.com/rsc-failure"));
    expect(rscResponse.status).toBe(500);
    expect(rscResponse.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns 501 without an encoder when the route has no componentRef", async () => {
    const server = new RenderServer([
      {
        path: "/rsc-no-ref",
        mode: "rsc",
        componentLoader: async () => ({ default: () => createElement("main", null, "x") }),
      },
    ]);

    const response = await server.handle(new Request("https://example.com/rsc-no-ref"));
    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({
      error: "RSC request not supported",
      code: "meta-vite/rsc-flight-not-acceptable",
    });
  });

  it("returns rendered HTML for a matched route", async () => {
    const server = new RenderServer([
      createRoute("/hello", () => createElement("main", null, "Hello from SSR")),
    ]);

    const response = await server.handle(new Request("https://example.com/hello"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    await expect(response.text()).resolves.toContain("Hello from SSR");
  });

  it("returns static 404 HTML for an unmatched route", async () => {
    const server = new RenderServer([
      createRoute("/hello", () => createElement("main", null, "Hello")),
    ]);

    const response = await server.handle(new Request("https://example.com/missing"));

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("Not Found");
  });

  it("returns static 500 HTML when component rendering fails", async () => {
    const server = new RenderServer([
      createRoute("/broken", () => {
        throw new Error("render failed");
      }),
    ]);

    const response = await server.handle(new Request("https://example.com/broken"));

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toContain("Internal Server Error");
  });

  it("returns the API response when the API handler claims the request", async () => {
    const server = new RenderServer([
      createRoute("/api/users", () => createElement("main", null, "Page fallback")),
    ]);
    const apiResult: CrocoApiHandlerResult = {
      handled: true,
      response: new Response("API response", { status: 404 }),
    };

    const response = await runApiFirst(
      apiResult,
      server,
      new Request("https://example.com/api/users"),
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("API response");
  });

  it("falls back to page rendering when the API handler declines the request", async () => {
    const server = new RenderServer([
      createRoute("/page", () => createElement("main", null, "Page response")),
    ]);
    const apiResult: CrocoApiHandlerResult = { handled: false };

    const response = await runApiFirst(apiResult, server, new Request("https://example.com/page"));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("Page response");
  });

  it("injects route head() title into the HTML shell", async () => {
    const server = new RenderServer([
      {
        path: "/with-head",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, "Head test page"),
        }),
        head: () => ({ title: "Custom Page Title", description: "Custom description text" }),
      },
    ]);

    const response = await server.handle(new Request("https://example.com/with-head"));

    const text = await response.text();
    expect(text).toContain("<title>Custom Page Title</title>");
    expect(text).toContain('<meta name="description" content="Custom description text">');
    expect(text).toContain("<!DOCTYPE html>");
    expect(text).toContain('<div id="root">');
  });

  it("injects route head() canonical link when present", async () => {
    const server = new RenderServer([
      {
        path: "/canonical",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => createElement("main", null, "Canonical test"),
        }),
        head: () => ({ canonical: "https://example.com/og-page" }),
      },
    ]);

    const response = await server.handle(new Request("https://example.com/canonical"));

    const text = await response.text();
    expect(text).toContain('<link rel="canonical" href="https://example.com/og-page">');
  });

  it("escapes HTML in head title and description", async () => {
    const server = new RenderServer([
      {
        path: "/xss",
        mode: "ssr",
        componentLoader: async () => ({ default: () => createElement("main", null, "XSS test") }),
        head: () => ({
          title: '<script>alert("xss")</script>',
          description: 'Description with "quotes" & stuff',
        }),
      },
    ]);

    const response = await server.handle(new Request("https://example.com/xss"));

    const text = await response.text();
    expect(text).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(text).toContain("Description with &quot;quotes&quot; &amp; stuff");
    expect(text).not.toContain("<script>alert");
  });

  it("returns static 404 HTML with safe fallback head title", async () => {
    const server = new RenderServer([]);

    const response = await server.handle(new Request("https://example.com/anything"));

    const text = await response.text();
    expect(response.status).toBe(404);
    expect(text).toContain("<title>Not Found</title>");
    expect(text).toContain('<meta name="description" content="The requested page was not found">');
    expect(text).toContain("<h1>Not Found</h1>");
  });

  it("returns static 500 HTML with safe fallback head title", async () => {
    const server = new RenderServer([
      {
        path: "/crash",
        mode: "ssr",
        componentLoader: async () => ({
          default: () => {
            throw new Error("boom");
          },
        }),
      },
    ]);

    const response = await server.handle(new Request("https://example.com/crash"));

    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).toContain("<title>Internal Server Error</title>");
    expect(text).toContain('<meta name="description" content="An unexpected error occurred">');
    expect(text).toContain("<h1>Internal Server Error</h1>");
  });

  it('uses "Croco App" as default title when route has no head()', async () => {
    const server = new RenderServer([
      createRoute("/no-head", () => createElement("main", null, "No head")),
    ]);

    const response = await server.handle(new Request("https://example.com/no-head"));

    const text = await response.text();
    expect(text).toContain("<title>Croco App</title>");
  });

  it("passes RuntimeContext platform through to the component", async () => {
    const RuntimeAwareComponent = ({ context }: RenderRouteComponentProps) => {
      return createElement("main", null, `Platform: ${context?.platform ?? "missing"}`);
    };
    const server = new RenderServer([createRoute("/runtime", RuntimeAwareComponent)]);

    const response = await server.handle(new Request("https://example.com/runtime"), {
      platform: "cloudflare",
    });

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain("Platform: cloudflare");
  });

  it("renders a compiled RouteRegistry SSR route with head metadata", async () => {
    const registry = new RouteRegistry();
    registry.register(
      defineRoute({
        path: "/registry-page",
        component: ({ request }) =>
          createElement("main", null, `Registry SSR: ${new URL(request.url).pathname}`),
        mode: "ssr",
        head: () => ({ title: "Registry Page", description: "Compiled route metadata" }),
      }),
    );
    const server = new RenderServer(registry.compile());

    const response = await server.handle(new Request("https://example.com/registry-page"));

    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain("Registry SSR: /registry-page");
    expect(text).toContain("<title>Registry Page</title>");
    expect(text).toContain('<meta name="description" content="Compiled route metadata">');
  });

  it("returns safe 500 HTML for a compiled RouteRegistry render failure", async () => {
    const registry = new RouteRegistry();
    registry.register(
      defineRoute({
        path: "/registry-error",
        component: () => {
          throw new Error("registry render failed");
        },
      }),
    );
    const server = new RenderServer(registry.compile());

    const response = await server.handle(new Request("https://example.com/registry-error"));

    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).toContain("<title>Internal Server Error</title>");
    expect(text).toContain('<meta name="description" content="An unexpected error occurred">');
    expect(text).toContain("<h1>Internal Server Error</h1>");
    expect(text).not.toContain("registry render failed");
  });

  it("returns safe 404 HTML when compiled RouteRegistry routes do not match", async () => {
    const registry = new RouteRegistry();
    registry.register(
      defineRoute({
        path: "/registered",
        component: () => createElement("main", null, "Registered"),
      }),
    );
    const server = new RenderServer(registry.compile());

    const response = await server.handle(new Request("https://example.com/unregistered"));

    const text = await response.text();
    expect(response.status).toBe(404);
    expect(text).toContain("<title>Not Found</title>");
    expect(text).toContain('<meta name="description" content="The requested page was not found">');
    expect(text).toContain("<h1>Not Found</h1>");
    expect(text).not.toContain("Registered");
  });
});
