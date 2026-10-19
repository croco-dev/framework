import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { createPublicPageInspector } from "@croco/seo-core";
import type { PublicPageContent, PublicPageDefinition, PublicPageSnapshot } from "@croco/seo-core";
import { createPublicPageHandler } from "../libs/seo/publicPageHandler";

const content: PublicPageContent = {
  id: "p42",
  revision: "v9",
  modifiedAt: "2026-10-18T02:00:00Z",
  locale: "en",
  title: "Desk lamp",
  description: "An adjustable lamp.",
  links: [{ label: "Shipping", href: "/shipping" }],
  product: {
    price: "24.95",
    currency: "USD",
    availability: "InStock",
    availabilityLabel: "Available",
  },
};
function Component({ content: page }: { content: PublicPageContent }) {
  return createElement(
    "main",
    null,
    createElement("h1", null, page.title),
    createElement("p", null, page.description),
    page.links.map((link) => createElement("a", { key: link.href, href: link.href }, link.label)),
    createElement(
      "p",
      { "data-public-price": page.product?.price, "data-public-currency": page.product?.currency },
      `USD ${page.product?.price}`,
    ),
    createElement(
      "p",
      { "data-public-availability": page.product?.availability },
      page.product?.availabilityLabel,
    ),
  );
}
const published = { state: "published", indexable: true, content } as const;
function setup(snapshot: PublicPageSnapshot = published) {
  const load = vi.fn(async (_request: Request) => snapshot);
  const definition: PublicPageDefinition = {
    id: "products",
    origin: "https://shop.example",
    pathname: () => "/products/p42",
    meaningfulQuery: ["variant"],
    alternates: () => [],
    schema: "Product",
    source: { load },
  };
  const handler = createPublicPageHandler({ definition, component: Component });
  return { definition, handler, load };
}
describe("PublicPageHandler", () => {
  it("uses one repository snapshot for initial body and head before committing", async () => {
    const { handler, load, definition } = setup();
    const request = new Request("https://preview.example/products/p42?variant=blue&utm_source=x", {
      headers: { cookie: "privateBenefit=50", authorization: "Bearer private-token" },
    });
    const response = await handler(request);
    const html = await response.text();
    expect(load).toHaveBeenCalledOnce();
    const sourceRequest = load.mock.calls[0]?.[0] as Request | undefined;
    expect(sourceRequest?.url).toBe("https://shop.example/products/p42?variant=blue");
    expect(sourceRequest ? [...sourceRequest.headers] : undefined).toEqual([]);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(html).toContain("<title>Desk lamp</title>");
    expect(html).toContain("<p>An adjustable lamp.</p>");
    expect(html).toContain('href="/shipping"');
    expect(html).toContain("https://shop.example/products/p42?variant=blue");
    expect(html).not.toContain("preview.example");
    expect(html).not.toContain("utm_source");
    const inspect = createPublicPageInspector({
      targets: [{ id: "p42", definition, requestUrl: request.url, respond: handler }],
      authorize: async () => true,
    });
    expect(await inspect("p42")).toMatchObject({
      state: "ready",
      resourceId: "p42",
      revision: "v9",
      diagnostics: [],
    });
  });
  it.each<PublicPageSnapshot>([
    { state: "draft", status: 404 },
    { state: "missing", status: 404 },
    { state: "private", status: 403 },
    { state: "deleted", status: 410 },
    { state: "redirect", status: 308, location: "/products/new" },
  ])("commits declared status for $state without product facts", async (snapshot) => {
    const { handler } = setup(snapshot);
    const response = await handler(new Request("https://shop.example/products/p42"));
    expect(response.status).toBe(snapshot.state === "published" ? 200 : snapshot.status);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    const body = await response.text();
    expect(body).not.toContain("Desk lamp");
    expect(body).not.toContain("application/ld+json");
    if (snapshot.state === "redirect")
      expect(response.headers.get("location")).toBe("/products/new");
  });
  it("supports public noindex without hiding the content", async () => {
    const { handler } = setup({ ...published, indexable: false });
    const response = await handler(new Request("https://shop.example/products/p42"));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("noindex,nofollow");
    expect(html).toContain("An adjustable lamp.");
  });
  it("separates source outage and invalid declarations with no private error output", async () => {
    const { handler, load } = setup();
    load.mockRejectedValueOnce(new Error("secret-token"));
    const unavailable = await handler(new Request("https://shop.example/products/p42"));
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("secret-token");
    const invalid = setup({ ...published, content: { ...content, product: undefined } });
    expect((await invalid.handler(new Request("https://shop.example/products/p42"))).status).toBe(
      422,
    );
  });
  it("rejects cross-origin redirects and never loads a source for mutating requests", async () => {
    const { handler, load } = setup({ state: "redirect", status: 302, location: "//evil.example" });
    expect((await handler(new Request("https://shop.example/products/p42"))).status).toBe(422);
    load.mockClear();
    expect(
      (await handler(new Request("https://shop.example/products/p42", { method: "POST" }))).status,
    ).toBe(405);
    expect(load).not.toHaveBeenCalled();
  });
  it("does not turn public text containing script termination into executable JSON-LD", async () => {
    const { handler } = setup({
      ...published,
      content: { ...content, title: "</script><script>window.leaked=true</script>" },
    });
    const html = await (await handler(new Request("https://shop.example/products/p42"))).text();
    expect(html).not.toContain("<script>window.leaked");
    expect(html).toContain("\\u003c/script\\u003e");
  });
});

it("keeps body, head and product facts isolated between concurrent public resources", async () => {
  const copper: PublicPageContent = {
    ...content,
    id: "copper",
    revision: "copper-r2",
    title: "Copper desk lamp",
    description: "A copper desk lamp with a narrow beam.",
    product: { ...content.product!, price: "13.25" },
  };
  const blue: PublicPageContent = {
    ...content,
    id: "blue",
    revision: "blue-r9",
    title: "Blue reading lamp",
    description: "A blue reading lamp with a broad beam.",
    product: { ...content.product!, price: "84.70" },
  };
  const definition: PublicPageDefinition = {
    ...setup().definition,
    pathname: (page) => `/products/${page.id}`,
    source: {
      async load(request) {
        return {
          state: "published",
          indexable: true,
          content: new URL(request.url).pathname.endsWith("/copper") ? copper : blue,
        };
      },
    },
  };
  const handler = createPublicPageHandler({ definition, component: Component });
  const responses = await Promise.all([
    handler(new Request("https://preview.example/products/copper")),
    handler(new Request("https://preview.example/products/blue")),
  ]);
  expect(responses.map((response) => response.status)).toEqual([200, 200]);
  const [copperHtml, blueHtml] = await Promise.all(responses.map((response) => response.text()));
  expect(copperHtml).toContain("<title>Copper desk lamp</title>");
  expect(copperHtml).toContain("https://shop.example/products/copper");
  expect(copperHtml).toContain('data-public-price="13.25"');
  expect(copperHtml).toContain('"price":"13.25"');
  expect(copperHtml).not.toContain("Blue reading lamp");
  expect(blueHtml).toContain("<title>Blue reading lamp</title>");
  expect(blueHtml).toContain("https://shop.example/products/blue");
  expect(blueHtml).toContain('data-public-price="84.70"');
  expect(blueHtml).toContain('"price":"84.70"');
  expect(blueHtml).not.toContain("Copper desk lamp");
});
