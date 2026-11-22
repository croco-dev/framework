import { Problem, ProblemCategory } from "@croco/problems-core";
import type { HeadMetadata } from "../routes/head";
import type { RenderRouteIR } from "../routes/types";
import type { RuntimeContext } from "../render/types";

/**
 * The host routed a request to a path the built `rsc` entry does not declare.
 * Host routes and the build drifted apart, which no request can repair.
 */
export class RscRouteNotInBuildProblem extends Problem {
  readonly code = "meta-vite/rsc-route-not-in-build";
  readonly category = ProblemCategory.InternalServerError;

  constructor(route: string) {
    super(
      "meta-vite/rsc-route-not-in-build",
      ProblemCategory.InternalServerError,
      `RSC route '${route}' is not declared by the built rsc entry`,
      { extensions: { route } },
    );
  }
}

/**
 * Marks the default export of a built `rsc` entry. The host refuses any other
 * module shape, so a stale or hand-written entry fails at startup instead of
 * on the first request.
 */
export const RSC_SERVER_ENTRY_VERSION = "croco.meta-vite.rsc-server-entry.v1" as const;

/** Marks the default export of a built `ssr` entry. */
export const RSC_SSR_ENTRY_VERSION = "croco.meta-vite.rsc-ssr-entry.v1" as const;

/** The route metadata the host reads from a built `rsc` entry. */
export type RscBuildRoute = {
  readonly path: string;
  readonly head?: () => HeadMetadata;
};

export type RscFlightRenderInput = {
  /** Path of the route the host matched; the entry renders that route only. */
  readonly route: string;
  readonly request: Request;
  /**
   * The context the host resolved for this request. It crosses into the
   * build's worker thread, so it holds plain data only.
   */
  readonly context?: RuntimeContext;
  /** Aborts the Flight render when the caller disconnects. */
  readonly signal: AbortSignal;
};

export type RscServerActionOptions = {
  /** URL, method and headers of the request the host received. */
  readonly request: Request;
  readonly context?: RuntimeContext;
};

/**
 * Server work that must share module state with rendering, such as a cache the
 * rendered page fills. Input must be plain data; the result is structured-cloned
 * back to the host, so return plain data.
 */
export type RscServerAction = (input: unknown, options: RscServerActionOptions) => unknown;

export type RscServerEntry = {
  readonly version: typeof RSC_SERVER_ENTRY_VERSION;
  readonly routes: readonly RscBuildRoute[];
  readonly renderFlight: (input: RscFlightRenderInput) => ReadableStream<Uint8Array>;
  readonly actions?: Readonly<Record<string, RscServerAction>>;
};

export type RscHtmlRenderInput = {
  readonly flight: ReadableStream<Uint8Array>;
  readonly signal: AbortSignal;
};

export type RscSsrEntry = {
  readonly version: typeof RSC_SSR_ENTRY_VERSION;
  /** Browser URL of the client entry this SSR build was compiled against. */
  readonly clientEntryUrl: string;
  readonly renderHtml: (input: RscHtmlRenderInput) => Promise<ReadableStream<Uint8Array>>;
};

/** One render the host asks a build for. */
export type RscRenderRequest = {
  /** Path of the route the host matched. */
  readonly route: string;
  /** The page request; URL, method and headers reach the server component, the body does not. */
  readonly request: Request;
  /** Plain data only: anything else is refused before the render starts. */
  readonly context?: RuntimeContext;
  /** Stops the render in the build's worker when it aborts. */
  readonly signal: AbortSignal;
};

export type RscDocumentRender = {
  readonly html: ReadableStream<Uint8Array>;
  /** The Flight bytes the HTML was rendered from, base64-encoded, available once the HTML ends. */
  readonly embeddedFlight: () => Promise<string>;
};

/**
 * A validated production build, loaded into a worker thread of its own. Each
 * build has its own module state, so builds of different apps can run in one
 * process without resolving each other's modules.
 */
export type RscBuild = {
  /** One `rsc`-mode route per route the built `rsc` entry declares. */
  readonly routes: readonly RenderRouteIR[];
  readonly clientManifestVersion: string;
  readonly clientEntryUrl: string;
  /** Absolute path of the client build output (`<outDir>/client`). */
  readonly clientDir: string;
  /** Names of the actions the built `rsc` entry declares. */
  readonly actions: readonly string[];
  readonly renderFlight: (input: RscRenderRequest) => ReadableStream<Uint8Array>;
  /** Resolves once the document shell can render, so early failures can still set the status. */
  readonly renderDocument: (input: RscRenderRequest) => Promise<RscDocumentRender>;
  readonly invokeAction: (
    name: string,
    input: unknown,
    options: RscServerActionOptions,
  ) => Promise<unknown>;
  /** Stops the worker; renders still in flight fail instead of hanging. */
  readonly close: () => Promise<void>;
  /**
   * Settles with the reason once the worker stops, whether it exited or was
   * closed. The build cannot render after that, so a server should exit and
   * let its supervisor start a fresh one.
   */
  readonly closed: Promise<Problem>;
};
