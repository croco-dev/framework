import {
  createPersonalizedCacheKey,
  definePersonalizedCachePolicy,
  isPersonalizedCacheFresh,
  PersonalizedCachePolicyProblem,
} from "../index";
import { describe, expect, it } from "vitest";

const scope = {
  app: "shop",
  env: "prod",
  tenant: "acme",
  site: "kr",
  locale: "ko-KR",
  resource: "pdp:sku-42",
};

function policy() {
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
        variant: "headline-b",
        dimensions: { region: "kr" },
        dependencies: [{ name: "experiment:headline", revision: "policy.3" }],
      },
      { zone: "private", dependencies: [{ name: "benefits:user", revision: "policy.3" }] },
    ],
  });
}

describe("personalized cache policy", () => {
  it("builds stable zone keys and ignores irrelevant experiments", () => {
    const first = policy();
    const second = definePersonalizedCachePolicy({
      scope,
      revision: "content.7-policy.3-deploy.9",
      zones: [
        {
          zone: "public",
          dimensions: { pricePolicy: "standard", currency: "KRW", region: "kr" },
          dependencies: [{ name: "product:sku-42", revision: "content.7" }],
        },
        {
          zone: "variant",
          variant: "headline-b",
          dimensions: { region: "kr" },
          dependencies: [{ name: "experiment:headline", revision: "policy.3" }],
        },
        { zone: "private", dependencies: [{ name: "benefits:user", revision: "policy.3" }] },
      ],
    });

    expect(createPersonalizedCacheKey(first, "public")).toBe(
      createPersonalizedCacheKey(second, "public"),
    );
    expect(createPersonalizedCacheKey(first, "variant")).toContain("zone=variant");
    expect(() => createPersonalizedCacheKey(first, "private")).toThrow(
      PersonalizedCachePolicyProblem,
    );
  });

  it("rejects identity-bearing dimensions and public variants", () => {
    expect(() =>
      definePersonalizedCachePolicy({
        scope,
        revision: "r1",
        zones: [{ zone: "public", dimensions: { userId: "u-1" } }],
      }),
    ).toThrow(PersonalizedCachePolicyProblem);

    expect(() =>
      definePersonalizedCachePolicy({
        scope,
        revision: "r1",
        zones: [{ zone: "public", variant: "headline-b" }],
      }),
    ).toThrow(PersonalizedCachePolicyProblem);
  });

  it("downgrades cardinality overflow to explicit bypass", () => {
    const overflow = definePersonalizedCachePolicy({
      scope,
      revision: "r1",
      zones: [
        { zone: "public", dimensions: { region: "kr" } },
        {
          zone: "variant",
          variant: "v1",
          dimensions: { region: "kr" },
          maxDimensions: 1,
        },
        { zone: "private" },
      ],
    });

    expect(overflow.zones["variant"].bypassSharedCache).toBe(true);
    expect(overflow.zones["variant"].bypassReason).toContain("dimension-cardinality-exceeded");
  });

  it("evaluates revision, dependency, and no-stale freshness", () => {
    const freshness = { ttlMs: 1000, staleWhileRevalidateMs: 500, noStaleDomains: ["price"] };
    const base = {
      nowMs: 1500,
      cachedAtMs: 1000,
      revision: "r1",
      expectedRevision: "r1",
      dependencies: [{ name: "product", revision: "c1" }],
      expectedDependencies: [{ name: "product", revision: "c1" }],
    };

    expect(isPersonalizedCacheFresh({ ...base, nowMs: 1200 }, freshness).reason).toBe("fresh");
    expect(
      isPersonalizedCacheFresh({ ...base, nowMs: 2100, domain: "marketing" }, freshness).reason,
    ).toBe("stale-while-revalidate");
    expect(
      isPersonalizedCacheFresh({ ...base, nowMs: 2100, domain: "price" }, freshness).fresh,
    ).toBe(false);
    expect(isPersonalizedCacheFresh({ ...base, expectedRevision: "r2" }, freshness).fresh).toBe(
      false,
    );
    expect(
      isPersonalizedCacheFresh(
        { ...base, expectedDependencies: [{ name: "product", revision: "c2" }] },
        freshness,
      ).reason,
    ).toBe("dependency-changed:product");
  });
});
