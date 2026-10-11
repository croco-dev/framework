import { createHash } from "node:crypto";
import { PersonalizedCachePolicyProblem } from "./problems/PersonalizedCacheProblems";

/**
 * Personalized SSR cache policy.
 *
 * Extends existing cache-core/ISR semantics without a new cache engine:
 * cacheable zones share fragment bytes through an existing CacheStore,
 * while private values stay request-local and final personalized
 * responses are never written to a shared HTTP/CDN cache.
 */
export type PersonalizedCacheZone = "public" | "variant" | "private";

export type PersonalizedCacheFreshnessPolicy = {
  /** Fresh lifetime in milliseconds. */
  readonly ttlMs: number;
  /** Optional stale-while-revalidate bound. Zero or undefined disables stale reads. */
  readonly staleWhileRevalidateMs?: number;
  /** Optional stale-if-error bound for source failures. */
  readonly staleIfErrorMs?: number;
  /** Domains that must never be served stale (price, eligibility, balance). */
  readonly noStaleDomains?: readonly string[];
};

export type PersonalizedCacheDependency = {
  /** Stable dependency name, for example `product:42:price-policy`. */
  readonly name: string;
  /** Content, policy, or deploy revision observed when the entry was created. */
  readonly revision: string;
};

export type PersonalizedCacheDimensionScope = {
  readonly app: string;
  readonly env: string;
  readonly tenant: string;
  readonly site: string;
  readonly locale: string;
  readonly resource: string;
};

export type PersonalizedCacheZonePolicyInput = {
  readonly zone: PersonalizedCacheZone;
  /** Explicit dependency declarations evaluated for freshness. */
  readonly dependencies?: readonly PersonalizedCacheDependency[];
  /** Region-local dimensions that actually change the rendered result. */
  readonly dimensions?: Readonly<Record<string, string>>;
  /** Trusted server-resolved experiment variant, never a raw client header. */
  readonly variant?: string;
  /** Revision covering content, policy, and deploy inputs. */
  readonly revision?: string;
  readonly freshness?: PersonalizedCacheFreshnessPolicy;
  /** Maximum accepted dimension cardinality before explicit private/bypass. */
  readonly maxDimensions?: number;
};

export type PersonalizedCachePolicyInput = {
  readonly scope: PersonalizedCacheDimensionScope;
  /** Revision covering content, policy, and deploy inputs shared by zones. */
  readonly revision: string;
  readonly zones: readonly PersonalizedCacheZonePolicyInput[];
  readonly freshness?: PersonalizedCacheFreshnessPolicy;
};

export type ResolvedPersonalizedCacheZonePolicy = {
  readonly zone: PersonalizedCacheZone;
  readonly dependencies: readonly PersonalizedCacheDependency[];
  readonly dimensions: Readonly<Record<string, string>>;
  readonly revision: string;
  readonly freshness: PersonalizedCacheFreshnessPolicy;
  /** True when zone state must bypass shared caches for this request. */
  readonly bypassSharedCache: boolean;
  readonly bypassReason?: string;
};

export type PersonalizedCachePolicy = {
  readonly scope: PersonalizedCacheDimensionScope;
  readonly revision: string;
  readonly zones: Readonly<Record<"public", ResolvedPersonalizedCacheZonePolicy>> &
    Readonly<Partial<Record<"variant" | "private", ResolvedPersonalizedCacheZonePolicy>>>;
  readonly freshness: PersonalizedCacheFreshnessPolicy;
};

/**
 * Dimension names that may influence cache identity. Anything else,
 * including user ids, raw cookies, and credentials, is rejected so high
 * cardinality PII can never become part of a shared key.
 */
export const PERSONALIZED_CACHE_DIMENSION_ALLOWLIST = [
  "region",
  "currency",
  "pricePolicy",
  "locale",
  "channel",
  "surface",
  "experiment",
  "variant",
  "representation",
  "deploy",
] as const;

export type PersonalizedCacheDimensionName =
  (typeof PERSONALIZED_CACHE_DIMENSION_ALLOWLIST)[number];

const DIMENSION_ALLOWLIST = new Set<string>(PERSONALIZED_CACHE_DIMENSION_ALLOWLIST);

const DEFAULT_TTL_MS = 60_000;
const DEFAULT_MAX_DIMENSIONS = 8;

export function definePersonalizedCachePolicy(
  input: PersonalizedCachePolicyInput,
): PersonalizedCachePolicy {
  assertScope(input.scope);
  assertRevision(input.revision, "policy.revision");

  const freshness = normalizeFreshness(input.freshness, "policy.freshness");
  const zones = new Map<PersonalizedCacheZone, ResolvedPersonalizedCacheZonePolicy>();

  for (const zoneInput of input.zones) {
    const resolved = resolveZonePolicy(zoneInput, input.revision, input.scope, freshness);
    if (zones.has(resolved.zone)) {
      throw new PersonalizedCachePolicyProblem(
        `Duplicate personalized cache zone '${resolved.zone}'.`,
      );
    }
    zones.set(resolved.zone, resolved);
  }

  const publicZone = zones.get("public");
  if (publicZone === undefined) {
    throw new PersonalizedCachePolicyProblem("Personalized cache policy requires a public zone.");
  }
  if (publicZone.bypassSharedCache) {
    throw new PersonalizedCachePolicyProblem(
      `Public zone must remain cacheable: ${publicZone.bypassReason ?? "bypass requested"}.`,
    );
  }
  if (publicZone.dimensions["variant"] !== undefined) {
    throw new PersonalizedCachePolicyProblem("Public zone must not carry an experiment variant.");
  }

  const variantZone = zones.get("variant");
  if (variantZone !== undefined && !variantZone.bypassSharedCache) {
    if (variantZone.dimensions["variant"] === undefined) {
      throw new PersonalizedCachePolicyProblem(
        "Variant zone requires an explicit trusted variant dimension.",
      );
    }
  }

  const privateZone = zones.get("private");
  if (privateZone !== undefined && !privateZone.bypassSharedCache) {
    throw new PersonalizedCachePolicyProblem(
      "Private zone must bypass shared caches and stay request-local.",
    );
  }

  return {
    scope: { ...input.scope },
    revision: input.revision,
    freshness,
    zones: {
      public: publicZone,
      ...(variantZone === undefined ? {} : { variant: variantZone }),
      ...(privateZone === undefined ? {} : { private: privateZone }),
    },
  };
}

/**
 * Invalidation strategy note: personalized caches use revision keys
 * (`content/policy/deploy` revisions embedded in each fragment key) rather
 * than a shared tag index. Reason: InMemoryCacheStore-backed ISR adapters
 * advertise `tag: false` (see `createCacheStoreInvalidationAdapter`), so
 * claiming tag invalidation would report success without effect. Revision
 * rotation makes stale entries unreachable, while explicit
 * `invalidatePersonalizedFragment` handles content updates and policy pauses
 * with exact-key deletes. Successful `invalidateTag` must never be faked:
 * use `createCacheStoreInvalidationAdapter` capabilities as the source of
 * truth and treat tag operations as unsupported for these stores.
 */
export type PersonalizedInvalidationScope = {
  readonly scope: PersonalizedCacheDimensionScope;
  readonly resource: string;
  readonly revision: string;
};

export async function invalidatePersonalizedFragment(
  store: { delete(key: string): Promise<void> },
  policy: PersonalizedCachePolicy,
  zone: Exclude<PersonalizedCacheZone, "private">,
  representation: "html" | "flight" = "html",
): Promise<{ readonly zone: Exclude<PersonalizedCacheZone, "private">; readonly keyHash: string }> {
  const key = createPersonalizedCacheKey(policy, zone, representation);
  await store.delete(key);
  return {
    zone,
    keyHash: createHash("sha256").update(key).digest("hex").slice(0, 16),
  };
}
export function createPersonalizedCacheKey(
  policy: PersonalizedCachePolicy,
  zone: PersonalizedCacheZone,
  representation: "html" | "flight" = "html",
): string {
  const resolved = zonePolicy(policy, zone);
  if (resolved.bypassSharedCache) {
    throw new PersonalizedCachePolicyProblem(
      `Zone '${zone}' bypasses shared caches: ${resolved.bypassReason ?? "bypass requested"}.`,
    );
  }
  if (representation !== "html" && representation !== "flight") {
    throw new PersonalizedCachePolicyProblem(
      `Unsupported personalized representation '${representation}'.`,
    );
  }

  const dimensions = { ...resolved.dimensions, representation };
  const segments = [
    "personalized",
    "v1",
    `zone=${zone}`,
    `app=${stableSegment(policy.scope.app)}`,
    `env=${stableSegment(policy.scope.env)}`,
    `tenant=${stableSegment(policy.scope.tenant)}`,
    `site=${stableSegment(policy.scope.site)}`,
    `locale=${stableSegment(policy.scope.locale)}`,
    `resource=${stableSegment(policy.scope.resource)}`,
    `representation=${stableSegment(representation)}`,
    `revision=${stableSegment(resolved.revision)}`,
    `dimensions=${encodeDimensions(dimensions)}`,
    `dependencies=${encodeDependencies(resolved.dependencies)}`,
  ];

  return segments.join(":");
}

export function isPersonalizedCacheFresh(
  input: {
    readonly cachedAtMs: number;
    readonly nowMs: number;
    readonly revision: string;
    readonly expectedRevision: string;
    readonly dependencies: readonly PersonalizedCacheDependency[];
    readonly expectedDependencies: readonly PersonalizedCacheDependency[];
    readonly domain?: string;
  },
  freshness: PersonalizedCacheFreshnessPolicy,
): { readonly fresh: boolean; readonly reason: string } {
  if (input.revision !== input.expectedRevision) {
    return { fresh: false, reason: "revision-changed" };
  }

  const dependencyRevisions = new Map(
    input.dependencies.map((entry) => [entry.name, entry.revision]),
  );
  for (const expected of input.expectedDependencies) {
    if (dependencyRevisions.get(expected.name) !== expected.revision) {
      return { fresh: false, reason: `dependency-changed:${expected.name}` };
    }
  }

  const ageMs = input.nowMs - input.cachedAtMs;
  if (ageMs < 0) {
    return { fresh: false, reason: "clock-skew" };
  }
  if (ageMs <= freshness.ttlMs) {
    return { fresh: true, reason: "fresh" };
  }
  if (
    freshness.noStaleDomains?.includes(input.domain ?? "") === true ||
    input.domain === "price" ||
    input.domain === "eligibility" ||
    input.domain === "balance"
  ) {
    return { fresh: false, reason: "no-stale-domain" };
  }
  const staleBudget = freshness.staleWhileRevalidateMs ?? 0;
  if (ageMs <= freshness.ttlMs + staleBudget) {
    return { fresh: true, reason: "stale-while-revalidate" };
  }
  return { fresh: false, reason: "expired" };
}

function resolveZonePolicy(
  zoneInput: PersonalizedCacheZonePolicyInput,
  policyRevision: string,
  scope: PersonalizedCacheDimensionScope,
  policyFreshness: PersonalizedCacheFreshnessPolicy,
): ResolvedPersonalizedCacheZonePolicy {
  const dependencies = [...(zoneInput.dependencies ?? [])];
  for (const dependency of dependencies) {
    assertSegment(dependency.name, "zone.dependencies[].name");
    assertRevision(dependency.revision, `zone.dependencies[${dependency.name}].revision`);
  }

  const maxDimensions = zoneInput.maxDimensions ?? DEFAULT_MAX_DIMENSIONS;
  if (!Number.isInteger(maxDimensions) || maxDimensions < 1 || maxDimensions > 32) {
    throw new PersonalizedCachePolicyProblem(
      "Zone maxDimensions must be an integer between 1 and 32.",
    );
  }

  const dimensions: Record<string, string> = {};
  for (const [name, value] of Object.entries(zoneInput.dimensions ?? {})) {
    assertDimension(name, value);
    dimensions[name] = value;
  }
  if (zoneInput.variant !== undefined) {
    assertSegment(zoneInput.variant, "zone.variant");
    dimensions["variant"] = zoneInput.variant;
  }
  if (
    zoneInput.zone !== "public" &&
    zoneInput.zone !== "private" &&
    scope.locale.length > 0 &&
    dimensions["locale"] === undefined
  ) {
    dimensions["locale"] = scope.locale;
  }

  const names = Object.keys(dimensions);
  if (names.length > maxDimensions) {
    return {
      zone: zoneInput.zone,
      dependencies,
      dimensions: {},
      revision: zoneInput.revision ?? policyRevision,
      freshness:
        zoneInput.freshness === undefined
          ? policyFreshness
          : normalizeFreshness(zoneInput.freshness, "zone.freshness"),
      bypassSharedCache: true,
      bypassReason: `dimension-cardinality-exceeded:${names.length}>${maxDimensions}`,
    };
  }

  if (zoneInput.zone === "private") {
    return {
      zone: zoneInput.zone,
      dependencies,
      dimensions,
      revision: zoneInput.revision ?? policyRevision,
      freshness:
        zoneInput.freshness === undefined
          ? policyFreshness
          : normalizeFreshness(zoneInput.freshness, "zone.freshness"),
      bypassSharedCache: true,
      bypassReason: "private-request-local",
    };
  }

  const revision = zoneInput.revision ?? policyRevision;
  assertRevision(revision, "zone.revision");

  return {
    zone: zoneInput.zone,
    dependencies,
    dimensions,
    revision,
    freshness:
      zoneInput.freshness === undefined
        ? policyFreshness
        : normalizeFreshness(zoneInput.freshness, "zone.freshness"),
    bypassSharedCache: false,
  };
}

function zonePolicy(
  policy: PersonalizedCachePolicy,
  zone: PersonalizedCacheZone,
): ResolvedPersonalizedCacheZonePolicy {
  const resolved = policy.zones[zone];
  if (resolved === undefined) {
    throw new PersonalizedCachePolicyProblem(`Personalized cache policy has no '${zone}' zone.`);
  }
  return resolved;
}

function assertScope(scope: PersonalizedCacheDimensionScope): void {
  assertSegment(scope.app, "scope.app");
  assertSegment(scope.env, "scope.env");
  assertSegment(scope.tenant, "scope.tenant");
  assertSegment(scope.site, "scope.site");
  assertSegment(scope.locale, "scope.locale");
  assertSegment(scope.resource, "scope.resource");
}

function assertDimension(name: string, value: string): void {
  if (!DIMENSION_ALLOWLIST.has(name)) {
    throw new PersonalizedCachePolicyProblem(
      `Unsupported cache dimension '${name}'. Only region-local dimensions influence cache identity.`,
    );
  }
  if (name === "representation") {
    throw new PersonalizedCachePolicyProblem(
      "Reserved cache dimension 'representation'. Pass the representation argument instead.",
    );
  }
  assertSegment(value, `dimensions[${name}]`);
}

function assertSegment(value: string, path: string): void {
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    throw new PersonalizedCachePolicyProblem(`Cache ${path} must be 1-128 characters.`);
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw new PersonalizedCachePolicyProblem(`Cache ${path} has unsupported characters.`);
  }
}

function assertRevision(value: string, path: string): void {
  assertSegment(value, path);
}

function normalizeFreshness(
  freshness: PersonalizedCacheFreshnessPolicy | undefined,
  path: string,
): PersonalizedCacheFreshnessPolicy {
  const ttlMs = freshness?.ttlMs ?? DEFAULT_TTL_MS;
  const staleWhileRevalidateMs = freshness?.staleWhileRevalidateMs ?? 0;
  const staleIfErrorMs = freshness?.staleIfErrorMs ?? 0;
  for (const [name, value] of [
    ["ttlMs", ttlMs],
    ["staleWhileRevalidateMs", staleWhileRevalidateMs],
    ["staleIfErrorMs", staleIfErrorMs],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new PersonalizedCachePolicyProblem(`Cache ${path}.${name} must be finite >= 0.`);
    }
  }
  return {
    ttlMs,
    staleWhileRevalidateMs,
    staleIfErrorMs,
    ...(freshness?.noStaleDomains === undefined
      ? {}
      : { noStaleDomains: [...freshness.noStaleDomains] }),
  };
}

function stableSegment(value: string): string {
  return encodeURIComponent(value);
}

function encodeDependencyPart(value: string): string {
  return encodeURIComponent(value);
}

function encodeDimensions(dimensions: Readonly<Record<string, string>>): string {
  const names = Object.keys(dimensions).sort();
  if (names.length === 0) {
    return "none";
  }
  return names.map((name) => `${name}=${stableSegment(dimensions[name] ?? "")}`).join(",");
}

function encodeDependencies(dependencies: readonly PersonalizedCacheDependency[]): string {
  if (dependencies.length === 0) {
    return "none";
  }
  return [...dependencies]
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
    .map(
      (dependency) =>
        `${encodeDependencyPart(dependency.name)}@${encodeDependencyPart(dependency.revision)}`,
    )
    .join(",");
}
