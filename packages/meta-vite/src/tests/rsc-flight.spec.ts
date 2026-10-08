import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createFromReadableStream } from "react-server-dom-webpack/client";
import { describe, expect, it } from "vitest";
import { RenderServer } from "../libs/render/renderServer";
import { defineRoute } from "../libs/routes/defineRoute";
import { RouteRegistry } from "../libs/routes/routeRegistry";
import type { PageRouteDefinition } from "../libs/routes/types";

function flightStream(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function createServer(
  routes: PageRouteDefinition[],
  encodeFlight?: (routePath: string) => Promise<ReadableStream<Uint8Array>>,
): RenderServer {
  const registry = new RouteRegistry();

  for (const route of routes) {
    registry.register(defineRoute(route));
  }

  if (!encodeFlight) {
    return new RenderServer(registry.compile());
  }

  return new RenderServer(registry.compile(), {
    encodeFlight: async (route) => encodeFlight(route.path),
  });
}

function rscRoute(path: string): PageRouteDefinition {
  return {
    path,
    mode: "rsc",
    component: () => createElement("main", null, `route ${path}`),
  };
}

const HTML_FLIGHT = '0:["$","main",null,{"children":"official-flight-content"}]\n';
const REFRESH_FLIGHT_A = '0:["$","main",null,{"children":"refresh-private-a"}]\n';
const REFRESH_FLIGHT_B = '0:["$","main",null,{"children":"refresh-private-b"}]\n';

async function decodeOfficialFlight(raw: string): Promise<unknown> {
  return (createFromReadableStream as (...args: unknown[]) => Promise<unknown>)(flightStream(raw), {
    serverConsumerManifest: { moduleMap: {}, serverModuleMap: {} },
  });
}

describe("rsc real Flight path", () => {
  it("decodes official Flight bytes to HTML instead of a disguised JSON payload", async () => {
    const server = createServer([rscRoute("/rsc-basic")], async () => flightStream(HTML_FLIGHT));

    const response = await server.handle(new Request("https://example.com/rsc-basic"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("official-flight-content");
    expect(html).not.toContain('"nodeType"');
    expect(html).not.toContain('type="text/x-component"');
    expect(html).toContain('id="croco-rsc-manifest"');

    const decoded = await decodeOfficialFlight(HTML_FLIGHT);
    expect(renderToString(decoded as never)).toContain("official-flight-content");
  });

  it("serves negotiated Flight bytes with a distinct content type and manifest headers", async () => {
    const server = createServer([rscRoute("/rsc-basic")], async () =>
      flightStream('0:"negotiated-flight-bytes"\n'),
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
    const server = createServer([rscRoute("/rsc-basic")], async () => flightStream(HTML_FLIGHT));

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
    const server = createServer([rscRoute("/rsc-basic")], async () => flightStream(HTML_FLIGHT));

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
    const server = createServer([rscRoute("/rsc-no-encoder")]);

    const response = await server.handle(new Request("https://example.com/rsc-no-encoder"));
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body).toMatchObject({
      error: "RSC request not supported",
      route: "/rsc-no-encoder",
      code: "meta-vite/rsc-flight-not-acceptable",
    });
    expect(body).not.toContain("<html");
  });

  it("keeps private props isolated across refreshes without cross-request mixing", async () => {
    let calls = 0;
    const server = createServer([rscRoute("/rsc-refresh")], async () => {
      calls += 1;
      return flightStream(calls === 1 ? REFRESH_FLIGHT_A : REFRESH_FLIGHT_B);
    });

    const first = await server.handle(new Request("https://example.com/rsc-refresh"));
    const second = await server.handle(new Request("https://example.com/rsc-refresh"));
    const firstHtml = await first.text();
    const secondHtml = await second.text();

    expect(firstHtml).toContain("refresh-private-a");
    expect(firstHtml).not.toContain("refresh-private-b");
    expect(secondHtml).toContain("refresh-private-b");
    expect(secondHtml).not.toContain("refresh-private-a");
  });

  it("keeps XSS escaping and never leaks render internals", async () => {
    const server = createServer(
      [
        {
          path: "/rsc-xss",
          mode: "rsc",
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

    const failing = createServer([rscRoute("/rsc-broken")], async () => {
      throw new Error("private encoder exploded with SECRET=abc123");
    });
    const failure = await failing.handle(new Request("https://example.com/rsc-broken"));
    const body = await failure.text();

    expect(failure.status).toBe(500);
    expect(body).toContain("An internal server error occurred");
    expect(body).not.toContain("SECRET=abc123");
    expect(body).not.toContain("private encoder exploded");
  });
});
