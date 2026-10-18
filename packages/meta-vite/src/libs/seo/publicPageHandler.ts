import {
  createPublicPageSourceRequest,
  resolvePublicPageMetadata,
  PublicPageProblem,
  publicPageUrl,
} from "@croco/seo-core";
import type { PublicPageContent, PublicPageDefinition } from "@croco/seo-core";
import { createElement } from "react";
import type { ComponentType } from "react";
import { RenderServer } from "../render/renderServer";
import type { CrocoFetchHandler } from "../render/types";

/** Buffered SSR: resolve access/publication and public facts before any headers commit. */
export function createPublicPageHandler(
  options: Readonly<{
    definition: PublicPageDefinition;
    component: ComponentType<{ content: PublicPageContent }>;
  }>,
): CrocoFetchHandler {
  const { definition, component } = options;
  publicPageUrl(definition.origin, "/");
  return async (request, context) => {
    const headers = { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" };
    if (!["GET", "HEAD"].includes(request.method))
      return new Response(null, { status: 405, headers: { ...headers, allow: "GET, HEAD" } });
    try {
      const snapshot = await definition.source.load(
        createPublicPageSourceRequest(definition, request),
      );
      if (snapshot.state !== "published") {
        const allowedStatuses = {
          draft: [404],
          missing: [404],
          private: [401, 403, 404],
          deleted: [404, 410],
          redirect: [301, 302, 307, 308],
        };
        if (!allowedStatuses[snapshot.state]?.includes(snapshot.status))
          throw new PublicPageProblem("invalid-publication-status");
        if (snapshot.state === "redirect") {
          // Public redirects are same-origin paths. No preview/session URL forwarding.
          publicPageUrl(definition.origin, snapshot.location);
          return new Response(null, {
            status: snapshot.status,
            headers: { ...headers, location: snapshot.location },
          });
        }
        return new Response(null, { status: snapshot.status, headers });
      }
      const metadata = resolvePublicPageMetadata(definition, request, snapshot);
      const server = new RenderServer([
        {
          path: new URL(request.url).pathname,
          mode: "ssr",
          componentLoader: async () => ({
            default: () => createElement(component, { content: snapshot.content }),
          }),
          head: () => ({ ...metadata, publicPage: metadata }),
        },
      ]);
      const response = await server.handle(request, context);
      response.headers.set("cache-control", "private, no-store");
      if (response.status !== 200) response.headers.set("x-robots-tag", "noindex, nofollow");
      return request.method === "HEAD"
        ? new Response(null, { status: response.status, headers: response.headers })
        : response;
    } catch (cause) {
      return new Response(null, {
        status: cause instanceof PublicPageProblem ? 422 : 503,
        headers,
      });
    }
  };
}
