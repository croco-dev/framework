import type { ExecutionContext } from "@cloudflare/workers-types";

export type CloudflareEnv = Record<string, unknown>;

export type WorkersHandlerOptions = {
  /** env를 FrameworkContext에 주입할지 여부 (기본: false) */
  injectEnv?: boolean;
};

export type WorkersFetchHandler = {
  fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response>;
};
