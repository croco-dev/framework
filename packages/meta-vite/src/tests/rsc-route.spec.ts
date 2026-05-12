import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { RenderServer } from "../libs/render/renderServer";
import { defineRoute } from "../libs/routes/defineRoute";
import { RouteRegistry } from "../libs/routes/routeRegistry";
import type { PageRouteDefinition, RenderRouteComponentProps } from "../libs/routes/types";

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/rsc-basic");

type FlightPayload = {
  readonly nodeType: string;
  readonly path: string;
  readonly content: string;
};

function createRegistryServer(routes: PageRouteDefinition[]): RenderServer {
  const registry = new RouteRegistry();

  for (const route of routes) {
    registry.register(defineRoute(route));
  }

  return new RenderServer(registry.compile());
}

function extractFlightPayload(html: string): FlightPayload {
  const match = html.match(/<script type="text\/x-component">([\s\S]+?)<\/script>/);
  const payloadText = match?.[1];

  expect(payloadText).toBeDefined();

  if (!payloadText) {
    throw new Error("Missing Flight payload");
  }

  const payload: unknown = JSON.parse(payloadText);

  if (!isFlightPayload(payload)) {
    throw new Error("Invalid Flight payload");
  }

  return payload;
}

function isFlightPayload(value: unknown): value is FlightPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.nodeType === "string" &&
    typeof value.path === "string" &&
    typeof value.content === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readFixture(name: string): Promise<string> {
  return readFile(join(fixtureDir, name), "utf8");
}

async function assertNoServerOnlyLeakage(clientFixtureName: string): Promise<void> {
  const source = await readFixture(clientFixtureName);

  assertNoServerOnlyLeakageInSource(clientFixtureName, source);
}

function assertNoServerOnlyLeakageInSource(clientFixtureName: string, source: string): void {
  const importedModules = Array.from(source.matchAll(/from ['"]([^'"]+)['"]/g)).map(
    (match) => match[1] ?? "",
  );
  const serverOnlyImports = importedModules.filter((specifier) =>
    specifier.includes("server-only"),
  );

  if (serverOnlyImports.length > 0) {
    throw new Error(
      `Client boundary ${clientFixtureName} imports server-only module(s): ${serverOnlyImports.join(", ")}`,
    );
  }
}

describe("RSC route rendering", () => {
  it("renders HTML with Flight payload", async () => {
    const server = createRegistryServer([
      {
        path: "/rsc-basic",
        mode: "rsc",
        component: () => createElement("main", null, "RSC route: hello"),
      },
    ]);

    const response = await server.handle(new Request("https://example.com/rsc-basic"));
    const html = await response.text();
    const payload = extractFlightPayload(html);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("RSC route: hello");
    expect(html).toContain('<script type="text/x-component">');
    expect(payload).toEqual({
      nodeType: "rsc-flight",
      path: "/rsc-basic",
      content: "<main>RSC route: hello</main>",
    });
  });

  it("supports client component hydration marker", async () => {
    const { default: BrowserEntry } = await import("./fixtures/rsc-basic/entry.browser");
    const source = await readFixture("entry.browser.tsx");
    const server = createRegistryServer([
      {
        path: "/rsc-client-marker",
        mode: "rsc",
        component: () =>
          createElement(
            "section",
            { "data-client-component": "BrowserEntry" },
            createElement(BrowserEntry),
          ),
      },
    ]);

    const response = await server.handle(new Request("https://example.com/rsc-client-marker"));
    const html = await response.text();
    const payload = extractFlightPayload(html);

    expect(response.status).toBe(200);
    expect(source.trimStart()).toMatch(/^['"]use client['"];?/);
    expect(html).toContain('data-client-component="BrowserEntry"');
    expect(html).toContain("Browser:interactive");
    expect(payload.content).toContain('data-client-component="BrowserEntry"');
  });

  it("returns controlled JSON diagnostic when rendering fails", async () => {
    const server = createRegistryServer([
      {
        path: "/rsc-broken",
        mode: "rsc",
        component: () => {
          throw new Error("rsc render failed");
        },
      },
    ]);

    const response = await server.handle(new Request("https://example.com/rsc-broken"));
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(JSON.parse(body)).toEqual({
      error: "RSC rendering failed",
      route: "/rsc-broken",
      detail: "rsc render failed",
    });
    expect(body).not.toContain("<html");
    expect(body).not.toContain("Internal Server Error");
  });

  it("keeps non-RSC routes unaffected", async () => {
    const server = createRegistryServer([
      {
        path: "/ssr-page",
        mode: "ssr",
        component: ({ request }: RenderRouteComponentProps) =>
          createElement("main", null, `SSR route: ${new URL(request.url).pathname}`),
      },
      {
        path: "/ssg-page",
        mode: "ssg",
        component: () => createElement("main", null, "SSG route still renders"),
      },
      {
        path: "/isr-page",
        mode: "isr",
        revalidate: 60,
        component: () => createElement("main", null, "ISR route still renders"),
      },
      {
        path: "/rsc-page",
        mode: "rsc",
        component: () => createElement("main", null, "RSC route"),
      },
    ]);

    const ssrResponse = await server.handle(new Request("https://example.com/ssr-page"));
    const ssgResponse = await server.handle(new Request("https://example.com/ssg-page"));
    const isrResponse = await server.handle(new Request("https://example.com/isr-page"));

    await expect(ssrResponse.text()).resolves.toContain("SSR route: /ssr-page");
    await expect(ssgResponse.text()).resolves.toContain("SSG route still renders");
    await expect(isrResponse.text()).resolves.toContain("ISR route still renders");
    expect(ssrResponse.status).toBe(200);
    expect(ssgResponse.status).toBe(200);
    expect(isrResponse.status).toBe(200);
  });

  it("injects head metadata into RSC shell", async () => {
    const server = createRegistryServer([
      {
        path: "/rsc-head",
        mode: "rsc",
        component: () => createElement("main", null, "RSC head route"),
        head: () => ({ title: "RSC Page", description: "RSC route description" }),
      },
    ]);

    const response = await server.handle(new Request("https://example.com/rsc-head"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("<title>RSC Page</title>");
    expect(html).toContain('<meta name="description" content="RSC route description">');
    expect(html).toContain("RSC head route");
    expect(extractFlightPayload(html).path).toBe("/rsc-head");
  });

  it("rejects server-only imports at route-level client boundaries", async () => {
    const safeSource = await readFixture("entry.browser.tsx");
    const leakySource = await readFixture("client-with-server-import.tsx");
    const server = createRegistryServer([
      {
        path: "/rsc-safe-client",
        mode: "rsc",
        component: () => {
          assertNoServerOnlyLeakageInSource("entry.browser.tsx", safeSource);

          return createElement("main", null, "Safe client boundary");
        },
      },
      {
        path: "/rsc-leaky-client",
        mode: "rsc",
        component: () => {
          assertNoServerOnlyLeakageInSource("client-with-server-import.tsx", leakySource);

          return createElement("main", null, "Leaky client boundary");
        },
      },
    ]);

    await expect(assertNoServerOnlyLeakage("entry.browser.tsx")).resolves.toBeUndefined();
    await expect(assertNoServerOnlyLeakage("client-with-server-import.tsx")).rejects.toThrow(
      "imports server-only module",
    );

    const safeResponse = await server.handle(new Request("https://example.com/rsc-safe-client"));
    const leakyResponse = await server.handle(new Request("https://example.com/rsc-leaky-client"));
    const leakyDiagnostic = await leakyResponse.json();

    expect(safeResponse.status).toBe(200);
    expect(leakyResponse.status).toBe(500);
    expect(leakyDiagnostic).toEqual({
      error: "RSC rendering failed",
      route: "/rsc-leaky-client",
      detail:
        "Client boundary client-with-server-import.tsx imports server-only module(s): ./server-only-module",
    });
  });
});
