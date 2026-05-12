import type { RuntimeContext } from "../render/types";
import type { HeadMetadata } from "./head";

/**
 * Render mode for each page route.
 * - ssr: server-side render every request (default)
 * - ssg: static site generation (pre-rendered at build)
 * - isr: incremental static regeneration (TTL-based revalidation)
 * - rsc: React Server Components (streaming RSC payload)
 */
export type RenderMode = "ssr" | "ssg" | "isr" | "rsc";

/**
 * Page route definition accepted by defineRoute().
 */
export type PageRouteDefinition = {
  path: string;
  component: React.ComponentType<RenderRouteComponentProps>;
  mode?: RenderMode;
  revalidate?: number;
  head?: () => HeadMetadata;
};

/**
 * Internal page route IR (intermediate representation).
 * Normalized from PageRouteDefinition by route compiler.
 */
export type PageRouteIR = {
  path: string;
  componentRef: string;
  mode: RenderMode;
  revalidateMs?: number;
  head?: () => HeadMetadata;
};

/**
 * Internal render route IR.
 * Combines page IR with resolved module references for the render core.
 */
export type RenderRouteIR = {
  path: string;
  mode: RenderMode;
  componentLoader: () => Promise<{ default: React.ComponentType<RenderRouteComponentProps> }>;
  head?: () => HeadMetadata;
  revalidateMs?: number;
};

export type RenderRouteComponentProps = {
  readonly request: Request;
  readonly context?: RuntimeContext;
};

/**
 * HTTP methods supported by API routes.
 */
export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * API route definition accepted by defineApiRoute().
 */
export type ApiRouteDefinition = {
  path: string;
  method?: ApiMethod;
  handler: (request: Request) => Promise<Response>;
};

/**
 * Internal API route IR (intermediate representation).
 */
export type ApiRouteIR = {
  path: string;
  method?: ApiMethod;
  handler: (request: Request) => Promise<Response>;
};
