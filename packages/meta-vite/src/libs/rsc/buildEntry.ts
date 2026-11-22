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
   * The context the host resolved for this request. It is passed in process,
   * so live host values reach the server component unchanged.
   */
  readonly context?: RuntimeContext;
  /** Aborts the Flight render when the caller disconnects. */
  readonly signal: AbortSignal;
};

export type RscServerEntry = {
  readonly version: typeof RSC_SERVER_ENTRY_VERSION;
  readonly routes: readonly RscBuildRoute[];
  readonly renderFlight: (input: RscFlightRenderInput) => ReadableStream<Uint8Array>;
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

/**
 * A validated production build: the built `rsc` and `ssr` entries loaded into
 * this process, plus the client build they were compiled against.
 */
export type RscBuild = {
  /** One `rsc`-mode route per route the built `rsc` entry declares. */
  readonly routes: readonly RenderRouteIR[];
  readonly clientManifestVersion: string;
  readonly clientEntryUrl: string;
  /** Absolute path of the client build output (`<outDir>/client`). */
  readonly clientDir: string;
  readonly server: RscServerEntry;
  readonly ssr: RscSsrEntry;
};

export function isRscServerEntry(value: unknown): value is RscServerEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Partial<Record<keyof RscServerEntry, unknown>>;
  return (
    entry.version === RSC_SERVER_ENTRY_VERSION &&
    Array.isArray(entry.routes) &&
    typeof entry.renderFlight === "function"
  );
}

export function isRscSsrEntry(value: unknown): value is RscSsrEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Partial<Record<keyof RscSsrEntry, unknown>>;
  return (
    entry.version === RSC_SSR_ENTRY_VERSION &&
    typeof entry.clientEntryUrl === "string" &&
    typeof entry.renderHtml === "function"
  );
}
