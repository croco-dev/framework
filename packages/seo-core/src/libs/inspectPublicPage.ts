import { parse } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";
import {
  createPublicPageSourceRequest,
  resolvePublicPageMetadata,
  PublicPageProblem,
  publicPageUrl,
} from "./publicPage";
import type { PublicPageDefinition, PublicPageSnapshot } from "./publicPage";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
export type PublicPageDiagnostic = Readonly<{ code: string; field: string }>;
export type PublicPageInspection = Readonly<{
  targetId: string;
  state: "ready" | "partial" | "denied" | "unavailable";
  diagnostics: readonly PublicPageDiagnostic[];
  responseStatus?: number;
  publication?: PublicPageSnapshot["state"];
  resourceId?: string;
  revision?: string;
}>;
/** Construct on the server from a registered site/preview, never from a caller supplied URL. */
export type PublicPageInspectionTarget = Readonly<{
  id: string;
  requestUrl: string;
  definition: PublicPageDefinition;
  respond: (request: Request) => Promise<Response>;
}>;
function attr(node: Element, name: string): string | undefined {
  return node.attrs.find((attribute) => attribute.name === name)?.value;
}
function elements(node: Node): Element[] {
  if (!("childNodes" in node)) return [];
  return node.childNodes.flatMap((child) =>
    "tagName" in child ? [child, ...elements(child)] : elements(child),
  );
}
function hidden(node: Node): boolean {
  return (
    "tagName" in node &&
    (["script", "style", "template"].includes(node.tagName) ||
      attr(node, "hidden") !== undefined ||
      /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attr(node, "style") ?? ""))
  );
}
function visibleElements(node: Node): Element[] {
  if (hidden(node) || !("childNodes" in node)) return [];
  return node.childNodes.flatMap((child) =>
    hidden(child)
      ? []
      : "tagName" in child
        ? [child, ...visibleElements(child)]
        : visibleElements(child),
  );
}
function text(node: Node): string {
  if ("value" in node) return node.value;
  if (hidden(node)) return "";
  return "childNodes" in node ? node.childNodes.map(text).join(" ") : "";
}
const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const hasNoindex = (value: string | null | undefined) => /\b(?:noindex|none)\b/i.test(value ?? "");
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
/** Parse the initial response as HTML; scripts are never executed or fetched. */
export function validatePublicPageResponse(
  target: PublicPageInspectionTarget,
  snapshot: PublicPageSnapshot,
  response: Readonly<{ status: number; headers: Headers; html: string }>,
): PublicPageInspection {
  const diagnostics: PublicPageDiagnostic[] = [];
  const fail = (code: string, field: string) => diagnostics.push({ code: `SEO_${code}`, field });
  const root = parse(response.html);
  const nodes = elements(root);
  const head = nodes.find((node) => node.tagName === "head");
  const headNodes = head ? elements(head) : [];
  const values = (tag: string, key: string, value: string, result: string) =>
    headNodes
      .filter((node) => node.tagName === tag && attr(node, key) === value)
      .map((node) => attr(node, result));
  const meta = (name: string) => values("meta", "name", name, "content");
  const status = snapshot.state === "published" ? 200 : snapshot.status;
  if (response.status !== status) fail("STATUS_MISMATCH", "status");
  if (snapshot.state !== "published") {
    if (snapshot.state === "redirect") {
      try {
        publicPageUrl(target.definition.origin, snapshot.location);
      } catch (error) {
        if (!(error instanceof PublicPageProblem)) throw error;
        fail("INVALID_SOURCE", error.reason);
      }
      if (response.headers.get("location") !== snapshot.location)
        fail("REDIRECT_MISMATCH", "location");
    }
    if (!hasNoindex(response.headers.get("x-robots-tag")) && !meta("robots").some(hasNoindex))
      fail("INDEXABILITY_MISMATCH", "robots");
    if (
      nodes.some(
        (node) => node.tagName === "script" && attr(node, "type") === "application/ld+json",
      )
    )
      fail("NONPUBLIC_STRUCTURED_DATA", "jsonLd");
    return {
      targetId: target.id,
      publication: snapshot.state,
      responseStatus: response.status,
      state: diagnostics.length ? "partial" : "ready",
      diagnostics,
    };
  }
  let metadata;
  try {
    metadata = resolvePublicPageMetadata(
      target.definition,
      new Request(target.requestUrl),
      snapshot,
    );
  } catch (error) {
    if (!(error instanceof PublicPageProblem)) throw error;
    fail("INVALID_SOURCE", error.reason);
    return {
      targetId: target.id,
      state: "partial",
      publication: snapshot.state,
      responseStatus: response.status,
      diagnostics,
    };
  }
  if (response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "text/html")
    fail("CONTENT_TYPE", "content-type");
  const titles = headNodes.filter((node) => node.tagName === "title");
  if (titles.length !== 1 || normalize(text(titles[0])) !== normalize(metadata.title))
    fail("TITLE_MISMATCH", "title");
  const check = (
    actual: readonly (string | undefined)[],
    expected: string,
    code: string,
    field: string,
  ) => {
    if (actual.length !== 1 || actual[0] !== expected) fail(code, field);
  };
  check(meta("description"), metadata.description, "DESCRIPTION_MISMATCH", "description");
  check(
    values("link", "rel", "canonical", "href"),
    metadata.canonical,
    "CANONICAL_MISMATCH",
    "canonical",
  );
  check(meta("robots"), metadata.robots, "INDEXABILITY_MISMATCH", "robots");
  if (snapshot.indexable && hasNoindex(response.headers.get("x-robots-tag")))
    fail("INDEXABILITY_MISMATCH", "robots");
  check(meta("croco:revision"), metadata.revision, "REVISION_MISMATCH", "revision");
  const htmlNode = nodes.find((node) => node.tagName === "html");
  if (!htmlNode || attr(htmlNode, "lang") !== metadata.lang) fail("LOCALE_MISMATCH", "lang");
  const actualAlternates = headNodes.filter(
    (node) =>
      node.tagName === "link" &&
      attr(node, "rel") === "alternate" &&
      attr(node, "hreflang") !== undefined,
  );
  if (
    actualAlternates.length !== metadata.alternates.length ||
    metadata.alternates.some(
      (alternate) =>
        actualAlternates.filter(
          (node) =>
            attr(node, "hreflang") === alternate.locale && attr(node, "href") === alternate.href,
        ).length !== 1,
    )
  )
    fail("ALTERNATE_MISMATCH", "hreflang");
  const body = nodes.find((node) => node.tagName === "body");
  const visible = normalize(body ? text(body) : "");
  if (!visible.includes(normalize(snapshot.content.description)))
    fail("BODY_DESCRIPTION_MISSING", "body");
  const bodyNodes = body ? visibleElements(body) : [];
  for (const link of snapshot.content.links) {
    if (
      !bodyNodes.some(
        (node) =>
          node.tagName === "a" &&
          attr(node, "href") === link.href &&
          normalize(text(node)) === normalize(link.label),
      )
    )
      fail("LINK_MISSING", "links");
  }
  const jsonNodes = nodes.filter(
    (node) => node.tagName === "script" && attr(node, "type") === "application/ld+json",
  );
  const raw = jsonNodes[0]?.childNodes.map((node) => ("value" in node ? node.value : "")).join("");
  try {
    const actual: unknown = JSON.parse(raw ?? "");
    // Schema and facts are generated from this exact source, never inferred from SEO-only claims.
    if (
      jsonNodes.length !== 1 ||
      !headNodes.includes(jsonNodes[0]) ||
      canonicalJson(actual) !== canonicalJson(JSON.parse(metadata.jsonLd))
    )
      fail("STRUCTURED_DATA_MISMATCH", "jsonLd");
  } catch {
    fail("INVALID_JSON_LD", "jsonLd");
  }
  if (target.definition.schema === "Product" && snapshot.content.product) {
    const price = bodyNodes.filter((node) => attr(node, "data-public-price") !== undefined);
    const availability = bodyNodes.filter(
      (node) => attr(node, "data-public-availability") !== undefined,
    );
    if (
      price.length !== 1 ||
      attr(price[0], "data-public-price") !== snapshot.content.product.price ||
      attr(price[0], "data-public-currency") !== snapshot.content.product.currency ||
      normalize(text(price[0])) !==
        `${snapshot.content.product.currency} ${snapshot.content.product.price}`
    )
      fail("BODY_PRICE_MISMATCH", "product.price");
    if (
      availability.length !== 1 ||
      attr(availability[0], "data-public-availability") !== snapshot.content.product.availability ||
      normalize(text(availability[0])) !== normalize(snapshot.content.product.availabilityLabel)
    )
      fail("BODY_AVAILABILITY_MISMATCH", "product.availability");
  }
  return {
    targetId: target.id,
    state: diagnostics.length ? "partial" : "ready",
    publication: snapshot.state,
    resourceId: snapshot.content.id,
    revision: snapshot.content.revision,
    responseStatus: response.status,
    diagnostics,
  };
}
/** Registered in-process targets avoid crawler DNS, redirect and cross-tenant URL expansion. */
export function createPublicPageInspector(
  options: Readonly<{
    targets: readonly PublicPageInspectionTarget[];
    authorize: (targetId: string) => Promise<boolean>;
  }>,
) {
  const targets = new Map(options.targets.map((target) => [target.id, target]));
  if (targets.size !== options.targets.length) throw new PublicPageProblem("duplicate-target");
  for (const target of targets.values()) {
    let url: URL;
    try {
      url = new URL(target.requestUrl);
    } catch {
      throw new PublicPageProblem("invalid-target");
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
      throw new PublicPageProblem("invalid-target");
  }
  return async (targetId: string): Promise<PublicPageInspection> => {
    const target = targets.get(targetId);
    const denied: PublicPageInspection = {
      targetId,
      state: "denied",
      diagnostics: [{ code: "SEO_TARGET_DENIED", field: "targetId" }],
    };
    if (!target) return denied;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new PublicPageProblem("inspection-timeout"));
      }, 5000);
    });
    const inspect = async (): Promise<PublicPageInspection> => {
      try {
        if (!(await options.authorize(targetId))) return denied;
      } catch {
        return {
          targetId,
          state: "unavailable",
          diagnostics: [{ code: "SEO_AUTHORIZATION_UNAVAILABLE", field: "authorization" }],
        };
      }
      if (controller.signal.aborted) throw new PublicPageProblem("inspection-timeout");

      const request = () =>
        new Request(target.requestUrl, { signal: controller.signal, redirect: "manual" });
      const snapshot = await target.definition.source.load(
        createPublicPageSourceRequest(target.definition, request()),
      );
      if (controller.signal.aborted) throw new PublicPageProblem("inspection-timeout");
      const response = await target.respond(request());
      const reader = response.body?.getReader();
      const cancel = () => {
        void reader?.cancel().catch(() => {});
      };
      controller.signal.addEventListener("abort", cancel, { once: true });
      if (controller.signal.aborted) cancel();
      let html = "";
      let size = 0;
      const decoder = new TextDecoder();
      try {
        if (reader)
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > 524288 || controller.signal.aborted)
              throw new PublicPageProblem("response-limit");
            html += decoder.decode(chunk.value, { stream: true });
          }
        html += decoder.decode();
      } finally {
        controller.signal.removeEventListener("abort", cancel);
        await reader?.cancel();
      }
      if (controller.signal.aborted) throw new PublicPageProblem("inspection-timeout");
      if (response.status >= 500)
        return {
          targetId,
          state: "unavailable",
          responseStatus: response.status,
          diagnostics: [{ code: "SEO_RESPONSE_UNAVAILABLE", field: "status" }],
        };
      return validatePublicPageResponse(target, snapshot, {
        status: response.status,
        headers: response.headers,
        html,
      });
    };
    try {
      return await Promise.race([inspect(), deadline]);
    } catch (cause) {
      if (
        cause instanceof PublicPageProblem &&
        !["inspection-timeout", "response-limit"].includes(cause.reason)
      )
        return {
          targetId,
          state: "partial",
          diagnostics: [{ code: "SEO_INVALID_SOURCE", field: "definition" }],
        };
      return {
        targetId,
        state: "unavailable",
        diagnostics: [{ code: "SEO_SOURCE_OR_RESPONSE_UNAVAILABLE", field: "target" }],
      };
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  };
}
export function formatPublicPageInspection(report: PublicPageInspection): string {
  return [
    `${report.targetId}: ${report.state}`,
    ...report.diagnostics.map((entry) => `${entry.code} (${entry.field})`),
  ].join("\n");
}
