import {
  definePersonalizedCachePolicy,
  InMemoryCacheStore,
  type PersonalizedCachePolicy,
} from "@croco/cache-core";
import {
  createPrivateInput,
  formatPersonalizedInspectEvent,
  loadPersonalizedFragments,
  renderPersonalizedResponse,
  type PersonalizedFragmentInspectEvent,
  type PersonalizedFragmentStore,
} from "@croco/meta-vite";

type PdpDescription = {
  readonly sku: string;
  readonly title: string;
  readonly copy: string;
};

type PdpBenefit = {
  readonly userId: string;
  readonly coupon: string;
};

const sharedFragments = new InMemoryCacheStore<unknown>({ maxEntries: 200 });

const store: PersonalizedFragmentStore = {
  async getOrSet<V>(key: string, factory: () => Promise<V>, options?: { ttlMs?: number }) {
    const stored = await sharedFragments.getOrSet(
      key,
      async () => (await factory()) as unknown,
      options?.ttlMs === undefined ? undefined : { ttlMs: options.ttlMs },
    );
    if (stored === undefined) {
      throw new Error("Personalized fragment fill was cancelled before publish.");
    }
    return stored as V;
  },
  async invalidate(key: string) {
    await sharedFragments.delete(key);
  },
  async get<V>(key: string) {
    return (await sharedFragments.get(key)) as V | undefined;
  },
};

function pdpPolicy(): PersonalizedCachePolicy {
  return definePersonalizedCachePolicy({
    scope: {
      app: "shop",
      env: "prod",
      tenant: "acme",
      site: "kr",
      locale: "ko-KR",
      resource: "pdp:sku-42",
    },
    revision: "content.7-policy.3-deploy.9",
    zones: [
      {
        zone: "public",
        dimensions: { region: "kr", currency: "KRW", pricePolicy: "standard" },
        dependencies: [{ name: "product:sku-42", revision: "content.7" }],
      },
      { zone: "private", dependencies: [{ name: "benefits:user", revision: "policy.3" }] },
    ],
  });
}

async function renderPdpForUser(userId: string): Promise<{
  readonly body: string;
  readonly inspectLines: readonly string[];
}> {
  const inspectLines: string[] = [];
  const onInspect = (event: PersonalizedFragmentInspectEvent): void => {
    inspectLines.push(formatPersonalizedInspectEvent(event));
  };

  const fragments = await loadPersonalizedFragments<PdpDescription, never, PdpBenefit>({
    store,
    policy: pdpPolicy(),
    publicLoader: {
      zone: "public",
      load: async () => {
        const value: PdpDescription = {
          sku: "sku-42",
          title: "Trail Backpack 42L",
          copy: "Shared product description reused across shoppers.",
        };
        return { value, bytes: JSON.stringify(value) };
      },
    },
    privateLoader: {
      zone: "private",
      load: async () => ({ userId, coupon: `coupon-for-${userId}` }),
    },
    inspect: onInspect,
  });

  const response = renderPersonalizedResponse({
    fragments: {
      public: { value: fragments.public },
      privateInput: createPrivateInput(fragments.privateValue),
    },
    representation: "html",
    deployId: "deploy.9",
    render: (input) =>
      `<main><h1>${input.public.value.title}</h1><p>${input.public.value.copy}</p>` +
      `<p>Private coupon: ${input.privateInput.value.coupon}</p></main>`,
  });

  return { body: response.body, inspectLines };
}

export async function runPersonalizedPdp(): Promise<{
  readonly alice: string;
  readonly bob: string;
  readonly inspectLines: readonly string[];
}> {
  const alice = await renderPdpForUser("alice");
  const bob = await renderPdpForUser("bob");
  return { alice: alice.body, bob: bob.body, inspectLines: alice.inspectLines };
}
