import {
  createFixedWindowPolicy,
  createSlidingWindowPolicy,
  createTokenBucketPolicy,
  createRateLimitMiddleware,
  RateLimiter,
  RateLimitKeyBuilder,
} from "@croco/ratelimit-core";
import {
  createUpstashRateLimitClient,
  UpstashFixedWindowStore,
  UpstashSlidingWindowStore,
  UpstashTokenBucketStore,
} from "../../index";
import type { HttpContext, RateLimitPolicy, RateLimitResult } from "@croco/ratelimit-core";

type Bindings = { UPSTASH_REDIS_REST_URL: string; UPSTASH_REDIS_REST_TOKEN: string };

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const url = new URL(request.url);
    const algorithm = url.searchParams.get("algorithm") ?? "fixed";
    const now = Number(url.searchParams.get("now") ?? 10_000);
    const options = {
      redis: createUpstashRateLimitClient({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      }),
      prefix: url.searchParams.get("namespace") ?? "worker-test",
      now: () => now,
    };
    // A composition root selects exactly one store. No Durable Object fallback or auto-registration.
    const stores = {
      fixed: UpstashFixedWindowStore,
      sliding: UpstashSlidingWindowStore,
      "token-bucket": UpstashTokenBucketStore,
    };
    const policies: Record<string, RateLimitPolicy> = {
      fixed: createFixedWindowPolicy("api", 3, 60_000),
      sliding: createSlidingWindowPolicy("api", 3, 60_000),
      "token-bucket": createTokenBucketPolicy("api", 3, 1, 60_000),
    };
    const Store = stores[algorithm as keyof typeof stores];
    const policy = policies[algorithm];
    if (!Store || !policy) return new Response("unsupported algorithm", { status: 400 });
    const store = new Store(options);
    const errors: unknown[] = [];
    const limiter = new RateLimiter(store, () => "client", {
      onStoreError: (error) => errors.push(JSON.parse(JSON.stringify(error))),
    });
    if (url.searchParams.get("action") === "refund") {
      const receipt = (await request.json()) as NonNullable<RateLimitResult["refundReceipt"]>;
      const key = new RateLimitKeyBuilder(["ip"]).build(
        { get: <T>() => "192.0.2.10" as T },
        policy.name,
      );
      return Response.json(await store.refund(key, policy, receipt));
    }
    const values = new Map<string, unknown>();
    // Synthetic host-verified identity; forwarded request headers are deliberately untrusted.
    values.set("clientIp", "192.0.2.10");
    const context: HttpContext = {
      req: {
        method: request.method,
        path: url.pathname,
        headers: Object.fromEntries(request.headers),
      },
      get: <T>(key: string) => values.get(key) as T | undefined,
      set: <T>(key: string, value: T) => {
        values.set(key, value);
      },
    };
    let status = 200;
    try {
      await createRateLimitMiddleware({
        rateLimiter: limiter,
        policy,
        failOpen: url.searchParams.get("failOpen") === "true",
      })(context, async () => {});
    } catch {
      status = 429;
    }
    return Response.json(
      { result: values.get("rateLimitResult"), errors },
      {
        status,
        headers: values.get("rateLimitHeaders") as Record<string, string> | undefined,
      },
    );
  },
};
