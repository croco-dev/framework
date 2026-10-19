import { Problem, ProblemCategory } from "@croco/problems-core";

export type PublicProduct = Readonly<{
  price: string;
  currency: string;
  availabilityLabel: string;
  availability: "InStock" | "OutOfStock" | "PreOrder";
}>;
/** Only public repository facts belong here. Never project session or private benefit data. */
export type PublicPageContent = Readonly<{
  id: string;
  revision: string;
  modifiedAt: string;
  locale: string;
  title: string;
  description: string;
  links: readonly Readonly<{ label: string; href: string }>[];
  product?: PublicProduct;
}>;
export type PublicPageSnapshot =
  | Readonly<{ state: "published"; indexable: boolean; content: PublicPageContent }>
  | Readonly<{ state: "draft" | "missing"; status: 404 }>
  | Readonly<{ state: "private"; status: 401 | 403 | 404 }>
  | Readonly<{ state: "deleted"; status: 404 | 410 }>
  | Readonly<{ state: "redirect"; status: 301 | 302 | 307 | 308; location: string }>;
export interface PublicPageSource {
  load(request: Request): Promise<PublicPageSnapshot>;
}
export type PublicPageDefinition = Readonly<{
  id: string;
  origin: string;
  /** A path on origin. Returning a URL, network path, fragment or query is invalid. */
  pathname: (content: PublicPageContent) => string;
  meaningfulQuery: readonly string[];
  alternates: (
    content: PublicPageContent,
  ) => readonly Readonly<{ locale: string; pathname: string }>[];
  schema: "Product" | "Article";
  source: PublicPageSource;
}>;
export type PublicPageMetadata = Readonly<{
  title: string;
  description: string;
  canonical: string;
  lang: string;
  robots: "index,follow" | "noindex,nofollow";
  alternates: readonly Readonly<{ locale: string; href: string }>[];
  revision: string;
  jsonLd: string;
}>;
export class PublicPageProblem extends Problem {
  constructor(readonly reason: string) {
    super("seo-core/invalid-public-page", ProblemCategory.ValidationError, reason);
  }
}
export function publicPageUrl(origin: string, pathname: string): URL {
  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    throw new PublicPageProblem("invalid-origin");
  }
  if (
    base.origin !== origin ||
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  )
    throw new PublicPageProblem("invalid-origin");
  if (
    typeof pathname !== "string" ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    /[\\?#\s]/.test(pathname) ||
    Array.from(pathname).some((character) => character.charCodeAt(0) < 32)
  )
    throw new PublicPageProblem("invalid-pathname");
  const url = new URL(pathname, origin);
  if (url.origin !== origin) throw new PublicPageProblem("invalid-pathname");
  return url;
}
/** A public repository read cannot depend on session headers, preview origins or undeclared query keys. */
export function createPublicPageSourceRequest(
  definition: PublicPageDefinition,
  request: Request,
): Request {
  const input = new URL(request.url);
  const url = publicPageUrl(definition.origin, input.pathname);
  for (const key of [...new Set(definition.meaningfulQuery)].sort()) {
    for (const value of input.searchParams.getAll(key)) url.searchParams.append(key, value);
  }
  return new Request(url, { signal: request.signal, redirect: "manual" });
}
function required(value: string): void {
  if (typeof value !== "string" || !value.trim())
    throw new PublicPageProblem("missing-public-fact");
}
export function resolvePublicPageMetadata(
  definition: PublicPageDefinition,
  request: Request,
  snapshot: Extract<PublicPageSnapshot, { state: "published" }>,
): PublicPageMetadata {
  if (typeof snapshot.indexable !== "boolean") throw new PublicPageProblem("invalid-indexability");
  const content = snapshot.content;
  if (!content || typeof content !== "object" || !Array.isArray(content.links))
    throw new PublicPageProblem("invalid-public-content");
  for (const value of [
    definition.id,
    content.id,
    content.revision,
    content.title,
    content.description,
  ])
    required(value);
  if (
    typeof content.modifiedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(content.modifiedAt) ||
    !Number.isFinite(Date.parse(content.modifiedAt))
  )
    throw new PublicPageProblem("invalid-modified-at");
  const localeValid = (locale: string) => {
    if (typeof locale !== "string") return false;
    try {
      return Intl.getCanonicalLocales(locale).length === 1;
    } catch {
      return false;
    }
  };
  if (!localeValid(content.locale)) throw new PublicPageProblem("invalid-locale");
  const canonical = publicPageUrl(definition.origin, definition.pathname(content));
  const input = new URL(request.url);
  for (const key of [...new Set(definition.meaningfulQuery)].sort()) {
    required(key);
    for (const value of input.searchParams.getAll(key)) canonical.searchParams.append(key, value);
  }
  const declaredAlternates = definition.alternates(content);
  if (!Array.isArray(declaredAlternates)) throw new PublicPageProblem("invalid-alternates");
  const alternates = declaredAlternates.map((alternate) => {
    if (!alternate || typeof alternate !== "object")
      throw new PublicPageProblem("invalid-alternate");
    if (alternate.locale !== "x-default" && !localeValid(alternate.locale))
      throw new PublicPageProblem("invalid-alternate-locale");
    return {
      locale: alternate.locale,
      href: publicPageUrl(definition.origin, alternate.pathname).href,
    };
  });
  const alternateLocales = alternates.map((entry) =>
    entry.locale === "x-default" ? entry.locale : Intl.getCanonicalLocales(entry.locale)[0],
  );
  if (new Set(alternateLocales).size !== alternates.length)
    throw new PublicPageProblem("duplicate-alternate-locale");
  for (const link of content.links) {
    if (!link || typeof link !== "object" || typeof link.href !== "string")
      throw new PublicPageProblem("invalid-public-link");
    required(link.label);
    let url: URL;
    try {
      url = new URL(link.href, definition.origin);
    } catch {
      throw new PublicPageProblem("invalid-public-link");
    }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
      throw new PublicPageProblem("invalid-public-link");
  }
  const base = {
    "@context": "https://schema.org",
    "@type": definition.schema,
    name: content.title,
    description: content.description,
    url: canonical.href,
    inLanguage: content.locale,
    dateModified: content.modifiedAt,
  };
  if (!["Article", "Product"].includes(definition.schema))
    throw new PublicPageProblem("unsupported-schema");
  let data: object = base;
  if (definition.schema === "Product") {
    const offer = content.product;
    if (offer) required(offer.availabilityLabel);
    if (
      !offer ||
      typeof offer.price !== "string" ||
      typeof offer.currency !== "string" ||
      !/^\d+(?:\.\d{1,4})?$/.test(offer.price) ||
      !/^[A-Z]{3}$/.test(offer.currency) ||
      !["InStock", "OutOfStock", "PreOrder"].includes(offer.availability)
    )
      throw new PublicPageProblem("invalid-product-facts");
    data = {
      ...base,
      offers: {
        "@type": "Offer",
        price: offer.price,
        priceCurrency: offer.currency,
        availability: `https://schema.org/${offer.availability}`,
      },
    };
  }
  return {
    title: content.title,
    description: content.description,
    canonical: canonical.href,
    lang: content.locale,
    robots: snapshot.indexable ? "index,follow" : "noindex,nofollow",
    revision: content.revision,
    alternates,
    jsonLd: JSON.stringify(data)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029"),
  };
}
