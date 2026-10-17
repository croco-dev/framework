import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { RenderServer } from "../libs/render/renderServer";
import type { HeadMetadata } from "../libs/routes/head";
import type { RenderRouteIR } from "../libs/routes/types";
import type { RuntimeContext } from "../libs/render/types";

const deliveries: Array<{
  name: string;
  mode: RenderRouteIR["mode"];
  regions?: RenderRouteIR["regions"];
  platform: RuntimeContext["platform"];
}> = [
  { name: "buffered SSR", mode: "ssr", platform: "node" },
  { name: "RSC HTML shell", mode: "rsc", platform: "node" },
  {
    name: "streamed SSR",
    mode: "ssr",
    platform: "node",
    regions: [{ id: "details", loader: async () => "Deferred content" }],
  },
  {
    name: "Lambda buffered shell",
    mode: "ssr",
    platform: "lambda",
    regions: [{ id: "details", loader: async () => "Deferred content" }],
  },
];

describe.each(deliveries)("RenderServer head metadata: $name", ({ mode, regions, platform }) => {
  function flightStream(text: string): ReadableStream<Uint8Array> {
    const bytes = new TextEncoder().encode(text);

    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  }

  async function render(metadata: HeadMetadata): Promise<string> {
    const server = new RenderServer(
      [
        {
          path: "/head",
          mode,
          ...(regions ? { regions } : {}),
          componentLoader: async () => ({
            default: () => createElement("main", null, "Page content"),
          }),
          head: () => metadata,
        },
      ],
      // The RSC delivery renders its shell by decoding an encoded Flight
      // stream; a route with neither componentRef nor an encoder fails with
      // 501 by contract, so the shell path is exercised through an encoder.
      mode === "rsc"
        ? {
            encodeFlight: async () =>
              flightStream('0:["$","main",null,{"children":"Page content"}]\n'),
          }
        : {},
    );
    const response = await server.handle(new Request("https://example.test/head"), { platform });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    return response.text();
  }

  it("preserves a sharing title distinct from the document title", async () => {
    const html = await render({ title: "Document title", ogTitle: "Share title" });

    expect(html).toContain("<title>Document title</title>");
    expect(html).toMatch(/<meta property="og:title" content="Share title"\s*\/?\s*>/);
    expect(html.match(/property="og:title"/g)).toHaveLength(1);
    expect(html.indexOf('property="og:title"')).toBeLessThan(html.indexOf("</head>"));
  });

  it("renders the sharing title independently of a document title", async () => {
    const html = await render({ ogTitle: "Share without document title" });

    expect(html).toMatch(
      /<meta property="og:title" content="Share without document title"\s*\/?\s*>/,
    );
    expect(html).not.toContain("<title>Share without document title</title>");
  });

  it("escapes the sharing title as attribute content", async () => {
    const html = await render({
      title: "Safe document",
      ogTitle: "\"><script>alert('share')</script>&",
    });

    expect(html).toMatch(
      /<meta property="og:title" content="&quot;&gt;&lt;script&gt;alert\(&#x27;share&#x27;\)&lt;\/script&gt;&amp;"\s*\/?\s*>/,
    );
    expect(html).not.toContain("<script>alert");
  });

  it.each([undefined, ""])("does not infer a sharing title when ogTitle is %s", async (ogTitle) => {
    const html = await render({
      title: "Document only",
      ...(ogTitle === undefined ? {} : { ogTitle }),
    });

    expect(html).toContain("<title>Document only</title>");
    expect(html).not.toContain('property="og:title"');
  });
});
