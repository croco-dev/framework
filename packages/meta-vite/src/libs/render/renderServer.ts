import { createElement } from "react";
import { renderToString } from "react-dom/server";
import type { HeadMetadata } from "../routes/head";
import type { RenderRouteComponentProps, RenderRouteIR } from "../routes/types";
import type { RuntimeContext } from "./types";

const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
} as const;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
} as const;

const FALLBACK_HEAD_404: HeadMetadata = {
  title: "Not Found",
  description: "The requested page was not found",
};

const FALLBACK_HEAD_500: HeadMetadata = {
  title: "Internal Server Error",
  description: "An unexpected error occurred",
};

export class RenderServer {
  constructor(private readonly routes: RenderRouteIR[]) {}

  async handle(request: Request, context?: RuntimeContext): Promise<Response> {
    const route = this.findRoute(request);

    if (!route) {
      return this.createHtmlResponse("<h1>Not Found</h1>", 404, FALLBACK_HEAD_404);
    }

    if (route.mode === "rsc") {
      return this.handleRsc(route, request, context);
    }

    try {
      const module = await route.componentLoader();
      const props = this.createComponentProps(request, context);
      const html = renderToString(createElement(module.default, props));
      const headMetadata = route.head?.();

      return this.createHtmlResponse(html, 200, headMetadata);
    } catch {
      return this.createHtmlResponse("<h1>Internal Server Error</h1>", 500, FALLBACK_HEAD_500);
    }
  }

  private async handleRsc(
    route: RenderRouteIR,
    request: Request,
    context?: RuntimeContext,
  ): Promise<Response> {
    try {
      const module = await route.componentLoader();
      const props = this.createComponentProps(request, context);
      const html = renderToString(createElement(module.default, props));
      const flightPayload = JSON.stringify({
        nodeType: "rsc-flight",
        path: route.path,
        content: html,
      });
      const headMetadata = route.head?.();

      return this.createHtmlResponse(
        `${html}<script type="text/x-component">${flightPayload}</script>`,
        200,
        headMetadata,
      );
    } catch (error) {
      return this.createRscErrorResponse(error, route.path);
    }
  }

  private findRoute(request: Request): RenderRouteIR | undefined {
    const { pathname } = new URL(request.url);

    return this.routes.find((route) => route.path === pathname);
  }

  private createComponentProps(
    request: Request,
    context?: RuntimeContext,
  ): RenderRouteComponentProps {
    if (!context) {
      return { request };
    }

    return { request, context };
  }

  private createHtmlResponse(body: string, status: number, headMetadata?: HeadMetadata): Response {
    const shell = this.htmlShell(headMetadata, body);

    return new Response(shell, { status, headers: HTML_HEADERS });
  }

  private createRscErrorResponse(error: unknown, routePath: string): Response {
    const detail = error instanceof Error ? "An internal server error occurred" : String(error);

    return new Response(
      JSON.stringify({ error: "RSC rendering failed", route: routePath, detail }),
      {
        status: 500,
        headers: JSON_HEADERS,
      },
    );
  }

  private htmlShell(headMetadata: HeadMetadata | undefined, bodyHtml: string): string {
    const title = this.escapeHtml(headMetadata?.title ?? "Croco App");

    let metaTags = "";
    if (headMetadata?.description) {
      metaTags += `\n    <meta name="description" content="${this.escapeHtml(headMetadata.description)}">`;
    }
    if (headMetadata?.canonical) {
      metaTags += `\n    <link rel="canonical" href="${this.escapeHtml(headMetadata.canonical)}">`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>${metaTags}
  </head>
  <body>
    <div id="root">${bodyHtml}</div>
  </body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");
  }
}
