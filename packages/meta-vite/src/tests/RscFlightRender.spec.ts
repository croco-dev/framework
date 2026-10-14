import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createFromReadableStream } from "react-server-dom-webpack/client";
import { describe, expect, it } from "vitest";
import { RenderServer } from "../libs/render/renderServer";
import {
  RSC_CLIENT_MANIFEST_VERSION,
  RSC_MANIFEST_ELEMENT_ID,
  composeRscClientManifestVersion,
  createRscBrowserFlightHeaders,
  createRscHtmlShell,
  readRscClientManifestVersion,
} from "../libs/rsc/flight";
import { defineRoute } from "../libs/routes/defineRoute";
import { RouteRegistry } from "../libs/routes/routeRegistry";
import type { PageRouteDefinition } from "../libs/routes/types";
import type { RscRenderOptions } from "../libs/rsc/flight";

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
  rscOptions: RscRenderOptions = {},
): RenderServer {
  const registry = new RouteRegistry();

  for (const route of routes) {
    registry.register(defineRoute(route));
  }

  const compiled = registry.compile();

  if (!encodeFlight) {
    return new RenderServer(compiled, rscOptions);
  }

  return new RenderServer(compiled, {
    ...rscOptions,
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

    const response = await server.handle(
      new Request("https://example.com/rsc-basic.rsc", {
        headers: { "x-croco-rsc-client-manifest": RSC_CLIENT_MANIFEST_VERSION },
      }),
    );
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

  it("rejects a Flight request without the client manifest header instead of mixing builds", async () => {
    const server = createServer([rscRoute("/rsc-basic")], async () => flightStream(HTML_FLIGHT));

    const response = await server.handle(new Request("https://example.com/rsc-basic.rsc"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: "RSC client manifest mismatch",
      route: "/rsc-basic",
      code: "meta-vite/rsc-client-manifest-mismatch",
    });
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
    expect(JSON.stringify(body)).not.toContain("<html");
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

describe("rsc client manifest version round trip", () => {
  it("refuses a Flight request from a different client build", async () => {
    const server = createServer([rscRoute("/rsc-basic")], async () => flightStream(HTML_FLIGHT), {
      clientBuildId: "9f31c0d4a2b7e15c",
    });
    const currentVersion = composeRscClientManifestVersion("9f31c0d4a2b7e15c");

    const accepted = await server.handle(
      new Request("https://example.com/rsc-basic.rsc", {
        headers: { "x-croco-rsc-client-manifest": currentVersion },
      }),
    );
    expect(accepted.status).toBe(200);

    // A browser still running the previous build must not decode this payload.
    const stale = await server.handle(
      new Request("https://example.com/rsc-basic.rsc", {
        headers: { "x-croco-rsc-client-manifest": RSC_CLIENT_MANIFEST_VERSION },
      }),
    );
    expect(stale.status).toBe(400);
    expect(await stale.json()).toMatchObject({ code: "meta-vite/rsc-client-manifest-mismatch" });

    const other = await server.handle(
      new Request("https://example.com/rsc-basic.rsc", {
        headers: {
          "x-croco-rsc-client-manifest": composeRscClientManifestVersion("0f8e1d2c3b4a5968"),
        },
      }),
    );
    expect(other.status).toBe(400);
  });

  it("rejects a build id that cannot travel as a header value", () => {
    expect(() => composeRscClientManifestVersion("build 42")).toThrow(
      /letters, digits, dot, underscore, and dash/,
    );
    expect(() => composeRscClientManifestVersion("bad\nid")).toThrow(
      /letters, digits, dot, underscore, and dash/,
    );
    expect(composeRscClientManifestVersion("9f31c0d4a2b7e15c")).toBe(
      "croco.meta-vite.rsc-client-manifest.v1.9f31c0d4a2b7e15c",
    );
  });

  it("keeps the manifest JSON block from closing its own script element", () => {
    const hostileVersion =
      "croco.meta-vite.rsc-client-manifest.v1.</script><script>alert(1)</script>";
    const shell = createRscHtmlShell(undefined, "<main>body</main>", hostileVersion);
    const block = shell.match(new RegExp(`id="${RSC_MANIFEST_ELEMENT_ID}">([\\s\\S]*?)</script>`));

    expect(block).not.toBeNull();
    expect(block?.[1]).not.toContain("<");
    expect(block?.[1]).toContain("\\u003c");
  });

  it("echoes the version the rendered document carries, not a constant", () => {
    const version = composeRscClientManifestVersion("9f31c0d4a2b7e15c");
    const headers = createRscBrowserFlightHeaders(createStubDocument({ version }));

    expect(headers).toEqual({
      accept: "text/x-component",
      "x-croco-rsc-client-manifest": version,
    });
  });

  it("falls back to the meta tag when the JSON block is missing or damaged", () => {
    const version = composeRscClientManifestVersion("9f31c0d4a2b7e15c");
    const metaOnly = createStubDocument({ version, manifestBlock: false });
    const damaged = createStubDocument({
      version,
      manifestBlock: true,
      manifestContent: "{ not json",
    });

    expect(createRscBrowserFlightHeaders(metaOnly)).toMatchObject({
      "x-croco-rsc-client-manifest": version,
    });
    expect(createRscBrowserFlightHeaders(damaged)).toMatchObject({
      "x-croco-rsc-client-manifest": version,
    });
  });

  it("reports a document without any manifest version instead of sending a guess", () => {
    expect(() => createRscBrowserFlightHeaders(createStubDocument({}))).toThrow(
      /mismatched client manifest version/,
    );
  });
});

describe("rsc browser entrypoint", () => {
  it("hands the browser the same handshake the server entry owns", async () => {
    const browserEntry = await import("../libs/rsc/flightBrowser.entry");

    // A client bundle must not import the package root: that entry pulls in
    // Node builtins. Identity proves the subpath re-exports the one
    // implementation instead of restating the contract.
    expect(browserEntry.createRscBrowserFlightHeaders).toBe(createRscBrowserFlightHeaders);
    expect(browserEntry.readRscClientManifestVersion).toBe(readRscClientManifestVersion);
    expect(browserEntry.RSC_MANIFEST_ELEMENT_ID).toBe(RSC_MANIFEST_ELEMENT_ID);
    expect(browserEntry.RSC_CLIENT_MANIFEST_VERSION).toBe(RSC_CLIENT_MANIFEST_VERSION);
    expect(browserEntry.RSC_FLIGHT_CONTENT_TYPE).toBe("text/x-component");
  });

  it("loads in a plain Node context without reaching the server modules", async () => {
    const browserEntry = await import("../libs/rsc/flightBrowser.entry");

    expect(
      createRscBrowserFlightHeaders(createStubDocument({ version: RSC_CLIENT_MANIFEST_VERSION })),
    ).toEqual({
      accept: browserEntry.RSC_FLIGHT_CONTENT_TYPE,
      "x-croco-rsc-client-manifest": RSC_CLIENT_MANIFEST_VERSION,
    });
  });
});

function createStubDocument(input: {
  readonly version?: string;
  readonly manifestBlock?: boolean;
  readonly manifestContent?: string;
}): Parameters<typeof createRscBrowserFlightHeaders>[0] {
  const version = input.version ?? "";
  const manifestContent =
    input.manifestContent ?? JSON.stringify({ clientManifestVersion: version });

  return {
    getElementById: (id: string) =>
      input.manifestBlock === false || id !== RSC_MANIFEST_ELEMENT_ID
        ? null
        : { textContent: manifestContent },
    querySelector: (selector: string) =>
      selector !== 'meta[name="croco:rsc-client-manifest"]' || version.length === 0
        ? null
        : { getAttribute: () => version.replace(/</g, "&lt;") },
    location: { pathname: "/rsc-basic" },
  };
}
