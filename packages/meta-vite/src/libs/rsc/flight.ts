import { Problem, ProblemCategory } from "@croco/problems-core";
import type { HeadMetadata } from "../routes/head";
import type { RenderRouteComponentProps, RenderRouteIR } from "../routes/types";
import type { RuntimeContext } from "../render/types";
import type { RscBuild } from "./buildEntry";

export const RSC_FLIGHT_CONTENT_TYPE = "text/x-component" as const;

export const RSC_FLIGHT_VERSION = "croco.meta-vite.rsc-flight.v1" as const;

export const RSC_CLIENT_MANIFEST_VERSION = "croco.meta-vite.rsc-client-manifest.v1" as const;

/**
 * Request header a client echoes the manifest version of the document it is
 * running in. Negotiation is refused when the value is missing or belongs to a
 * different client build, and the Flight response varies on it so a shared
 * cache cannot reuse one build's payload for another.
 */
export const RSC_CLIENT_MANIFEST_HEADER = "x-croco-rsc-client-manifest" as const;

/**
 * Element id of the JSON block `createRscHtmlShell` writes, carrying the
 * manifest version the document was rendered with.
 */
export const RSC_MANIFEST_ELEMENT_ID = "croco-rsc-manifest" as const;

/**
 * Attribute of the JSON blocks that carry the Flight payload a document is
 * rendered from. The blocks are written between HTML chunks while both
 * stream, so the browser hydrates the shell from the same bytes before late
 * Suspense boundaries resolve, without fetching the route a second time.
 */
export const RSC_INITIAL_FLIGHT_ATTRIBUTE = "data-croco-rsc-flight" as const;

/** `<meta>` name a document uses to say that its Flight payload streams with it. */
export const RSC_INITIAL_FLIGHT_META_NAME = "croco:rsc-initial-flight" as const;

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

/**
 * The document's streamed Flight payload cannot be read to its end: the
 * document finished loading before the block that ends it (`ended-early`, the
 * response was cut off mid-render), or a block is not a base64 JSON string
 * (`unreadable-block`).
 */
export class RscInitialFlightIncompleteProblem extends Problem {
  readonly code = "meta-vite/rsc-initial-flight-incomplete";
  readonly category = ProblemCategory.InternalServerError;

  constructor(blocksRead: number, reason: "ended-early" | "unreadable-block") {
    super(
      "meta-vite/rsc-initial-flight-incomplete",
      ProblemCategory.InternalServerError,
      "The document's streamed Flight payload could not be read to its end",
      { extensions: { blocksRead, reason } },
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

export type RscEncoderRenderOptions = {
  readonly encodeFlight?: RscFlightEncoder;
  readonly clientManifestVersion?: string;
  /**
   * Identifier of the client build this server renders for. Used only when
   * `clientManifestVersion` is not given: the negotiated manifest version
   * becomes `composeRscClientManifestVersion(buildId)` instead of the bare
   * protocol constant. When both options are set, the explicit
   * `clientManifestVersion` wins.
   */
  readonly clientBuildId?: string;
  readonly build?: never;
};

export type RscBuildRenderOptions = {
  /**
   * A production build from `loadRscBuild()`. RSC routes render in the
   * build's worker thread through the built `rsc` and `ssr` entries, and the
   * document loads the build's client entry, so the runtime context must be
   * plain data. The build also fixes the client manifest version, so the
   * encoder options cannot be combined with it.
   */
  readonly build: RscBuild;
  readonly encodeFlight?: never;
  readonly clientManifestVersion?: never;
  readonly clientBuildId?: never;
};

export type RscRenderOptions = RscEncoderRenderOptions | RscBuildRenderOptions;

export function parseRscFlightRequest(request: Request): RscFlightRequest {
  const url = new URL(request.url);
  const accept = request.headers.get("accept") ?? "";

  return {
    wantsFlight:
      url.pathname.endsWith(".rsc") ||
      accept.includes(RSC_FLIGHT_CONTENT_TYPE) ||
      url.searchParams.get("flight") === "1",
    clientManifestVersion: request.headers.get(RSC_CLIENT_MANIFEST_HEADER),
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
    options.build?.clientManifestVersion ??
    options.clientManifestVersion ??
    (options.clientBuildId
      ? composeRscClientManifestVersion(options.clientBuildId)
      : RSC_CLIENT_MANIFEST_VERSION)
  );
}

/**
 * The element lookup `createRscBrowserFlightHeaders` needs. Declared
 * structurally so the browser path can be tested without a DOM
 * implementation.
 */
export type RscManifestElement = {
  getAttribute(name: string): string | null;
};

/**
 * The document lookups `createRscBrowserFlightHeaders` needs. Declared
 * structurally so the browser path can be tested without a DOM
 * implementation.
 */
export type RscManifestDocument = {
  getElementById(id: string): { textContent: string | null } | null;
  querySelector(selector: string): RscManifestElement | null;
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
    [RSC_CLIENT_MANIFEST_HEADER]: manifestVersion,
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

/**
 * The Flight payload the current document is rendered from, as the stream the
 * official browser decoder reads. The stream yields each block as soon as the
 * parser has it, so the shell can hydrate while later rows are still on their
 * way, and closes at the block that ends the payload. Returns null when the
 * document carries no streamed payload; the caller then fetches the route's
 * Flight representation instead.
 */
export function readRscInitialFlight(doc?: Document): ReadableStream<Uint8Array> | null {
  const documentRef = doc ?? (typeof document === "undefined" ? undefined : document);
  const marker = documentRef?.querySelector(`meta[name="${RSC_INITIAL_FLIGHT_META_NAME}"]`);
  if (!documentRef || marker?.getAttribute("content") !== "streamed") {
    return null;
  }

  // Blocks are tracked by identity, not by position: when a hydration mismatch
  // makes React re-render the root, it empties `#root`, which removes the
  // blocks already read, and the parser keeps appending later ones there.
  const read = new WeakSet<Element>();
  let waiting: Element | undefined;
  let blocksRead = 0;
  let finished = false;
  let stop = (): void => undefined;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const watch = { childList: true, subtree: true, characterData: true };
      const observer = new MutationObserver(() => drain());
      const finish = (error?: RscInitialFlightIncompleteProblem): void => {
        finished = true;
        stop();
        if (error) {
          controller.error(error);
        } else {
          controller.close();
        }
      };
      const drainBlocks = (): void => {
        const unread = Array.from(
          documentRef.querySelectorAll(`script[${RSC_INITIAL_FLIGHT_ATTRIBUTE}]`),
        ).filter((block) => !read.has(block) && block !== waiting);
        for (const block of waiting ? [waiting, ...unread] : unread) {
          const result = readFlightBlock(block);
          if (result.kind === "pending") {
            // The block is watched on its own too: if React empties `#root`
            // before the parser finishes it, its text still arrives, but no
            // longer inside the observed document.
            if (waiting !== block) {
              observer.observe(block, watch);
            }
            waiting = block;
            return;
          }
          waiting = undefined;
          read.add(block);
          if (result.kind !== "chunk") {
            finish(
              result.kind === "end"
                ? undefined
                : new RscInitialFlightIncompleteProblem(blocksRead, "unreadable-block"),
            );
            return;
          }
          blocksRead += 1;
          controller.enqueue(result.bytes);
        }
      };
      const drain = (): void => {
        if (finished) {
          return;
        }
        drainBlocks();
        if (!finished && documentRef.readyState !== "loading") {
          // The document ended without the block that closes the payload: the
          // response was cut off, so late boundaries would wait forever.
          finish(new RscInitialFlightIncompleteProblem(blocksRead, "ended-early"));
        }
      };
      observer.observe(documentRef, watch);
      documentRef.addEventListener("DOMContentLoaded", drain);
      stop = () => {
        observer.disconnect();
        documentRef.removeEventListener("DOMContentLoaded", drain);
      };
      drain();
    },
    cancel() {
      finished = true;
      stop();
    },
  });
}

type FlightBlock =
  | { readonly kind: "pending" | "end" | "unreadable" }
  | { readonly kind: "chunk"; readonly bytes: Uint8Array };

function readFlightBlock(block: Element): FlightBlock {
  // The parser may hand over a block before all of its text arrived. A payload
  // is complete only once its closing quote (or `null`) is in.
  const text = block.textContent ?? "";
  if (block.getAttribute(RSC_INITIAL_FLIGHT_ATTRIBUTE) === "end") {
    return { kind: text === "null" ? "end" : "pending" };
  }
  if (text.length < 2 || !text.startsWith('"') || !text.endsWith('"')) {
    return { kind: "pending" };
  }
  try {
    return { kind: "chunk", bytes: decodeBase64(JSON.parse(text) as string) };
  } catch {
    // A complete block that is not a base64 JSON string cannot be decoded, and
    // skipping it would hand the decoder a stream with bytes missing.
    return { kind: "unreadable" };
  }
}

function decodeBase64(payload: string): Uint8Array {
  return Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
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
  headers.set(RSC_CLIENT_MANIFEST_HEADER, manifestVersion);
  // The payload is only decodable by the client build the manifest version
  // names, and the same URL answers HTML or Flight. Both conditions vary, so a
  // shared cache must key on both: without them it can serve a Flight body to
  // a document request or reuse one build's payload for another build, which
  // is exactly the mismatch this handshake refuses.
  headers.set("vary", `Accept, ${RSC_CLIENT_MANIFEST_HEADER}`);

  return headers;
}

export type RscHtmlShellOptions = {
  /** The body carries its Flight payload as streamed blocks (`readRscInitialFlight`). */
  readonly streamedFlight?: boolean;
};

export function createRscHtmlShell(
  headMetadata: HeadMetadata | undefined,
  html: string,
  manifestVersion: string,
  options: RscHtmlShellOptions = {},
): string {
  const title = escapeRscHtml(headMetadata?.title ?? "Croco App");

  let metaTags = "";
  if (headMetadata?.description) {
    metaTags += `\n    <meta name="description" content="${escapeRscHtml(headMetadata.description)}">`;
  }
  if (headMetadata?.ogTitle) {
    metaTags += `\n    <meta property="og:title" content="${escapeRscHtml(headMetadata.ogTitle)}">`;
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
    <meta name="croco:rsc-client-manifest" content="${escapeRscHtml(manifestVersion)}">${
      options.streamedFlight
        ? `\n    <meta name="${RSC_INITIAL_FLIGHT_META_NAME}" content="streamed">`
        : ""
    }
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
