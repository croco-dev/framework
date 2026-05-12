export type Fetcher = { fetch: typeof fetch };

export function createApiFetch(env: { API_WORKER?: Fetcher }, request: Request) {
  const headers = new Headers();
  headers.set("X-Request-Id", crypto.randomUUID());
  const traceparent = request.headers.get("traceparent");
  if (traceparent) headers.set("traceparent", traceparent);
  const authToken = request.headers.get("cookie")?.match(/token=([^;]+)/)?.[1];
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  headers.set("X-Forwarded-For", request.headers.get("cf-connecting-ip") ?? "");

  return async (path: string, init?: RequestInit) => {
    const fetcher = env.API_WORKER ?? globalThis;
    return fetcher.fetch(new Request(`https://api${path}`, { ...init, headers }));
  };
}
