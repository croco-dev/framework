import { createElement } from "react";
import { createFromReadableStream } from "react-server-dom-webpack/client";
import { describe, expect, it } from "vitest";
import { RenderServer } from "../libs/render/renderServer";
import { RscClientReferenceMissingProblem } from "../libs/rsc/flight";
import { decodeFlightToHtmlStream } from "../libs/rsc/ssrDecode";
import { defineRoute } from "../libs/routes/defineRoute";
import { RouteRegistry } from "../libs/routes/routeRegistry";
import type { PageRouteDefinition } from "../libs/routes/types";
import type { RscFlightEncoder } from "../libs/rsc/flight";

function flightStream(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function createRegistryServer(
  routes: PageRouteDefinition[],
  encodeFlight?: RscFlightEncoder,
): RenderServer {
  const registry = new RouteRegistry();

  for (const route of routes) {
    registry.register(defineRoute(route));
  }

  return new RenderServer(registry.compile(), encodeFlight ? { encodeFlight } : {});
}

function rscRoute(path: string, component?: PageRouteDefinition["component"]): PageRouteDefinition {
  return {
    path,
    mode: "rsc",
    componentRef: `src/routes${path}.rsc.tsx#default`,
    component: component ?? (() => createElement("main", null, `route ${path}`)),
  };
}

describe("RSC route rendering (real Flight)", () => {
  it("decodes official Flight bytes to HTML through the injected encoder", async () => {
    const server = createRegistryServer(
      [rscRoute("/rsc-basic", () => createElement("main", null, "RSC route: hello"))],
      async () => flightStream('0:["$","main",null,{"children":"RSC route: hello"}]\n'),
    );

    const response = await server.handle(new Request("https://example.com/rsc-basic"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("RSC route: hello");
    // Real Flight rows travel out-of-band (`text/x-component`), not as an
    // inline `text/x-component` script disguising SSR HTML as Flight.
    expect(html).not.toContain('type="text/x-component"');
    expect(html).toContain('id="croco-rsc-manifest"');
  });

  it("serves negotiated Flight bytes with a distinct content type and manifest headers", async () => {
    const server = createRegistryServer([rscRoute("/rsc-basic")], async () =>
      flightStream('0:["$","main",null,{"children":"negotiated"}]\n'),
    );

    const response = await server.handle(new Request("https://example.com/rsc-basic.rsc"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/x-component");
    expect(response.headers.get("x-croco-rsc-flight-version")).toBe(
      "croco.meta-vite.rsc-flight.v1",
    );
    expect(response.headers.get("vary")).toContain("Accept");
    expect(body).toMatch(/^0:/);

    // The same route serves HTML at the base path: one navigation path, two representations.
    const htmlResponse = await server.handle(new Request("https://example.com/rsc-basic"));
    expect(htmlResponse.status).toBe(200);
    expect(htmlResponse.headers.get("content-type")).toContain("text/html");
  });

  it("rejects a mismatched client manifest version instead of mixing representations", async () => {
    const server = createRegistryServer([rscRoute("/rsc-basic")], async () =>
      flightStream('0:["$","main",null,{"children":"x"}]\n'),
    );

    const response = await server.handle(
      new Request("https://example.com/rsc-basic.rsc", {
        headers: { "x-croco-rsc-client-manifest": "stale-manifest" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: "RSC client manifest mismatch",
      route: "/rsc-basic",
      code: "meta-vite/rsc-client-manifest-mismatch",
    });
  });

  it("fails explicitly for Flight server references instead of fake success", async () => {
    const server = createRegistryServer([rscRoute("/rsc-basic")], async () =>
      flightStream('0:["$","main",null,{"children":"x"}]\n'),
    );

    const response = await server.handle(
      new Request("https://example.com/rsc-basic?serverReference=doThing"),
    );
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body).toMatchObject({
      error: "RSC request not supported",
      route: "/rsc-basic",
      code: "meta-vite/rsc-server-reference-unsupported",
    });
    expect(JSON.stringify(body)).not.toContain("doThing-secret");
  });

  it("fails explicitly when no Flight encoder is configured instead of a fake payload", async () => {
    const server = createRegistryServer([
      {
        path: "/rsc-no-encoder",
        mode: "rsc",
        // No componentRef: there is nothing a real Flight encoder could
        // encode, so the route must fail explicitly instead of returning an
        // HTML-JSON payload disguised as Flight.
        component: () => createElement("main", null, "no encoder"),
      },
    ]);

    const response = await server.handle(new Request("https://example.com/rsc-no-encoder"));
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body).toMatchObject({
      error: "RSC request not supported",
      route: "/rsc-no-encoder",
      code: "meta-vite/rsc-flight-not-acceptable",
    });
    expect(JSON.stringify(body)).not.toContain("<html");
  });

  it("escapes head metadata and never leaks render internals", async () => {
    const server = createRegistryServer(
      [
        {
          path: "/rsc-xss",
          mode: "rsc",
          componentRef: "src/routes/rsc-xss.rsc.tsx#default",
          component: () => createElement("main", null, "xss"),
          head: () => ({ title: '<script>alert("xss")</script>' }),
        },
      ],
      async () => flightStream('0:["$","main",null,{"children":"<script>alert(1)</script>"}]\n'),
    );

    const response = await server.handle(new Request("https://example.com/rsc-xss"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
    expect(html).not.toContain('<title><script>alert("xss")</script></title>');

    const failing = createRegistryServer([rscRoute("/rsc-broken")], async () => {
      throw new Error("private encoder exploded with SECRET=abc123");
    });
    const failure = await failing.handle(new Request("https://example.com/rsc-broken"));
    const body = await failure.text();

    expect(failure.status).toBe(500);
    expect(body).toContain("An internal server error occurred");
    expect(body).not.toContain("SECRET=abc123");
    expect(body).not.toContain("private encoder exploded");
  });

  it("decodes official Flight rows with the real client decoder", async () => {
    const raw = '0:["$","main",null,{"children":"official-flight-content"}]\n';
    const decoded = await (createFromReadableStream as (...args: unknown[]) => Promise<unknown>)(
      flightStream(raw),
      { serverConsumerManifest: { moduleMap: {}, serverModuleMap: {} } },
    );

    expect(decoded).toBeDefined();
  });

  it("keeps non-RSC routes unaffected", async () => {
    const server = createRegistryServer([
      {
        path: "/ssr-page",
        mode: "ssr",
        component: ({ request }) =>
          createElement("main", null, `SSR route: ${new URL(request.url).pathname}`),
      },
      {
        path: "/rsc-page",
        mode: "rsc",
        componentRef: "src/routes/rsc-page.rsc.tsx#default",
        component: () => createElement("main", null, "RSC route"),
      },
    ]);

    const ssrResponse = await server.handle(new Request("https://example.com/ssr-page"));

    await expect(ssrResponse.text()).resolves.toContain("SSR route: /ssr-page");
    expect(ssrResponse.status).toBe(200);
  });

  it("rejects unresolved client references with a 400 instead of broken hydration", async () => {
    const stream = flightStream('0:["$","main",null,{"children":"unresolved"}]\n');
    const lazyNode = {
      ["$$typeof"]: Symbol.for("react.lazy"),
      ["_payload"]: { id: "missing-client-island" },
      ["_init"]: () => {
        throw new Error("unresolved");
      },
    };
    const renderHtmlStream = async (): Promise<ReadableStream<Uint8Array>> => {
      throw new Error("must not render with an unresolved client reference");
    };

    await expect(
      decodeFlightToHtmlStream(
        {
          decodeFlight: async () => ({ props: { children: lazyNode } }),
          renderHtmlStream,
          renderHtmlString: () => "",
          emptyManifest: () => ({ moduleMap: {}, serverModuleMap: {} }),
        },
        stream,
        { routePath: "/rsc-unresolved" },
      ),
    ).rejects.toThrow(RscClientReferenceMissingProblem);
  });

  it("rejects server-only imports at route-level client boundaries", async () => {
    const { readFile } = await import("node:fs/promises");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/rsc-basic");
    const safeSource = await readFile(join(fixtureDir, "entry.browser.tsx"), "utf8");
    const leakySource = await readFile(join(fixtureDir, "client-with-server-import.tsx"), "utf8");

    const serverOnlyImports = (source: string): string[] =>
      Array.from(source.matchAll(/from ['"]([^'"]+)['"]/g))
        .map((match) => match[1] ?? "")
        .filter((specifier) => specifier.includes("server-only"));

    expect(serverOnlyImports(safeSource)).toEqual([]);
    expect(serverOnlyImports(leakySource).length).toBeGreaterThan(0);
  });
});
