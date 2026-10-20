import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from "@apollo/client";
import { ProblemFactory } from "@croco/problems-core";
import { tap } from "rxjs";

import type {
  DocumentNode,
  InMemoryCacheConfig,
  NormalizedCacheObject,
  OperationVariables,
  TypedDocumentNode,
} from "@apollo/client";

export type ApolloSessionOptions = {
  /** Absolute, application-configured URL. Never derive the allowlist from an incoming Host header. */
  readonly endpoint: string;
  readonly allowedOrigins: readonly string[];
  /** Non-secret generation id. Change it for login, logout, tenant and personalization changes. */
  readonly owner: string;
  readonly ssr: boolean;
  readonly headers?: HeadersInit;
  readonly fetch?: typeof globalThis.fetch;
  readonly cache?: InMemoryCacheConfig;
  /** Serialized selected-query hydration, never an entire server cache. */
  readonly hydration?: string;
};

export type ApolloHydrationSelection = {
  readonly query: DocumentNode | TypedDocumentNode;
  readonly variables?: OperationVariables;
};

export type ApolloSession = {
  readonly client: ApolloClient;
  readonly owner: string;
  /** Only select browser-owned, complete query results. Server-only queries stay on the server. */
  extract(selections: readonly ApolloHydrationSelection[]): string;
  /** Abort transport, stop observers, erase private entities; never reuse this session afterward. */
  dispose(): void;
};

/** One instance per SSR request or browser identity generation; share only within that owner. */
export function createApolloSession(options: ApolloSessionOptions): ApolloSession {
  const { owner, ssr, cache: cacheConfig } = options;
  let endpoint: URL;
  try {
    endpoint = new URL(options.endpoint);
  } catch {
    throw ProblemFactory.badRequest(
      "frontend-react/apollo-endpoint",
      "Apollo requires an absolute HTTP endpoint.",
    );
  }
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash ||
    !options.allowedOrigins.includes(endpoint.origin) ||
    !owner
  ) {
    throw ProblemFactory.badRequest(
      "frontend-react/apollo-endpoint",
      "Apollo requires a trusted HTTP endpoint and cache owner.",
    );
  }
  const transport = options.fetch ?? globalThis.fetch;
  const lifetime = new AbortController();
  let hydrationFailed = false;
  const headers = new Headers(options.headers);
  const cache = new InMemoryCache(cacheConfig);
  if (options.hydration !== undefined) {
    let state: unknown;
    try {
      state = JSON.parse(options.hydration);
    } catch {
      throw ProblemFactory.badRequest(
        "frontend-react/apollo-hydration-json",
        "Hydration must be valid JSON.",
      );
    }
    assertJson(state);
    if (
      !isRecord(state) ||
      state.version !== 1 ||
      state.owner !== owner ||
      !isRecord(state.cache)
    ) {
      throw ProblemFactory.badRequest(
        "frontend-react/apollo-hydration-owner",
        "Hydration belongs to another cache owner or format.",
      );
    }
    cache.restore(state.cache as NormalizedCacheObject);
  }
  const guardedFetch: typeof globalThis.fetch = async (input, init) => {
    const requested = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    if (lifetime.signal.aborted || requested.href !== endpoint.href) {
      throw ProblemFactory.badRequest(
        "frontend-react/apollo-transport",
        "Apollo transport is disposed or targets another endpoint.",
      );
    }
    const outgoing = new Headers(init?.headers);
    // Identity is immutable for a cache owner. Context headers cannot replace it.
    for (const name of ["authorization", "cookie", "x-tenant-id"]) outgoing.delete(name);
    headers.forEach((value, name) => outgoing.set(name, value));
    const signal = init?.signal ? AbortSignal.any([init.signal, lifetime.signal]) : lifetime.signal;
    const response = await transport(endpoint.href, {
      ...init,
      headers: outgoing,
      signal,
      redirect: "error",
      credentials: ssr ? "omit" : "same-origin",
    });
    lifetime.signal.throwIfAborted();
    return response;
  };
  const client = new ApolloClient({
    ssrMode: ssr,
    cache,
    link: ApolloLink.from([
      new ApolloLink((operation, forward) =>
        forward(operation).pipe(
          tap({
            next(result) {
              if (result.errors?.length) hydrationFailed = true;
            },
            error() {
              hydrationFailed = true;
            },
          }),
        ),
      ),
      new HttpLink({ uri: endpoint.href, fetch: guardedFetch }),
    ]),
  });
  return {
    client,
    owner: owner,
    extract(selections) {
      if (hydrationFailed) {
        throw ProblemFactory.badRequest(
          "frontend-react/apollo-failed-hydration",
          "A session with failed operations cannot become a successful hydration snapshot.",
        );
      }
      if (lifetime.signal.aborted) {
        throw ProblemFactory.badRequest(
          "frontend-react/apollo-disposed",
          "A disposed Apollo session cannot be hydrated.",
        );
      }
      // Rebuild from allowlisted selections: extract() alone would also copy RSC-only/private results.
      const selected = new InMemoryCache(cacheConfig);
      for (const selection of selections) {
        const data = cache.readQuery({ ...selection, returnPartialData: false });
        if (data === null) {
          throw ProblemFactory.badRequest(
            "frontend-react/apollo-incomplete-hydration",
            "Hydration requires a complete selected query.",
          );
        }
        assertJson(data);
        selected.writeQuery({ ...selection, data });
      }
      return serializeApolloHydration({
        version: 1,
        owner: owner,
        cache: selected.extract(),
      });
    },
    dispose() {
      lifetime.abort();
      client.stop();
      cache.restore({});
    },
  };
}

/** JSON suitable for an application/json script text node. No executable assignment is generated. */
export function serializeApolloHydration(value: unknown): string {
  assertJson(value);
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertJson(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (
    typeof value !== "object" ||
    value === null ||
    ancestors.has(value) ||
    (!Array.isArray(value) &&
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    throw ProblemFactory.badRequest(
      "frontend-react/apollo-hydration-value",
      "Hydration accepts finite plain JSON values only.",
    );
  }
  ancestors.add(value);
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (Array.isArray(value) && key === "length") continue;
    if (["__proto__", "constructor", "prototype"].includes(key) || !("value" in descriptor)) {
      throw ProblemFactory.badRequest(
        "frontend-react/apollo-hydration-value",
        "Hydration cannot contain accessors or prototype keys.",
      );
    }
    assertJson(descriptor.value, ancestors);
  }
  ancestors.delete(value);
}
