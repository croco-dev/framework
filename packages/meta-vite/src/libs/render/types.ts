/**
 * Provider-specific runtime context.
 * Each provider adapter fills only the fields available for that runtime.
 * Render core must guard before accessing optional fields.
 */
export type RuntimeContext = {
  platform: 'cloudflare' | 'lambda' | 'node';
  env?: unknown;
  executionContext?: unknown;
  event?: unknown;
  lambdaContext?: unknown;
};

/**
 * Core fetch handler type.
 * Web Fetch API `Request -> Response`, Hono-free.
 */
export type CrocoFetchHandler = (request: Request, context?: RuntimeContext) => Promise<Response>;

/**
 * API handler result type.
 * `{ handled: true; response: Response }` — API handler claimed the request.
 *  { handled: false } — API handler declined, page fallback MAY proceed.
 */
export type CrocoApiHandlerResult = { handled: true; response: Response } | { handled: false };
