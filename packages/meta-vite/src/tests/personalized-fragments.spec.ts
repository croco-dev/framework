import { definePersonalizedCachePolicy, InMemoryCacheStore } from "@croco/cache-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createIsrMiddleware } from "../libs/isr/isrMiddleware";
import {
  createPrivateInput,
  formatPersonalizedInspectEvent,
  loadPersonalizedFragments,
  renderPersonalizedResponse,
  type PersonalizedFragmentInspectEvent,
  type PersonalizedFragmentStore,
} from "../libs/isr/personalizedFragments";

const scope = {
  app: "shop",
  env: "prod",
  tenant: "acme",
  site: "kr",
  locale: "ko-KR",
  resource: "pdp:sku-42",
};

function policyForVariant(variant: string) {
  return definePersonalizedCachePolicy({
    scope,
    revision: "content.7-policy.3-deploy.9",
    zones: [
      {
        zone: "public",
        dimensions: { region: "kr", currency: "KRW", pricePolicy: "standard" },
        dependencies: [{ name: "product:sku-42", revision: "content.7" }],
      },
      {
        zone: "variant",
        variant,
        dimensions: { region: "kr" },
        dependencies: [{ name: "experiment:headline", revision: "policy.3" }],
      },
      { zone: "private" },
    ],
  });
}

function memoryFragmentStore(): PersonalizedFragmentStore & {
  stats(): { sets: number };
  setNow(value: number): void;
} {
  // Test TTLs use the injected clock: the backing store expiry must follow
  // options.now instead of Date.now, otherwise expiry tests become flaky.
  let nowMs = 0;
  const entries = new Map<string, { value: unknown; expiresAt: number | null }>();
  const inflight = new Map<string, Promise<unknown>>();
  let sets = 0;
  const read = (key: string): unknown | undefined => {
    const entry = entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (entry.expiresAt !== null && nowMs >= entry.expiresAt) {
      entries.delete(key);
      return undefined;
    }
    return entry.value;
  };
  return {
    stats: () => ({ sets }),
    setNow: (value: number) => {
      nowMs = value;
    },
    async getOrSet<V>(key: string, factory: () => Promise<V>, options?: { ttlMs?: number }) {
      const cached = read(key);
      if (cached !== undefined) {
        return cached as V;
      }
      const pending = inflight.get(key);
      if (pending !== undefined) {
        return (await pending) as V;
      }
      let load!: Promise<unknown>;
      load = (async () => {
        try {
          const value = await factory();
          sets += 1;
          entries.set(key, {
            value,
            expiresAt: options?.ttlMs === undefined ? null : nowMs + options.ttlMs,
          });
          return value;
        } finally {
          if (inflight.get(key) === load) {
            inflight.delete(key);
          }
        }
      })() as Promise<unknown>;
      inflight.set(key, load);
      return (await load) as V;
    },
    async invalidate(key: string) {
      entries.delete(key);
    },
    async get<V>(key: string) {
      return read(key) as V | undefined;
    },
  };
}

describe("personalized fragments", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("reuses public fragments across users and variants without crossing private values", async () => {
    const store = memoryFragmentStore();
    let publicLoads = 0;
    let variantLoads = 0;

    const runUser = async (user: string, variant: string) => {
      const fragments = await loadPersonalizedFragments({
        store,
        policy: policyForVariant(variant),
        publicLoader: {
          zone: "public",
          domain: "marketing",
          load: async () => {
            publicLoads += 1;
            const value = { title: "Shared product description" };
            return { value, bytes: JSON.stringify(value) };
          },
        },
        variantLoader: {
          zone: "variant",
          load: async () => {
            variantLoads += 1;
            const value = { headline: `Copy for ${variant}` };
            return { value, bytes: JSON.stringify(value) };
          },
        },
        allowedVariants: ["headline-a", "headline-b"],
        privateLoader: {
          zone: "private",
          load: async () => ({ benefit: `benefit-for-${user}`, token: `token-${user}` }),
        },
      });

      const response = renderPersonalizedResponse({
        fragments: {
          public: { value: fragments.public },
          variant: fragments.variant === undefined ? undefined : { value: fragments.variant },
          privateInput: createPrivateInput(fragments.privateValue),
        },
        representation: "html",
        deployId: "deploy.9",
        render: (input) =>
          `${input.public.value.title}|${input.variant?.value.headline ?? "none"}|${input.privateInput.value.benefit}`,
      });

      return { fragments, response };
    };

    const aliceA = await runUser("alice", "headline-a");
    const bobA = await runUser("bob", "headline-a");
    const aliceB = await runUser("alice", "headline-b");

    expect(publicLoads).toBe(1);
    expect(variantLoads).toBe(2);
    expect(aliceA.fragments.public).toEqual(bobA.fragments.public);
    expect(aliceA.fragments.variant).not.toEqual(aliceB.fragments.variant);
    expect(aliceA.response.body).toContain("benefit-for-alice");
    expect(bobA.response.body).toContain("benefit-for-bob");
    expect(bobA.response.body).not.toContain("benefit-for-alice");
    expect(aliceA.fragments.cache.publicSource).toBe("render");
    expect(bobA.fragments.cache.publicSource).toBe("cache");
  });

  it("refreshes only affected zones when a real dependency revision changes", async () => {
    const store = memoryFragmentStore();
    let publicLoads = 0;

    const runWithProductRevision = async (revision: string) =>
      loadPersonalizedFragments({
        store,
        policy: definePersonalizedCachePolicy({
          scope,
          revision: `content.${revision}-policy.3-deploy.9`,
          zones: [
            {
              zone: "public",
              dimensions: { region: "kr" },
              dependencies: [{ name: "product:sku-42", revision: `content.${revision}` }],
            },
            { zone: "private" },
          ],
        }),
        publicLoader: {
          zone: "public",
          load: async () => {
            publicLoads += 1;
            const value = { revision };
            return { value, bytes: JSON.stringify(value) };
          },
        },
        privateLoader: { zone: "private", load: async () => ({ user: "alice" }) },
      });

    const first = await runWithProductRevision("7");
    const second = await runWithProductRevision("7");
    const third = await runWithProductRevision("8");

    expect(first.public).toEqual({ revision: "7" });
    expect(second.public).toEqual({ revision: "7" });
    expect(third.public).toEqual({ revision: "8" });
    expect(publicLoads).toBe(2);
  });

  it("shares one fill across concurrent requests and never publishes failures", async () => {
    const store = memoryFragmentStore();
    let publicLoads = 0;
    let resolveLoad!: (value: { value: { n: number }; bytes: string }) => void;
    let rejectLoad!: (reason: Error) => void;

    const request = () =>
      loadPersonalizedFragments({
        store,
        policy: policyForVariant("headline-a"),
        publicLoader: {
          zone: "public",
          load: async () => {
            publicLoads += 1;
            return new Promise((resolve, reject) => {
              resolveLoad = resolve as (value: { value: { n: number }; bytes: string }) => void;
              rejectLoad = reject;
            });
          },
        },
        privateLoader: { zone: "private", load: async () => ({ user: "alice" }) },
      });

    const pending = [request(), request()];
    await Promise.resolve();
    await Promise.resolve();
    expect(publicLoads).toBe(1);

    resolveLoad({ value: { n: 1 }, bytes: JSON.stringify({ n: 1 }) });
    const [first, second] = await Promise.all(pending);
    expect(first.public).toEqual({ n: 1 });
    expect(second.public).toEqual({ n: 1 });

    // A failed fill must not be published as a successful hit.
    const failingLoads = { count: 0 };
    const failingStore = memoryFragmentStore();
    await expect(
      loadPersonalizedFragments({
        store: failingStore,
        policy: policyForVariant("headline-a"),
        publicLoader: {
          zone: "public",
          load: async () => {
            failingLoads.count += 1;
            throw new Error("source unavailable");
          },
        },
        privateLoader: { zone: "private", load: async () => ({ user: "alice" }) },
      }),
    ).rejects.toThrow("source unavailable");
    expect(failingLoads.count).toBe(1);
    expect(failingStore.stats().sets).toBe(0);
    void rejectLoad;
  });

  it("rejects untrusted variants and redacts inspect output", async () => {
    const store = memoryFragmentStore();
    const events: PersonalizedFragmentInspectEvent[] = [];

    await expect(
      loadPersonalizedFragments({
        store,
        policy: policyForVariant("evil-variant"),
        publicLoader: {
          zone: "public",
          load: async () => ({ value: { t: 1 }, bytes: JSON.stringify({ t: 1 }) }),
        },
        variantLoader: {
          zone: "variant",
          load: async () => ({ value: { h: 1 }, bytes: JSON.stringify({ h: 1 }) }),
        },
        allowedVariants: ["headline-a"],
        privateLoader: { zone: "private", load: async () => ({ user: "alice" }) },
        inspect: (event) => {
          events.push(event);
        },
      }),
    ).rejects.toThrow("Untrusted variant");

    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("session=");
    expect(serialized).not.toContain("token-alice");
    for (const event of events) {
      expect(event.keyHash).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it("blocks html/flight mixing and formats safe inspect output", async () => {
    const store = memoryFragmentStore();
    const html = await loadPersonalizedFragments({
      store,
      policy: policyForVariant("headline-a"),
      representation: "html",
      publicLoader: {
        zone: "public",
        load: async () => ({ value: { t: "html" }, bytes: JSON.stringify({ t: "html" }) }),
      },
      privateLoader: { zone: "private", load: async () => ({ user: "alice" }) },
    });
    const flight = await loadPersonalizedFragments({
      store,
      policy: policyForVariant("headline-a"),
      representation: "flight",
      publicLoader: {
        zone: "public",
        load: async () => ({ value: { t: "flight" }, bytes: JSON.stringify({ t: "flight" }) }),
      },
      privateLoader: { zone: "private", load: async () => ({ user: "alice" }) },
    });

    expect(html.public).toEqual({ t: "html" });
    expect(flight.public).toEqual({ t: "flight" });
    expect(html.cache.publicKeyHash).not.toBe(flight.cache.publicKeyHash);

    const events: PersonalizedFragmentInspectEvent[] = [];
    await loadPersonalizedFragments({
      store,
      policy: policyForVariant("headline-a"),
      representation: "html",
      publicLoader: {
        zone: "public",
        load: async () => ({ value: { t: "html" }, bytes: JSON.stringify({ t: "html" }) }),
      },
      privateLoader: { zone: "private", load: async () => ({ user: "alice" }) },
      inspect: (event) => {
        events.push(event);
      },
    });
    const lines = events.map(formatPersonalizedInspectEvent);
    expect(lines.some((line) => line.includes("outcome=hit") && line.includes("zone=public"))).toBe(
      true,
    );
    for (const event of events) {
      expect(event.representation).toBe("html");
    }
    expect(
      events
        .filter((event) => event.zone === "public")
        .every((event) => event.dimensionNames.includes("representation")),
    ).toBe(true);
    const serialized = JSON.stringify({ events, lines });
    expect(serialized).not.toContain("session=");
    expect(serialized).not.toContain("token-alice");
  });

  it("checks access per request and honours cancellation", async () => {
    const store = memoryFragmentStore();
    const publicLoader = {
      zone: "public" as const,
      load: async () => ({ value: { t: 1 }, bytes: JSON.stringify({ t: 1 }) }),
    };

    const denied = await loadPersonalizedFragments({
      store,
      policy: policyForVariant("headline-a"),
      publicLoader,
      privateLoader: { zone: "private" as const, load: async () => ({ user: "alice" }) },
      authorization: () => false,
    });
    expect(denied.public).toEqual({ t: 1 });
    expect(denied.cache.publicSource).toBe("render");

    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    await expect(
      loadPersonalizedFragments({
        store,
        policy: policyForVariant("headline-a"),
        publicLoader,
        privateLoader: { zone: "private" as const, load: async () => ({ user: "alice" }) },
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });

  it("serves bounded stale copies on source errors for eligible domains", async () => {
    const priceStore = memoryFragmentStore();
    const pricePolicy = definePersonalizedCachePolicy({
      scope,
      revision: "content.7-policy.3-deploy.9",
      freshness: { ttlMs: 100, staleWhileRevalidateMs: 0, staleIfErrorMs: 10_000 },
      zones: [{ zone: "public", dimensions: { region: "kr" } }, { zone: "private" }],
    });
    let priceNowMs = 1_000;
    priceStore.setNow(priceNowMs);
    await loadPersonalizedFragments({
      store: priceStore,
      policy: pricePolicy,
      publicLoader: {
        zone: "public",
        domain: "price",
        load: async () => ({ value: { n: 1 }, bytes: JSON.stringify({ n: 1 }) }),
      },
      privateLoader: { zone: "private" as const, load: async () => ({}) },
      now: () => priceNowMs,
    });
    priceNowMs = 1_500;
    priceStore.setNow(priceNowMs);
    const priceEvents: PersonalizedFragmentInspectEvent[] = [];
    await expect(
      loadPersonalizedFragments({
        store: priceStore,
        policy: pricePolicy,
        publicLoader: {
          zone: "public",
          domain: "price",
          load: async () => {
            throw new Error("source unavailable");
          },
        },
        privateLoader: { zone: "private" as const, load: async () => ({}) },
        now: () => priceNowMs,
        inspect: (event) => {
          priceEvents.push(event);
        },
      }),
    ).rejects.toThrow("source unavailable");

    const store = memoryFragmentStore();
    const basePolicy = definePersonalizedCachePolicy({
      scope,
      revision: "content.7-policy.3-deploy.9",
      freshness: { ttlMs: 100, staleWhileRevalidateMs: 0, staleIfErrorMs: 10_000 },
      zones: [{ zone: "public", dimensions: { region: "kr" } }, { zone: "private" }],
    });
    let nowMs = 1_000;
    const loader = (value: number) => ({
      zone: "public" as const,
      domain: "marketing",
      load: async () => ({ value: { n: value }, bytes: JSON.stringify({ n: value }) }),
    });

    store.setNow(nowMs);
    const first = await loadPersonalizedFragments({
      store,
      policy: basePolicy,
      publicLoader: loader(1),
      privateLoader: { zone: "private" as const, load: async () => ({}) },
      now: () => nowMs,
    });
    expect(first.public).toEqual({ n: 1 });

    nowMs = 1_500;
    store.setNow(nowMs);
    const recovered = await loadPersonalizedFragments({
      store,
      policy: basePolicy,
      publicLoader: {
        zone: "public",
        domain: "marketing",
        load: async () => {
          throw new Error("source unavailable");
        },
      },
      privateLoader: { zone: "private" as const, load: async () => ({}) },
      now: () => nowMs,
    });
    expect(recovered.public).toEqual({ n: 1 });
  });

  it("never stores Set-Cookie or private responses in the shared ISR cache", async () => {
    const cache = new InMemoryCacheStore<Response>({ maxEntries: 100 });
    const middleware = createIsrMiddleware({
      cache,
      ttlMs: 1000,
      render: async () =>
        new Response("private-bytes", {
          status: 200,
          headers: { "set-cookie": "session=abc; HttpOnly" },
        }),
    });

    const first = await middleware(new Request("https://example.com/pdp/sku-42"));
    const second = await middleware(new Request("https://example.com/pdp/sku-42"));

    await expect(first.text()).resolves.toBe("private-bytes");
    await expect(second.text()).resolves.toBe("private-bytes");
    expect(cache.getStats().size).toBe(0);
  });
});
