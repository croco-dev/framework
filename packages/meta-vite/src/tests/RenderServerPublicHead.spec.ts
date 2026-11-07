import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { resolvePublicPageMetadata } from "@croco/seo-core";
import type { PublicPageContent, PublicPageDefinition } from "@croco/seo-core";
import { RenderServer } from "../libs/render/renderServer";
import type { HeadMetadata } from "../libs/routes/head";
import type { RenderRouteIR } from "../libs/routes/types";
import type { RuntimeContext } from "../libs/render/types";

const content: PublicPageContent = {
  id: "lamp",
  revision: 'ko-r9&"',
  modifiedAt: "2026-11-01T02:00:00Z",
  locale: "ko",
  title: '조명 <따뜻한> & "밝은"',
  description: "공개 설명 & 상세",
  links: [],
  product: {
    price: "37.50",
    currency: "USD",
    availability: "OutOfStock",
    availabilityLabel: "품절",
  },
};

function metadata(schema: PublicPageDefinition["schema"] = "Product"): HeadMetadata {
  const definition: PublicPageDefinition = {
    id: "pages",
    origin: "https://shop.example",
    pathname: () => "/products/lamp",
    meaningfulQuery: ["variant"],
    alternates: () => [
      { locale: "en", pathname: "/en/lamp" },
      { locale: "x-default", pathname: "/lamp" },
    ],
    schema,
    source: { load: async () => ({ state: "published", indexable: false, content }) },
  };
  const publicPage = resolvePublicPageMetadata(
    definition,
    new Request("https://shop.example/products/lamp?variant=amber&variant=blue"),
    { state: "published", indexable: false, content },
  );
  return { ...publicPage, ogTitle: "공유 조명", publicPage };
}

const deliveries: Array<{ name: string; regions: boolean; platform: RuntimeContext["platform"] }> =
  [
    { name: "buffered SSR", regions: false, platform: "node" },
    { name: "Node stream", regions: true, platform: "node" },
    { name: "Lambda buffered delivery", regions: true, platform: "lambda" },
    { name: "Workers stream core", regions: true, platform: "cloudflare" },
  ];

function route(head: () => HeadMetadata, withRegions = true): RenderRouteIR {
  return {
    path: "/head",
    mode: "ssr",
    head,
    componentLoader: async () => ({
      default: () => createElement("main", null, content.title),
    }),
    ...(withRegions ? { regions: [{ id: "details", loader: async () => "Details" }] } : {}),
  };
}

describe.each(deliveries)("RenderServer public head: $name", ({ regions, platform }) => {
  it.each(["Product", "Article"] as const)(
    "projects %s metadata from the public snapshot",
    async (schema) => {
      const head = vi.fn(() => metadata(schema));
      const response = await new RenderServer([route(head, regions)]).handle(
        new Request("https://shop.example/head"),
        { platform },
      );
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(head).toHaveBeenCalledOnce();
      expect(html).toContain('<html lang="ko">');
      expect(html).toContain("<title>조명 &lt;따뜻한&gt; &amp; &quot;밝은&quot;</title>");
      expect(html).toMatch(/<meta name="description" content="공개 설명 &amp; 상세"\s*\/?\s*>/);
      expect(html).toMatch(/<meta property="og:title" content="공유 조명"\s*\/?\s*>/);
      expect(html).toContain(
        'href="https://shop.example/products/lamp?variant=amber&amp;variant=blue"',
      );
      expect(html).toMatch(/<meta name="robots" content="noindex,nofollow"\s*\/?\s*>/);
      expect(html).toMatch(/<meta name="croco:revision" content="ko-r9&amp;&quot;"\s*\/?\s*>/);
      expect(html).toMatch(
        /<link rel="alternate" hrefLang="en" href="https:\/\/shop.example\/en\/lamp"\s*\/?\s*>/i,
      );
      expect(html).toMatch(
        /<link rel="alternate" hrefLang="x-default" href="https:\/\/shop.example\/lamp"\s*\/?\s*>/i,
      );
      const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
      expect(json).toBeDefined();
      expect(JSON.parse(json ?? "null")).toMatchObject({
        "@type": schema,
        name: content.title,
        inLanguage: "ko",
        url: "https://shop.example/products/lamp?variant=amber&variant=blue",
        ...(schema === "Product"
          ? { offers: { price: "37.50", availability: "https://schema.org/OutOfStock" } }
          : {}),
      });
      expect(html.indexOf('type="application/ld+json"')).toBeLessThan(html.indexOf("</head>"));
    },
  );

  it("escapes raw JSON-LD at the output boundary even without the resolver", async () => {
    const head = metadata();
    const publicPage = head.publicPage;
    expect(publicPage).toBeDefined();
    if (!publicPage) return;
    const title = '</script><script>window.injected=true</script>&"';
    const response = await new RenderServer([
      route(
        () => ({ ...head, publicPage: { ...publicPage, jsonLd: JSON.stringify({ name: title }) } }),
        regions,
      ),
    ]).handle(new Request("https://shop.example/head"), { platform });
    const html = await response.text();
    expect(html).not.toContain("<script>window.injected");
    expect(html).toContain("\\u003c/script\\u003e");
    expect(
      JSON.parse(
        html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "null",
      ),
    ).toEqual({ name: title });
  });

  it("fails before committing public metadata when head evaluation throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const head = vi.fn(() => {
        throw new Error("private head failure");
      });
      const response = await new RenderServer([route(head, regions)]).handle(
        new Request("https://shop.example/head"),
        { platform },
      );
      const html = await response.text();
      expect(response.status).toBe(500);
      expect(head).toHaveBeenCalledOnce();
      expect(html).not.toContain("private head failure");
      expect(html).not.toContain("application/ld+json");
    } finally {
      log.mockRestore();
    }
  });
});

it("commits each request's complete head before its deferred region settles", async () => {
  const render = async (locale: string, revision: string) => {
    let release: (() => void) | undefined;
    const deferred = new Promise<void>((resolve) => {
      release = resolve;
    });
    const value = metadata();
    const head = vi.fn(() => ({
      ...value,
      publicPage: { ...value.publicPage!, lang: locale, revision },
    }));
    const page: RenderRouteIR = {
      ...route(head),
      regions: [
        {
          id: "details",
          loader: async () => {
            await deferred;
            return "LATE-DETAILS";
          },
        },
      ],
    };
    const response = await new RenderServer([page]).handle(
      new Request("https://shop.example/head"),
      { platform: "node" },
    );
    const reader = response.body!.getReader();
    let prefix = "";
    const decoder = new TextDecoder();
    try {
      while (!prefix.includes("</head>")) {
        const next = await reader.read();
        if (next.done) break;
        prefix += decoder.decode(next.value, { stream: true });
      }
      expect(prefix).toContain(`<html lang="${locale}">`);
      expect(prefix).toContain(`name="croco:revision" content="${revision}"`);
      expect(prefix).toContain('name="robots" content="noindex,nofollow"');
      expect(prefix).toContain('type="application/ld+json"');
      expect(prefix).not.toContain("LATE-DETAILS");
      expect(head).toHaveBeenCalledOnce();
      return prefix;
    } finally {
      release?.();
      await reader.cancel();
    }
  };
  const [ko, en] = await Promise.all([render("ko", "korean-r7"), render("en", "english-r3")]);
  expect(ko).not.toContain("english-r3");
  expect(en).not.toContain("korean-r7");
});

it.each([
  { kind: "notFound", status: 404 },
  { kind: "redirect", status: 308, location: "/new" },
  { kind: "failed", status: 503 },
] as const)("commits $kind before evaluating a streaming public head", async (decision) => {
  const head = vi.fn(() => metadata());
  const page: RenderRouteIR = { ...route(head), resolveShell: async () => decision };
  const response = await new RenderServer([page]).handle(new Request("https://shop.example/head"), {
    platform: "node",
  });
  expect(response.status).toBe(decision.status);
  expect(head).not.toHaveBeenCalled();
  expect(await response.text()).not.toContain("application/ld+json");
  if (decision.kind === "redirect") expect(response.headers.get("location")).toBe("/new");
});
