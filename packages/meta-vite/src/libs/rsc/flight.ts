import { Problem, ProblemCategory } from "@croco/problems-core";
import type { HeadMetadata } from "../routes/head";
import type { RenderRouteComponentProps, RenderRouteIR } from "../routes/types";
import type { RuntimeContext } from "../render/types";

export const RSC_FLIGHT_CONTENT_TYPE = "text/x-component" as const;

export const RSC_FLIGHT_VERSION = "croco.meta-vite.rsc-flight.v1" as const;

export const RSC_CLIENT_MANIFEST_VERSION = "croco.meta-vite.rsc-client-manifest.v1" as const;

/**
 * Element id of the JSON block `createRscHtmlShell` writes, carrying the
 * manifest version the document was rendered with.
 */
export const RSC_MANIFEST_ELEMENT_ID = "croco-rsc-manifest" as const;

/**
 * Name of the file `crocoMetaVitePlugin` writes into the client build output.
 * It records the client build id so a server can learn which client build it
 * serves without re-deriving a hash itself.
 */
export const RSC_CLIENT_BUILD_FILE = "croco-rsc-client-build.json" as const;

/**
 * Client manifest version for one client build. The protocol constant alone
 * only separates framework generations: a browser holding HTML that was
 * rendered for an older client bundle would still be accepted, then decode
 * payloads whose references it cannot resolve. Appending the build id makes
 * that mismatch explicit instead of surfacing as a broken tree.
 */
export function composeRscClientManifestVersion(clientBuildId: string): string {
  // The value travels as an HTTP header, so it is restricted to token-safe
  // characters; anything else could not be echoed back and would only fail
  // later inside `Headers.set`.
  if (!/^[A-Za-z0-9._-]+$/.test(clientBuildId)) {
    throw new RscClientBuildIdProblem(clientBuildId);
  }

  return `${RSC_CLIENT_MANIFEST_VERSION}.${clientBuildId}`;
}

export class RscClientBuildIdProblem extends Problem {
  readonly code = "meta-vite/rsc-client-build-id-invalid";
  readonly category = ProblemCategory.BadRequest;

  constructor(clientBuildId: string) {
    super(
      "meta-vite/rsc-client-build-id-invalid",
      ProblemCategory.BadRequest,
      "The RSC client build id may only contain letters, digits, dot, underscore, and dash",
      { extensions: { clientBuildId } },
    );
  }
}

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
  /**
   * Identifier of the client build this server renders for. When given, the
   * negotiated manifest version is `composeRscClientManifestVersion(buildId)`
   * instead of the bare protocol constant.
   */
  readonly clientBuildId?: string;
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

  // A Flight request without the header is just as ambiguous as one carrying a
  // stale value: both mix client and server manifests. `RscClientManifestMismatchProblem`
  // reports the missing header as `received: "missing"`.
  if (flight.clientManifestVersion !== expectedVersion) {
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
  // An explicit version wins: an app that composes its own build identifier
  // (or pins a protocol generation) must not have it recomputed.
  return (
    options.clientManifestVersion ??
    (options.clientBuildId
      ? composeRscClientManifestVersion(options.clientBuildId)
      : RSC_CLIENT_MANIFEST_VERSION)
  );
}

/**
 * The document lookups `createRscBrowserFlightHeaders` needs. Declared
 * structurally so the browser path can be tested without a DOM
 * implementation.
 */
export type RscManifestDocument = {
  getElementById(id: string): { textContent: string | null } | null;
  querySelector(selector: string): { getAttribute(name: string): string | null } | null;
  location?: { pathname: string };
};

/**
 * Headers a browser sends when it fetches a Flight node for the document it is
 * already running. The server embeds the version its HTML was rendered for, so
 * the browser echoes that value instead of guessing: requesting without it is
 * rejected exactly like a mismatched value.
 */
export function createRscBrowserFlightHeaders(doc?: RscManifestDocument): HeadersInit {
  const documentRef = doc ?? (typeof document === "undefined" ? undefined : document);
  const route = documentRef?.location?.pathname ?? "<document>";
  const manifestVersion = documentRef ? readRscClientManifestVersion(documentRef) : null;

  if (manifestVersion === null) {
    // Without the value the document carries there is nothing to send back,
    // and the server would reject the request as `received: "missing"`.
    throw new RscClientManifestMismatchProblem(route, RSC_CLIENT_MANIFEST_VERSION, null);
  }

  return {
    accept: RSC_FLIGHT_CONTENT_TYPE,
    ["x-croco-rsc-client-manifest"]: manifestVersion,
  };
}

/**
 * Reads the client manifest version the server rendered the current document
 * with. The JSON block is authoritative because `createRscHtmlShell` writes it
 * verbatim; the meta tag is the fallback for hosts that render only that.
 */
export function readRscClientManifestVersion(doc: RscManifestDocument): string | null {
  const manifestElement = doc.getElementById(RSC_MANIFEST_ELEMENT_ID);
  if (manifestElement?.textContent) {
    let manifestVersion: unknown;
    try {
      manifestVersion = (
        JSON.parse(manifestElement.textContent) as { clientManifestVersion?: unknown }
      ).clientManifestVersion;
    } catch {
      // A damaged block is not a reason to fail the refresh: the meta tag the
      // same document carries is read instead.
      return readMetaManifestVersion(doc);
    }

    if (typeof manifestVersion === "string" && manifestVersion.length > 0) {
      return manifestVersion;
    }
  }

  return readMetaManifestVersion(doc);
}

function readMetaManifestVersion(doc: RscManifestDocument): string | null {
  const meta = doc.querySelector('meta[name="croco:rsc-client-manifest"]');
  const content = meta?.getAttribute("content");

  // The HTML parser already decodes character references in an attribute
  // value, so `getAttribute` hands back the version the server wrote.
  // Unescaping here would decode a second time and break any version whose
  // text still contains an entity-looking sequence.
  return content && content.length > 0 ? content : null;
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
    <script type="application/json" id="${RSC_MANIFEST_ELEMENT_ID}">${serializeRscManifestJson({
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

function serializeRscManifestJson(value: unknown): string {
  // `JSON.stringify` escapes quotes and control characters but leaves `<`
  // alone, so a manifest version containing `</script>` would close the
  // element early and let the rest of the page be read as JSON. Escaping `<`
  // keeps the payload inside the script element.
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function escapeRscHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
