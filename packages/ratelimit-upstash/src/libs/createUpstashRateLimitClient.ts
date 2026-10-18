import { Redis } from "@upstash/redis";
import type { UpstashRequest } from "@upstash/redis";
import {
  MissingUpstashRateLimitConfigProblem,
  UpstashRateLimitUpstreamProblem,
} from "./problems/RateLimitUpstashProblems";
import type { UpstashRateLimitStoreOptions } from "./UpstashRateLimitStore";

/** Explicit REST credentials from application bindings; never reads process.env. */
export type UpstashRateLimitClientOptions = {
  url: string;
  token: string;
};

/**
 * A fetch-only client for rate-limit commands. Sends each command once, with a ten-second timeout.
 * Transport failures can occur after Redis committed a command; callers own any retry decision.
 */
export function createUpstashRateLimitClient(
  options: UpstashRateLimitClientOptions,
): UpstashRateLimitStoreOptions["redis"] {
  let endpoint: URL;
  try {
    endpoint = new URL(options.url);
  } catch {
    throw new MissingUpstashRateLimitConfigProblem("url");
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    (endpoint.pathname !== "/" && endpoint.pathname !== "")
  ) {
    throw new MissingUpstashRateLimitConfigProblem("url (HTTPS origin required)");
  }
  if (typeof options.token !== "string" || !options.token.trim() || /[\r\n]/.test(options.token)) {
    throw new MissingUpstashRateLimitConfigProblem("token");
  }
  const token = options.token;
  let syncToken = "";
  return new Redis({
    async request<T>(request: UpstashRequest): Promise<{ result?: T; error?: string }> {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          redirect: "manual",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "upstash-sync-token": syncToken,
          },
          body: JSON.stringify(request.body),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        // Neither provider payloads nor transport messages are safe diagnostics.
        throw new UpstashRateLimitUpstreamProblem("http.request", "transport failure or timeout");
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new UpstashRateLimitUpstreamProblem("http.request", { status: response.status });
      }
      syncToken = response.headers.get("upstash-sync-token") ?? "";
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new UpstashRateLimitUpstreamProblem("http.response", { status: 502 });
      }
      if (payload && typeof payload === "object" && "error" in payload) {
        throw new UpstashRateLimitUpstreamProblem("http.response", { status: 400 });
      }
      if (!payload || typeof payload !== "object" || !("result" in payload)) {
        throw new UpstashRateLimitUpstreamProblem("http.response", { status: 502 });
      }
      return { result: payload.result as T };
    },
  });
}
