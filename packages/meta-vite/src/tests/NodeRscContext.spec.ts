import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import { createFromReadableStream } from "react-server-dom-webpack/client";
import { describe, expect, it } from "vitest";
import { createNodeComposedHandler, createNodeHandler } from "../libs/providers/node";
import { RenderServer } from "../libs/render/renderServer";
import { RSC_CLIENT_MANIFEST_VERSION } from "../libs/rsc/flight";
import { defineRoute } from "../libs/routes/defineRoute";
import { RouteRegistry } from "../libs/routes/routeRegistry";
import type { CrocoFetchHandler } from "../libs/render/types";

const componentRef = `${fileURLToPath(new URL("./fixtures/rsc-basic/nodeContext.mjs", import.meta.url))}#default`;

describe.each([
  ["standalone", createNodeHandler],
  [
    "composed",
    (pageHandler: CrocoFetchHandler) => createNodeComposedHandler({ apiHandlers: [], pageHandler }),
  ],
] as const)("Node RSC context through the %s adapter", (_name, createAdapter) => {
  it("renders the real component as HTML and negotiated Flight with Node metadata", async () => {
    const registry = new RouteRegistry();
    registry.register(
      defineRoute({
        path: "/node-context",
        mode: "rsc",
        componentRef,
        component: () => {
          throw new Error("the isolated component must render instead");
        },
      }),
    );
    const server = new RenderServer(registry.compile());
    const adapter = createAdapter((request, context) => server.handle(request, context));

    const html = await adapter.fetch(
      new Request("https://example.test/node-context?locale=ko", {
        headers: { "x-tenant": "tenant-a" },
      }),
    );
    expect(html.status).toBe(200);
    expect(html.headers.get("content-type")).toContain("text/html");
    expect(await html.text()).toContain(
      "platform=node;path=/node-context;locale=ko;tenant=tenant-a",
    );

    for (const [pathname, locale, tenant] of [
      ["/node-context.rsc", "en", "tenant-b"],
      ["/node-context", "ja", "tenant-c"],
    ]) {
      const flight = await adapter.fetch(
        new Request(`https://example.test${pathname}?locale=${locale}`, {
          headers: {
            accept: "text/x-component",
            "x-croco-rsc-client-manifest": RSC_CLIENT_MANIFEST_VERSION,
            "x-tenant": tenant,
          },
        }),
      );
      expect(flight.status).toBe(200);
      expect(flight.headers.get("content-type")).toContain("text/x-component");
      const element = await createFromReadableStream(flight.body!, {
        serverConsumerManifest: { moduleMap: {}, serverModuleMap: {} },
      });
      expect(renderToString(element as never)).toBe(
        `<main id="node-context">platform=node;path=${pathname};locale=${locale};tenant=${tenant}</main>`,
      );
    }
  });
});
describe("isolated encoder context input", () => {
  it.each([
    null,
    { platform: "lambda" },
    { platform: "node", env: { SECRET: "must-not-render" } },
    { platform: "node", executionContext: {} },
    { platform: "node", extra: "must-not-render" },
  ])("rejects unsupported pipe context before loading a component: %j", (context) => {
    const result = spawnSync(
      process.execPath,
      [
        "--conditions=react-server",
        fileURLToPath(new URL("../../dist/libs/rsc/flightEncode.entry.js", import.meta.url)),
      ],
      {
        input: JSON.stringify({ routePath: "/node-context", request: {}, context }),
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("accepts only platform-only Node context");
    expect(result.stderr).not.toContain("must-not-render");
  });
});
