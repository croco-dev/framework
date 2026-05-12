export type CloudflareFetchEnv = {
  readonly [key: string]: unknown;
};

export type ExecutionContext = {
  readonly waitUntil: (promise: Promise<unknown>) => void;
  readonly passThroughOnException: () => void;
};

export type CloudflareFetchHandler = (
  request: Request,
  env: CloudflareFetchEnv,
  ctx: ExecutionContext,
) => Response | Promise<Response>;

export function createWorkerFetchHandler(honoApp: {
  readonly fetch: (req: Request) => Promise<Response>;
}): CloudflareFetchHandler {
  return async (
    request: Request,
    _env: CloudflareFetchEnv,
    _ctx: ExecutionContext,
  ): Promise<Response> => {
    return honoApp.fetch(request);
  };
}
