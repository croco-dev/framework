// Local repository fixture. No production network, credentials or persistence.
import { createPublicPageHandler, createNodeHandler } from "../../packages/meta-vite/src/index.ts";
import { createPublicPageInspector } from "../../packages/seo-core/src/index.ts";
import { createPublicPageOperations } from "../../packages/admin-core/src/index.ts";
import { PublicPageInspector } from "../../packages/admin-react/src/index.ts";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
const productRepository = new Map([
  [
    "lamp-7",
    {
      id: "lamp-7",
      revision: "r12",
      modifiedAt: "2026-10-18T03:10:00Z",
      locale: "en",
      title: "Amber reading lamp",
      description: "An adjustable reading lamp with a warm amber shade.",
      links: [{ label: "Delivery details", href: "/delivery" }],
      product: {
        price: "37.50",
        currency: "USD",
        availability: "OutOfStock",
        availabilityLabel: "Sold out",
      },
    },
  ],
]);
export const definition = {
  id: "products",
  origin: "https://shop.example",
  meaningfulQuery: ["variant"],
  schema: "Product",
  pathname: (content) => `/products/${content.id}`,
  alternates: () => [{ locale: "ko", pathname: "/ko/products/lamp-7" }],
  source: {
    async load(request) {
      const path = new URL(request.url).pathname;
      if (path === "/draft") return { state: "draft", status: 404 };
      if (path === "/deleted") return { state: "deleted", status: 410 };
      if (path === "/private") return { state: "private", status: 403 };
      if (path === "/old") return { state: "redirect", status: 308, location: "/products/lamp-7" };
      if (path === "/outage") throw new Error("synthetic-private-provider-token");
      const content = productRepository.get(path === "/xss" ? "lamp-7" : path.split("/").pop());
      if (!content) return { state: "missing", status: 404 };
      return {
        state: "published",
        indexable: true,
        content:
          path === "/xss"
            ? { ...content, title: "</script><script>window.injected=true</script>" }
            : content,
      };
    },
  },
};
export const handler = createPublicPageHandler({
  definition,
  component: ({ content }) =>
    createElement(
      "main",
      {
        style: {
          maxWidth: "48rem",
          margin: "auto",
          padding: "1.5rem",
          fontFamily: "system-ui",
          overflowWrap: "anywhere",
        },
      },
      createElement("h1", null, content.title),
      createElement("p", null, content.description),
      createElement(
        "p",
        {
          "data-public-price": content.product.price,
          "data-public-currency": content.product.currency,
        },
        `USD ${content.product.price}`,
      ),
      createElement(
        "p",
        { "data-public-availability": content.product.availability },
        content.product.availabilityLabel,
      ),
      content.links.map((link) =>
        createElement("a", { key: link.href, href: link.href }, link.label),
      ),
    ),
});
const paths = {
  lamp: "/products/lamp-7?variant=amber&utm_source=email",
  draft: "/draft",
  deleted: "/deleted",
  private: "/private",
  moved: "/old",
  missing: "/missing",
  xss: "/xss",
  outage: "/outage",
};
const targets = Object.entries(paths).map(([id, path]) => ({
  id,
  definition,
  requestUrl: `https://preview.example${path}`,
  respond: handler,
}));
targets.push({
  id: "mismatch",
  definition,
  requestUrl: "https://preview.example/products/lamp-7",
  async respond(request) {
    const response = await handler(request);
    return new Response(
      (await response.text())
        .replace(
          'rel="canonical" href="https://shop.example/products/lamp-7"',
          'rel="canonical" href="https://wrong.example/"',
        )
        .replace('data-public-price="37.50"', 'data-public-price="99.00"'),
      { status: response.status, headers: response.headers },
    );
  },
});
const inspector = createPublicPageInspector({ targets, authorize: async (id) => id !== "private" });
// Local fixture authorization only. A real admin endpoint binds authenticated authority here.
export const inspect = createPublicPageOperations({
  authorize: async (id) => id !== "private",
  inspect: inspector,
}).inspect;
export const app = createNodeHandler(async (request, context) => {
  const path = new URL(request.url).pathname;
  if (path.startsWith("/inspector/")) {
    const report = await inspect(path.slice("/inspector/".length));
    return new Response(
      `<!doctype html><html lang="en"><head><title>Public page inspection</title></head><body>${renderToString(createElement(PublicPageInspector, { report }))}</body></html>`,
      { headers: { "content-type": "text/html", "cache-control": "private, no-store" } },
    );
  }
  return handler(request, context);
});
