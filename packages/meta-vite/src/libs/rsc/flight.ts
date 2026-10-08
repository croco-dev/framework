import { Problem, ProblemCategory } from "@croco/problems-core";
import type { HeadMetadata } from "../routes/head";
import type { RenderRouteComponentProps, RenderRouteIR } from "../routes/types";
import type { RuntimeContext } from "../render/types";

export const RSC_FLIGHT_CONTENT_TYPE = "text/x-component" as const;

export const RSC_FLIGHT_VERSION = "croco.meta-vite.rsc-flight.v1" as const;

export const RSC_CLIENT_MANIFEST_VERSION = "croco.meta-vite.rsc-client-manifest.v1" as const;

export class RscFlightNotAcceptableProblem extends Problem {
  readonly code = "meta-vite/rsc-flight-not-acceptable";
  readonly category = ProblemCategory.NotImplemented;

  constructor(route: string) {
    super(
      "meta-vite/rsc-flight-not-acceptable",
      ProblemCategory.NotImplemented,
      `Route '${route}' requires a React Flight encoder; the current runtime has none configured`,
      { extensions: { route } },
    );
  }
}

export class RscClientManifestMismatchProblem extends Problem {
  readonly code = "meta-vite/rsc-client-manifest-mismatch";
  readonly category = ProblemCategory.BadRequest;

  constructor(route: string, expected: string, received: string | null) {
    super(
      "meta-vite/rsc-client-manifest-mismatch",
      ProblemCategory.BadRequest,
      `Route '${route}' refused a Flight request with a mismatched client manifest version`,
      { extensions: { route, expected, received: received ?? "missing" } },
    );
  }
}

export class RscServerReferenceNotSupportedProblem extends Problem {
  readonly code = "meta-vite/rsc-server-reference-unsupported";
  readonly category = ProblemCategory.NotImplemented;

  constructor(route: string, reference: string, detail?: string) {
    super(
      "meta-vite/rsc-server-reference-unsupported",
      ProblemCategory.NotImplemented,
      detail ??
        `Route '${route}' does not support Flight server reference '${reference}'; call the registered Server Action endpoint instead`,
      { extensions: { route, reference } },
    );
  }
}

export class RscClientReferenceMissingProblem extends Problem {
  readonly code = "meta-vite/rsc-client-reference-missing";
  readonly category = ProblemCategory.BadRequest;

  constructor(route: string, reference: string) {
    super(
      "meta-vite/rsc-client-reference-missing",
      ProblemCategory.BadRequest,
      `Route '${route}' decoded a Flight client reference '${reference}' with no matching browser module loaded`,
      { extensions: { route, reference } },
    );
  }
}

export type RscFlightEncoder = (
  route: RenderRouteIR,
  request: Request,
  context?: RuntimeContext,
) => Promise<ReadableStream<Uint8Array>>;

export type RscFlightRequest = {
  readonly wantsFlight: boolean;
  readonly clientManifestVersion: string | null;
  readonly serverReference: string | null;
};

export type RscRenderOptions = {
  readonly encodeFlight?: RscFlightEncoder;
  readonly clientManifestVersion?: string;
};

export function parseRscFlightRequest(request: Request): RscFlightRequest {
  const url = new URL(request.url);
  const accept = request.headers.get("accept") ?? "";

  return {
    wantsFlight:
      url.pathname.endsWith(".rsc") ||
      accept.includes(RSC_FLIGHT_CONTENT_TYPE) ||
      url.searchParams.get("flight") === "1",
    clientManifestVersion: request.headers.get("x-croco-rsc-client-manifest"),
    serverReference: url.searchParams.get("serverReference"),
  };
}

export function isRscRoute(route: RenderRouteIR): boolean {
  return route.mode === "rsc";
}

export function assertRscClientManifestVersion(
  route: RenderRouteIR,
  flight: RscFlightRequest,
  expectedVersion: string,
): void {
  if (!flight.wantsFlight) {
    return;
  }

  if (flight.clientManifestVersion !== null && flight.clientManifestVersion !== expectedVersion) {
    throw new RscClientManifestMismatchProblem(
      route.path,
      expectedVersion,
      flight.clientManifestVersion,
    );
  }
}

export function assertRscServerReferenceUnsupported(
  route: RenderRouteIR,
  flight: RscFlightRequest,
): void {
  if (flight.serverReference !== null) {
    throw new RscServerReferenceNotSupportedProblem(route.path, flight.serverReference);
  }
}

export function resolveRscClientManifestVersion(options: RscRenderOptions): string {
  return options.clientManifestVersion ?? RSC_CLIENT_MANIFEST_VERSION;
}

export function createRscFlightHeaders(manifestVersion: string): Headers {
  const headers = new Headers();

  headers.set("content-type", `${RSC_FLIGHT_CONTENT_TYPE}; charset=utf-8`);
  headers.set("x-croco-rsc-flight-version", RSC_FLIGHT_VERSION);
  headers.set("x-croco-rsc-client-manifest", manifestVersion);
  headers.set("vary", "Accept");

  return headers;
}

export function createRscHtmlShell(
  headMetadata: HeadMetadata | undefined,
  html: string,
  manifestVersion: string,
): string {
  const title = escapeRscHtml(headMetadata?.title ?? "Croco App");

  let metaTags = "";
  if (headMetadata?.description) {
    metaTags += `\n    <meta name="description" content="${escapeRscHtml(headMetadata.description)}">`;
  }
  if (headMetadata?.canonical) {
    metaTags += `\n    <link rel="canonical" href="${escapeRscHtml(headMetadata.canonical)}">`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>${metaTags}
    <meta name="croco:rsc-flight-version" content="${escapeRscHtml(RSC_FLIGHT_VERSION)}">
    <meta name="croco:rsc-client-manifest" content="${escapeRscHtml(manifestVersion)}">
  </head>
  <body>
    <div id="root">${html}</div>
    <script type="application/json" id="croco-rsc-manifest">${JSON.stringify({
      flightVersion: RSC_FLIGHT_VERSION,
      clientManifestVersion: manifestVersion,
    })}</script>
  </body>
</html>`;
}

export function createRscComponentProps(
  request: Request,
  context: RuntimeContext | undefined,
): RenderRouteComponentProps {
  if (!context) {
    return { request };
  }

  return { request, context };
}

function escapeRscHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
