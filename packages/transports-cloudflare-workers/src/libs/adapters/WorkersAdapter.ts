import type { ExecutionContext } from "@cloudflare/workers-types";
import type { CrocoApp } from "@croco/transports-http";
import type { CloudflareEnv, WorkersFetchHandler, WorkersHandlerOptions } from "../types";

export function toWorkersHandler(
  app: CrocoApp,
  options: WorkersHandlerOptions = {},
): WorkersFetchHandler {
  const { injectEnv = false } = options;

  return {
    async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
      if (injectEnv) {
        return app.getHono().fetch(request, env, ctx);
      }

      return app.fetch(request);
    },
  };
}
