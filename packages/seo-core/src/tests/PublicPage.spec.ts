import { describe, expect, it, vi } from "vitest";
import {
  PublicPageProblem,
  createPublicPageSourceRequest,
  createPublicPageInspector,
  resolvePublicPageMetadata,
  validatePublicPageResponse,
} from "../index";
import type { PublicPageContent, PublicPageDefinition, PublicPageInspectionTarget } from "../index";

const content: PublicPageContent = {
  id: "lamp-7",
  revision: "r12",
  modifiedAt: "2026-10-18T03:10:00Z",
  locale: "ko-KR",
  title: "Reading lamp",
  description: "A warm adjustable reading lamp.",
  links: [{ label: "Delivery", href: "/delivery" }],
  product: {
    price: "37.50",
    currency: "USD",
    availability: "OutOfStock",
    availabilityLabel: "Sold out",
  },
};
const snapshot = { state: "published", indexable: true, content } as const;
const definition: PublicPageDefinition = {
  id: "products",
  origin: "https://shop.example",
  pathname: () => "/ko/products/lamp-7",
  meaningfulQuery: ["variant"],
  alternates: () => [{ locale: "en", pathname: "/en/products/lamp-7" }],
  schema: "Product",
  source: { load: async () => snapshot },
};
const requestUrl =
  "https://preview.example/ko/products/lamp-7?utm_source=email&variant=amber&variant=large";
const target: PublicPageInspectionTarget = {
  id: "lamp",
  definition,
  requestUrl,
  respond: async () => new Response(""),
};
const html = `<!doctype html><html lang="ko-KR"><head><title>Reading lamp</title>
<meta name="description" content="A warm adjustable reading lamp."><link rel="canonical" href="https://shop.example/ko/products/lamp-7?variant=amber&amp;variant=large">
<meta name="robots" content="index,follow"><meta name="croco:revision" content="r12">
<link rel="alternate" hreflang="en" href="https://shop.example/en/products/lamp-7">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Reading lamp","description":"A warm adjustable reading lamp.","url":"https://shop.example/ko/products/lamp-7?variant=amber&variant=large","inLanguage":"ko-KR","dateModified":"2026-10-18T03:10:00Z","offers":{"@type":"Offer","price":"37.50","priceCurrency":"USD","availability":"https://schema.org/OutOfStock"}}</script></head><body>
<main><h1>Reading lamp</h1><p>A warm adjustable reading lamp.</p><a href="/delivery">Delivery</a>
<p data-public-price="37.50" data-public-currency="USD">USD 37.50</p><p data-public-availability="OutOfStock">Sold out</p></main></body></html>`;
const validate = (value: string) =>
  validatePublicPageResponse(target, snapshot, {
    status: 200,
    headers: new Headers({ "content-type": "text/html" }),
    html: value,
  });
describe("Public page contracts", () => {
  it("retains declared repeated queries and production origin on preview requests", () => {
    const metadata = resolvePublicPageMetadata(definition, new Request(requestUrl), snapshot);
    expect(metadata.canonical).toBe(
      "https://shop.example/ko/products/lamp-7?variant=amber&variant=large",
    );
    expect(metadata.alternates).toEqual([
      { locale: "en", href: "https://shop.example/en/products/lamp-7" },
    ]);
    expect(JSON.parse(metadata.jsonLd).offers).toEqual({
      "@type": "Offer",
      price: "37.50",
      priceCurrency: "USD",
      availability: "https://schema.org/OutOfStock",
    });
  });
  it.each(["en-US-u-ca-gregory", "en-x-test", "en-x-a"])(
    "preserves an extended locale %s in page and alternate metadata",
    (locale) => {
      const metadata = resolvePublicPageMetadata(
        { ...definition, alternates: () => [{ locale, pathname: "/en/products/lamp-7" }] },
        new Request(requestUrl),
        { ...snapshot, content: { ...content, locale } },
      );
      expect(metadata.lang).toBe(locale);
      expect(metadata.alternates[0]?.locale).toBe(locale);
      expect(JSON.parse(metadata.jsonLd).inLanguage).toBe(locale);
    },
  );
  it.each(["en-u", "en-x", "en-u-a"])(
    "rejects an incomplete locale %s in page and alternate metadata",
    (locale) => {
      expect(() =>
        resolvePublicPageMetadata(definition, new Request(requestUrl), {
          ...snapshot,
          content: { ...content, locale },
        }),
      ).toThrow("invalid-locale");
      expect(() =>
        resolvePublicPageMetadata(
          { ...definition, alternates: () => [{ locale, pathname: "/en/products/lamp-7" }] },
          new Request(requestUrl),
          snapshot,
        ),
      ).toThrow("invalid-alternate-locale");
    },
  );
  it("rejects equivalent alternate locale spellings", () => {
    expect(() =>
      resolvePublicPageMetadata(
        {
          ...definition,
          alternates: () => [
            { locale: "en-US", pathname: "/en/products/lamp-7" },
            { locale: "en-us", pathname: "/legacy/products/lamp-7" },
          ],
        },
        new Request(requestUrl),
        snapshot,
      ),
    ).toThrow("duplicate-alternate-locale");
  });
  it.each([
    "//evil.example/item",
    "/\\evil.example",
    "https://evil.example/",
    "/item?secret=yes",
    "/item#draft",
    "/item\n",
  ])("rejects ambiguous canonical path %s", (path) => {
    expect(() =>
      resolvePublicPageMetadata(
        { ...definition, pathname: () => path },
        new Request(requestUrl),
        snapshot,
      ),
    ).toThrow("invalid-pathname");
  });
  it("escapes script termination without changing public facts", () => {
    const metadata = resolvePublicPageMetadata(definition, new Request(requestUrl), {
      ...snapshot,
      content: { ...content, title: "</script><script>alert(1)</script>&\u2028" },
    });
    expect(metadata.jsonLd).not.toContain("<");
    expect(JSON.parse(metadata.jsonLd).name).toBe("</script><script>alert(1)</script>&\u2028");
  });
  it("rejects invented schema fields and invalid facts at the selected schema boundary", () => {
    expect(() =>
      resolvePublicPageMetadata(definition, new Request(requestUrl), {
        ...snapshot,
        content: { ...content, product: { ...content.product!, price: "-1" } },
      }),
    ).toThrow("invalid-product-facts");
    expect(() =>
      resolvePublicPageMetadata({ ...definition, schema: "Article" }, new Request(requestUrl), {
        ...snapshot,
        content: { ...content, locale: 'ko" onclick=x' },
      }),
    ).toThrow("invalid-locale");
  });
  it("accepts independently authored initial HTML with source-backed facts", () => {
    expect(validate(html)).toMatchObject({
      state: "ready",
      revision: "r12",
      resourceId: "lamp-7",
      diagnostics: [],
    });
  });
  it("reads noscript content as a JavaScript-disabled browser does", () => {
    const fallback = html
      .replace("<main>", "<noscript><main>")
      .replace("</main>", "</main></noscript>");
    expect(validate(fallback)).toMatchObject({ state: "ready", diagnostics: [] });
  });
  it.each(['<base href="https://other.example/">', '<base href="http://[">'])(
    "rejects a base URL that changes a declared link destination: %s",
    (base) => {
      const redirected = html.replace("<head>", `<head>${base}`);
      expect(validate(redirected)).toMatchObject({
        state: "partial",
        diagnostics: [{ code: "SEO_LINK_MISSING", field: "links" }],
      });
    },
  );
  it.each([
    '<base href="/other/">',
    '<base target="_blank"><base href="/other/">',
    '<base href="/other/"><base href="https://other.example/">',
    '<base href="javascript:alert(1)">',
    '<base href="data:text/html,ignored">',
  ])("accepts a document base that preserves the declared destination: %s", (base) => {
    expect(validate(html.replace("<head>", `<head>${base}`))).toMatchObject({
      state: "ready",
      diagnostics: [],
    });
  });
  it("ignores feed alternate links without hreflang", () => {
    expect(
      validate(
        html.replace(
          "</head>",
          '<link rel="alternate" type="application/rss+xml" href="/feed.xml"></head>',
        ),
      ),
    ).toMatchObject({ state: "ready", diagnostics: [] });
  });
  it("validates Article HTML without imposing Product-only body facts", () => {
    const articleHtml = `<!doctype html><html lang="ko-KR"><head><title>Reading lamp</title>
<meta name="description" content="A warm adjustable reading lamp."><link rel="canonical" href="https://shop.example/ko/products/lamp-7?variant=amber&amp;variant=large">
<meta name="robots" content="index,follow"><meta name="croco:revision" content="r12">
<link rel="alternate" hreflang="en" href="https://shop.example/en/products/lamp-7">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","name":"Reading lamp","description":"A warm adjustable reading lamp.","url":"https://shop.example/ko/products/lamp-7?variant=amber&variant=large","inLanguage":"ko-KR","dateModified":"2026-10-18T03:10:00Z"}</script></head><body>
<main><h1>Reading lamp</h1><p>A warm adjustable reading lamp.</p><a href="/delivery">Delivery</a></main></body></html>`;
    expect(
      validatePublicPageResponse(
        { ...target, definition: { ...definition, schema: "Article" } },
        snapshot,
        { status: 200, headers: new Headers({ "content-type": "text/html" }), html: articleHtml },
      ),
    ).toMatchObject({ state: "ready", diagnostics: [] });
  });
  it.each([
    [
      "canonical",
      "https://shop.example/ko/products/lamp-7?variant=amber&amp;variant=large",
      "https://evil.example/",
      "SEO_CANONICAL_MISMATCH",
    ],
    ["locale", 'lang="ko-KR"', 'lang="en"', "SEO_LOCALE_MISMATCH"],
    ["alternate", 'hreflang="en"', 'hreflang="fr"', "SEO_ALTERNATE_MISMATCH"],
    ["robots", 'content="index,follow"', 'content="noindex,nofollow"', "SEO_INDEXABILITY_MISMATCH"],
    ["price", 'data-public-price="37.50"', 'data-public-price="39.00"', "SEO_BODY_PRICE_MISMATCH"],
    [
      "availability",
      'data-public-availability="OutOfStock"',
      'data-public-availability="InStock"',
      "SEO_BODY_AVAILABILITY_MISMATCH",
    ],
    ["JSON-LD", '"price":"37.50"', '"price":"39.00"', "SEO_STRUCTURED_DATA_MISMATCH"],
    [
      "body",
      "<p>A warm adjustable reading lamp.</p>",
      "<script>A warm adjustable reading lamp.</script>",
      "SEO_BODY_DESCRIPTION_MISSING",
    ],
    ["link", 'href="/delivery"', "onclick=\"location='/delivery'\"", "SEO_LINK_MISSING"],
  ])("detects %s disagreement in the same inspector", (_, before, after, code) => {
    expect(validate(html.replace(before, after))).toMatchObject({
      state: "partial",
      diagnostics: expect.arrayContaining([{ code, field: expect.any(String) }]),
    });
  });
  it("flags nonpublic JSON-LD and soft 200 errors", () => {
    const report = validatePublicPageResponse(
      target,
      { state: "deleted", status: 410 },
      { status: 200, headers: new Headers(), html },
    );
    expect(report.diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "SEO_STATUS_MISMATCH",
        "SEO_INDEXABILITY_MISMATCH",
        "SEO_NONPUBLIC_STRUCTURED_DATA",
      ]),
    );
  });
  it.each([
    "//evil.example/collect",
    "https://evil.example/collect",
    "/\\evil.example/collect",
    "/products/lamp-8?preview=secret",
    "/products/lamp-8#preview",
  ])("rejects forbidden redirect source %s through an independent responder", async (location) => {
    const inspect = createPublicPageInspector({
      targets: [
        {
          ...target,
          definition: {
            ...definition,
            source: { load: async () => ({ state: "redirect", status: 302, location }) },
          },
          respond: async () =>
            new Response(null, {
              status: 302,
              headers: { location, "x-robots-tag": "noindex" },
            }),
        },
      ],
      authorize: async () => true,
    });
    expect(await inspect("lamp")).toMatchObject({
      state: "partial",
      diagnostics: [{ code: "SEO_INVALID_SOURCE", field: "invalid-pathname" }],
    });
  });
  it.each([301, 302, 307, 308] as const)(
    "accepts a declared same-origin redirect with status %s",
    async (status) => {
      const inspect = createPublicPageInspector({
        targets: [
          {
            ...target,
            definition: {
              ...definition,
              source: {
                load: async () => ({ state: "redirect", status, location: "/products/lamp-8" }),
              },
            },
            respond: async () =>
              new Response(null, {
                status,
                headers: { location: "/products/lamp-8", "x-robots-tag": "noindex" },
              }),
          },
        ],
        authorize: async () => true,
      });
      expect(await inspect("lamp")).toMatchObject({
        state: "ready",
        publication: "redirect",
        responseStatus: status,
        diagnostics: [],
      });
    },
  );
  it("denies unknown and unauthorized targets without calling sources or responders", async () => {
    const load = vi.fn();
    const respond = vi.fn();
    const inspect = createPublicPageInspector({
      targets: [{ ...target, definition: { ...definition, source: { load } }, respond }],
      authorize: async () => false,
    });
    expect((await inspect("lamp")).state).toBe("denied");
    expect((await inspect("http://169.254.169.254/latest")).state).toBe("denied");
    expect(load).not.toHaveBeenCalled();
    expect(respond).not.toHaveBeenCalled();
  });
  it("reads the registered source and actual response, distinguishing failures from mismatches", async () => {
    const inspect = createPublicPageInspector({
      targets: [
        {
          ...target,
          respond: async () => new Response(html, { headers: { "content-type": "text/html" } }),
        },
      ],
      authorize: async () => true,
    });
    expect((await inspect("lamp")).state).toBe("ready");
    const unavailable = createPublicPageInspector({
      targets: [
        {
          ...target,
          respond: async () => {
            throw new Error("private database credentials");
          },
        },
      ],
      authorize: async () => true,
    });
    expect(await unavailable("lamp")).toEqual({
      targetId: "lamp",
      state: "unavailable",
      diagnostics: [{ code: "SEO_SOURCE_OR_RESPONSE_UNAVAILABLE", field: "target" }],
    });
  });
  it("bounds responses and cancels unread data", async () => {
    const cancel = vi.fn();
    const inspect = createPublicPageInspector({
      targets: [
        {
          ...target,
          respond: async () =>
            new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(new Uint8Array(524289));
                },
                cancel,
              }),
            ),
        },
      ],
      authorize: async () => true,
    });
    expect((await inspect("lamp")).state).toBe("unavailable");
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe("Public page inspection boundaries", () => {
  it("does not treat hidden links or hidden offer markers as initial public content", () => {
    expect(
      validate(
        html.replace(
          '<a href="/delivery">Delivery</a>',
          '<div hidden><a href="/delivery">Delivery</a></div>',
        ),
      ).diagnostics,
    ).toContainEqual({ code: "SEO_LINK_MISSING", field: "links" });
    expect(
      validate(html.replace("<p data-public-price=", "<p hidden data-public-price=")).diagnostics,
    ).toContainEqual({ code: "SEO_BODY_PRICE_MISMATCH", field: "product.price" });
  });
  it("compares visible availability text with the repository-backed label", () => {
    expect(
      validate(html.replace(">Sold out</p>", ">Available now</p>")).diagnostics,
    ).toContainEqual({ code: "SEO_BODY_AVAILABILITY_MISMATCH", field: "product.availability" });
  });
  it("detects additional unapproved structured facts in the body", () => {
    expect(
      validate(
        html.replace(
          "</body>",
          '<script type="application/ld+json">{"ratingValue":5}</script></body>',
        ),
      ).diagnostics,
    ).toContainEqual({ code: "SEO_STRUCTURED_DATA_MISMATCH", field: "jsonLd" });
  });
  it("accepts equivalent JSON object key order", () => {
    expect(
      validate(
        html.replace(
          '"@context":"https://schema.org","@type":"Product"',
          '"@type":"Product","@context":"https://schema.org"',
        ),
      ).state,
    ).toBe("ready");
  });
});

it("cancels a stalled response at the inspection deadline", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  try {
    const inspect = createPublicPageInspector({
      targets: [{ ...target, respond: async () => new Response(new ReadableStream({ cancel })) }],
      authorize: async () => true,
    });
    const pending = inspect("lamp");
    await vi.advanceTimersByTimeAsync(5000);
    expect((await pending).state).toBe("unavailable");
    expect(cancel).toHaveBeenCalledOnce();
  } finally {
    vi.useRealTimers();
  }
});

it("redacts an authorization provider failure without reading any source", async () => {
  const load = vi.fn();
  const inspect = createPublicPageInspector({
    targets: [{ ...target, definition: { ...definition, source: { load } } }],
    authorize: async () => {
      throw new Error("private-auth-token");
    },
  });
  expect(await inspect("lamp")).toEqual({
    targetId: "lamp",
    state: "unavailable",
    diagnostics: [{ code: "SEO_AUTHORIZATION_UNAVAILABLE", field: "authorization" }],
  });
  expect(load).not.toHaveBeenCalled();
});

it("reads public facts with no cookies, credentials, preview origin or undeclared query", () => {
  const request = createPublicPageSourceRequest(
    definition,
    new Request(requestUrl, {
      headers: {
        cookie: "privateDiscount=50",
        authorization: "Bearer secret",
        "user-agent": "search-bot",
      },
    }),
  );
  expect(request.url).toBe("https://shop.example/ko/products/lamp-7?variant=amber&variant=large");
  expect([...request.headers]).toEqual([]);
});

it("reports malformed repository content as validation failure instead of an outage", () => {
  const malformed = {
    ...snapshot,
    content: { ...content, links: null } as unknown as PublicPageContent,
  };
  const report = validatePublicPageResponse(target, malformed, {
    status: 200,
    headers: new Headers({ "content-type": "text/html" }),
    html,
  });
  expect(report).toMatchObject({
    state: "partial",
    diagnostics: [{ code: "SEO_INVALID_SOURCE", field: "invalid-public-content" }],
  });
});

it.each(["EUR 37.50", "USD 137.50"])(
  "rejects a misleading visible price %s even with matching attributes",
  (price) => {
    expect(validate(html.replace(">USD 37.50</p>", `>${price}</p>`)).diagnostics).toContainEqual({
      code: "SEO_BODY_PRICE_MISMATCH",
      field: "product.price",
    });
  },
);

it("detects an HTTP noindex directive conflicting with an indexable public page", () => {
  const report = validatePublicPageResponse(target, snapshot, {
    status: 200,
    headers: new Headers({ "content-type": "text/html", "x-robots-tag": "googlebot: NoIndex" }),
    html,
  });
  expect(report.diagnostics).toContainEqual({ code: "SEO_INDEXABILITY_MISMATCH", field: "robots" });
});

it("requires the actual HTML MIME type rather than a prefix match", () => {
  const report = validatePublicPageResponse(target, snapshot, {
    status: 200,
    headers: new Headers({ "content-type": "text/html-untrusted" }),
    html,
  });
  expect(report.diagnostics).toContainEqual({ code: "SEO_CONTENT_TYPE", field: "content-type" });
});

it("reports an invalid canonical origin as partial before loading a source", async () => {
  const load = vi.fn();
  const inspect = createPublicPageInspector({
    targets: [{ ...target, definition: { ...definition, origin: "not a URL", source: { load } } }],
    authorize: async () => true,
  });
  expect(await inspect("lamp")).toMatchObject({
    state: "partial",
    diagnostics: [{ code: "SEO_INVALID_SOURCE", field: "definition" }],
  });
  expect(load).not.toHaveBeenCalled();
});

it("rejects an invalid registered preview URL through the public Problem contract", () => {
  expect(() =>
    createPublicPageInspector({
      targets: [{ ...target, requestUrl: "not a URL" }],
      authorize: async () => true,
    }),
  ).toThrow(PublicPageProblem);
});

it.each([
  ["indexability string", { ...snapshot, indexable: "false" }],
  ["missing indexability", { ...snapshot, indexable: undefined }],
  ["locale array", { ...snapshot, content: { ...content, locale: ["en"] } }],
  [
    "modification time array",
    { ...snapshot, content: { ...content, modifiedAt: [content.modifiedAt] } },
  ],
  [
    "price array",
    { ...snapshot, content: { ...content, product: { ...content.product, price: ["37.50"] } } },
  ],
  [
    "numeric price",
    { ...snapshot, content: { ...content, product: { ...content.product, price: 37.5 } } },
  ],
  [
    "currency array",
    { ...snapshot, content: { ...content, product: { ...content.product, currency: ["USD"] } } },
  ],
])("rejects a malformed %s before serializing public facts", (_, value) => {
  expect(() =>
    resolvePublicPageMetadata(
      definition,
      new Request(requestUrl),
      value as unknown as typeof snapshot,
    ),
  ).toThrow(PublicPageProblem);
});

it("rejects a coerced alternate locale and accepts explicit noindex with a zero price", () => {
  const malformed: PublicPageDefinition = {
    ...definition,
    alternates: () => [{ locale: ["ko"] as unknown as string, pathname: "/ko/products/lamp-7" }],
  };
  expect(() => resolvePublicPageMetadata(malformed, new Request(requestUrl), snapshot)).toThrow(
    PublicPageProblem,
  );
  const metadata = resolvePublicPageMetadata(definition, new Request(requestUrl), {
    ...snapshot,
    indexable: false,
    content: { ...content, product: { ...content.product!, price: "0" } },
  });
  expect(metadata.robots).toBe("noindex,nofollow");
  expect(JSON.parse(metadata.jsonLd).offers.price).toBe("0");
});
