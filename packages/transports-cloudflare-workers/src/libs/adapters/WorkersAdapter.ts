import type { ExecutionContext } from '@cloudflare/workers-types';
import type { CrocoApp } from '@croco/transports-http';
import type { CloudflareEnv, WorkersFetchHandler, WorkersHandlerOptions } from '../types';

export function toWorkersHandler(app: CrocoApp, options?: WorkersHandlerOptions): WorkersFetchHandler {
  return {
    async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
      // TODO: V1에서는 env, ctx를 사용하지 않음
      // TODO: options.injectEnv는 나중에 구현 예정
      return app.fetch(request);
    },
  };
}
