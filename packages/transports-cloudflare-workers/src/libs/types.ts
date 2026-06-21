import type { ExecutionContext } from "@cloudflare/workers-types";

export type CloudflareEnv = Record<string, unknown>;

export type WorkersHandlerOptions = {
  /** Whether to inject Cloudflare `env` into FrameworkContext. Default: false. */
  injectEnv?: boolean;
};

export type WorkersFetchHandler = {
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response>;
};
