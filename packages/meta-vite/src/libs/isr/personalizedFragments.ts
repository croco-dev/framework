import {
  createPersonalizedCacheKey,
  isPersonalizedCacheFresh,
  type PersonalizedCacheDependency,
  type PersonalizedCacheFreshnessPolicy,
  type PersonalizedCachePolicy,
  type PersonalizedCacheZone,
} from "@croco/cache-core";
import { createHash } from "node:crypto";

import { PersonalizedFragmentProblem } from "./personalizedFragmentProblems";

export { PersonalizedFragmentProblem } from "./personalizedFragmentProblems";

/**
 * Personalized fragment cache.
 *
 * Data/fragment caching is separated from final Response caching:
 * public and variant fragments share immutable bytes through an existing
 * CacheStore-backed adapter, private loaders resolve request-local values
 * that never enter the shared store, and composed personalized responses
 * are always returned bypass without being stored.
 */
export type PersonalizedFragmentStore = {
  getOrSet: <V>(key: string, factory: () => Promise<V>, options?: { ttlMs?: number }) => Promise<V>;
  invalidate: (key: string) => Promise<void>;
  /** Optional direct read used only for bounded stale-if-error recovery. */
  get?: <V>(key: string) => Promise<V | undefined>;
};

export type PersonalizedPublicInput<T> = {
  readonly value: T;
};

export type PersonalizedPrivateInput<T> = {
  /** Branded request-local value: only a private loader may produce it. */
  readonly value: T;
  readonly brand: "croco-private-input";
};

export function createPrivateInput<T>(value: T): PersonalizedPrivateInput<T> {
  return { value, brand: "croco-private-input" };
}

export type PersonalizedFragmentLoader<T> = {
  readonly zone: Exclude<PersonalizedCacheZone, "private">;
  readonly domain?: string;
  /**
   * Fragment bytes must be the JSON serialization of `value`: cache hits
   * rehydrate with `JSON.parse(bytes)`, so HTML or other non-JSON payloads
   * are rejected with a registered Problem instead of parsed.
   */
  readonly load: () => Promise<{ readonly value: T; readonly bytes: string }>;
};

export type PersonalizedPrivateLoader<T> = {
  readonly zone: "private";
  readonly load: () => Promise<T>;
};

export type PersonalizedRenderInput<TPublic, TVariant, TPrivate> = {
  readonly public: PersonalizedPublicInput<TPublic>;
  readonly variant?: PersonalizedPublicInput<TVariant>;
  readonly privateInput: PersonalizedPrivateInput<TPrivate>;
};

export type PersonalizedFragmentResult<TPublic, TVariant, TPrivate> = {
  readonly public: TPublic;
  readonly variant: TVariant | undefined;
  readonly privateValue: TPrivate;
  readonly cache: {
    readonly publicSource: "cache" | "render";
    readonly variantSource: "cache" | "render" | "absent";
    readonly publicKeyHash: string;
    readonly variantKeyHash: string | undefined;
  };
};

export type PersonalizedFragmentCacheOptions<TPublic, TVariant, TPrivate> = {
  readonly store: PersonalizedFragmentStore;
  readonly policy: PersonalizedCachePolicy;
  readonly publicLoader: PersonalizedFragmentLoader<TPublic>;
  readonly variantLoader?: PersonalizedFragmentLoader<TVariant>;
  /** Explicit variant allow-list resolved by a trusted server decision. */
  readonly allowedVariants?: readonly string[];
  readonly privateLoader: PersonalizedPrivateLoader<TPrivate>;
  /** Final representation scope: html and flight fragments never share keys. */
  readonly representation?: "html" | "flight";
  /** Per-request access check; denial bypasses shared caches without caching. */
  readonly authorization?: (input: {
    readonly zone: PersonalizedCacheZone;
  }) => boolean | Promise<boolean>;
  readonly signal?: AbortSignal;
  readonly now?: () => number;
  readonly inspect?: (event: PersonalizedFragmentInspectEvent) => void;
};

export type PersonalizedFragmentInspectEvent = {
  readonly outcome: "hit" | "miss" | "bypass";
  readonly zone: PersonalizedCacheZone;
  readonly reason: string;
  /** SHA-256 hash of the cache key; raw keys never leave this module. */
  readonly keyHash: string;
  readonly dependencyCount: number;
  readonly dimensionCount: number;
  /** Allow-listed dimension names only; values stay hashed in the key. */
  readonly dimensionNames: readonly string[];
  /** Dependency names only; revisions stay hashed in the key. */
  readonly dependencyNames: readonly string[];
  readonly revision: string;
  readonly representation: "html" | "flight";
  /** Fresh lifetime of the zone policy; expiry = cachedAt + ttlMs. */
  readonly ttlMs: number;
  /** Exact invalidation reference: hash of the stored fragment key. */
  readonly invalidationRef: string;
};

type StoredFragment = {
  readonly bytes: string;
  readonly value: unknown;
  readonly valueHash: string;
  readonly cachedAtMs: number;
  readonly revision: string;
  readonly dependencies: readonly PersonalizedCacheDependency[];
};

export async function loadPersonalizedFragments<TPublic, TVariant, TPrivate>(
  options: PersonalizedFragmentCacheOptions<TPublic, TVariant, TPrivate>,
): Promise<PersonalizedFragmentResult<TPublic, TVariant, TPrivate>> {
  const nowMs = options.now?.() ?? Date.now();
  const publicZone = options.policy.zones["public"];
  const variantZone = options.policy.zones["variant"];
  const privateZone = options.policy.zones["private"];

  const publicKey = createPersonalizedCacheKey(
    options.policy,
    "public",
    options.representation ?? "html",
  );
  const representation = options.representation ?? "html";
  const publicEntry = await resolveFragment<TPublic>({
    store: options.store,
    key: publicKey,
    zone: "public",
    loader: options.publicLoader,
    expectedDimensions: publicZone.dimensions,
    expectedDependencies: publicZone.dependencies,
    expectedRevision: publicZone.revision,
    freshness: publicZone.freshness,
    representation,
    authorization: options.authorization,
    signal: options.signal,
    nowMs,
    inspect: options.inspect,
  });

  let variantEntry:
    | { readonly value: TVariant; readonly source: "cache" | "render"; readonly key: string }
    | undefined;
  if (options.variantLoader !== undefined) {
    if (variantZone === undefined) {
      throw new PersonalizedFragmentProblem(
        "Variant loader requires a variant zone in the cache policy.",
        { reason: "variant-zone-missing" },
      );
    }
    options.signal?.throwIfAborted();
    if (!(await isAuthorized(options.authorization, "variant"))) {
      options.inspect?.({
        outcome: "bypass",
        zone: "variant",
        reason: "unauthorized",
        keyHash: hashKey("(variant-unauthorized)"),
        dependencyCount: variantZone.dependencies.length,
        dimensionCount: Object.keys(variantZone.dimensions).length,
        dimensionNames: dimensionNamesOf(variantZone.dimensions),
        dependencyNames: dependencyNamesOf(variantZone.dependencies),
        revision: variantZone.revision,
        representation,
        ttlMs: variantZone.freshness.ttlMs,
        invalidationRef: hashKey("(variant-unauthorized)"),
      });
      const fresh = await options.variantLoader.load();
      options.signal?.throwIfAborted();
      variantEntry = { value: fresh.value, source: "render", key: "(bypass)" };
    } else if (variantZone.bypassSharedCache) {
      options.inspect?.({
        outcome: "bypass",
        zone: "variant",
        reason: variantZone.bypassReason ?? "bypass requested",
        keyHash: hashKey("(variant-bypass)"),
        dependencyCount: variantZone.dependencies.length,
        dimensionCount: Object.keys(variantZone.dimensions).length,
        dimensionNames: dimensionNamesOf(variantZone.dimensions),
        dependencyNames: dependencyNamesOf(variantZone.dependencies),
        revision: variantZone.revision,
        representation,
        ttlMs: variantZone.freshness.ttlMs,
        invalidationRef: hashKey("(variant-bypass)"),
      });
      const fresh = await options.variantLoader.load();
      options.signal?.throwIfAborted();
      variantEntry = { value: fresh.value, source: "render", key: "(bypass)" };
    } else {
      assertTrustedVariant(variantZone.dimensions["variant"], options.allowedVariants);
      const variantKey = createPersonalizedCacheKey(options.policy, "variant", representation);
      const resolved = await resolveFragment<TVariant>({
        store: options.store,
        key: variantKey,
        zone: "variant",
        loader: options.variantLoader,
        expectedDimensions: variantZone.dimensions,
        expectedDependencies: variantZone.dependencies,
        expectedRevision: variantZone.revision,
        freshness: variantZone.freshness,
        representation,
        authorization: options.authorization,
        signal: options.signal,
        nowMs,
        inspect: options.inspect,
      });
      variantEntry = { value: resolved.value, source: resolved.source, key: variantKey };
    }
  }

  options.signal?.throwIfAborted();
  const privateValue = await options.privateLoader.load();
  options.signal?.throwIfAborted();
  if (privateZone !== undefined) {
    const privateHash = hashKey("(private-request-local)");
    options.inspect?.({
      outcome: "bypass",
      zone: "private",
      reason: privateZone.bypassReason ?? "private-request-local",
      keyHash: privateHash,
      dependencyCount: privateZone.dependencies.length,
      dimensionCount: Object.keys(privateZone.dimensions).length,
      dimensionNames: dimensionNamesOf(privateZone.dimensions),
      dependencyNames: dependencyNamesOf(privateZone.dependencies),
      revision: privateZone.revision,
      representation,
      ttlMs: privateZone.freshness.ttlMs,
      invalidationRef: privateHash,
    });
  }

  return {
    public: publicEntry.value,
    variant: variantEntry?.value,
    privateValue,
    cache: {
      publicSource: publicEntry.source,
      variantSource: variantEntry === undefined ? "absent" : variantEntry.source,
      publicKeyHash: hashKey(publicKey),
      variantKeyHash: variantEntry === undefined ? undefined : hashKey(variantEntry.key),
    },
  };
}

/**
 * Compose a personalized response from already-resolved fragment inputs.
 * Private input is branded so public values cannot flow into it by accident.
 * Callers must send the result with a non-cacheable response signal
 * (`Cache-Control: private, no-store` or an identity `Vary`); composed
 * bodies combine shared fragments with request-local values and this
 * helper has no shared-cache handle, so it cannot enforce that marking.
 */
export function renderPersonalizedResponse<TPublic, TVariant, TPrivate>(input: {
  readonly fragments: PersonalizedRenderInput<TPublic, TVariant, TPrivate>;
  readonly representation: "html" | "flight";
  readonly deployId: string;
  readonly render: (fragments: PersonalizedRenderInput<TPublic, TVariant, TPrivate>) => string;
}): {
  readonly body: string;
  readonly representation: "html" | "flight";
  readonly deployId: string;
} {
  if (input.representation !== "html" && input.representation !== "flight") {
    throw new PersonalizedFragmentProblem(
      `Unsupported personalized representation '${input.representation}'.`,
      { reason: "unsupported-representation" },
    );
  }
  if (input.fragments.privateInput.brand !== "croco-private-input") {
    throw new PersonalizedFragmentProblem(
      "Private fragment input must be created by a private loader.",
      { reason: "private-input-unbranded" },
    );
  }
  return {
    body: input.render(input.fragments),
    representation: input.representation,
    deployId: input.deployId,
  };
}

export function hashPersonalizedCacheKey(key: string): string {
  return hashKey(key);
}

/**
 * Render one inspect event as a single PII-safe line for API/CLI output.
 * Only key hashes, counts, allow-listed names, revisions, and reasons appear;
 * raw keys, dimension values, and private payloads never appear.
 */
export function formatPersonalizedInspectEvent(event: PersonalizedFragmentInspectEvent): string {
  return [
    "personalized-cache",
    `zone=${event.zone}`,
    `outcome=${event.outcome}`,
    `reason=${event.reason}`,
    `key=sha256:${event.keyHash}`,
    `dependencies=${event.dependencyCount}[${event.dependencyNames.join(",")}]`,
    `dimensions=${event.dimensionCount}[${event.dimensionNames.join(",")}]`,
    `revision=${event.revision}`,
    `representation=${event.representation}`,
    `ttlMs=${event.ttlMs}`,
    `invalidate=sha256:${event.invalidationRef}`,
  ].join(" ");
}

async function resolveFragment<T>(input: {
  readonly store: PersonalizedFragmentStore;
  readonly key: string;
  readonly zone: Exclude<PersonalizedCacheZone, "private">;
  readonly loader: PersonalizedFragmentLoader<T>;
  readonly expectedDimensions: Readonly<Record<string, string>>;
  readonly expectedDependencies: readonly PersonalizedCacheDependency[];
  readonly expectedRevision: string;
  readonly freshness: PersonalizedCacheFreshnessPolicy;
  readonly representation: "html" | "flight";
  readonly authorization?: (input: {
    readonly zone: PersonalizedCacheZone;
  }) => boolean | Promise<boolean>;
  readonly signal?: AbortSignal;
  readonly nowMs: number;
  readonly inspect?: (event: PersonalizedFragmentInspectEvent) => void;
}): Promise<{ readonly value: T; readonly source: "cache" | "render" }> {
  const keyHash = hashKey(input.key);
  const base = {
    zone: input.zone,
    keyHash,
    dependencyCount: input.expectedDependencies.length,
    dimensionCount: Object.keys(input.expectedDimensions).length + 1,
    dimensionNames: [...dimensionNamesOf(input.expectedDimensions), "representation"].sort(),
    dependencyNames: input.expectedDependencies.map((entry) => entry.name),
    revision: input.expectedRevision,
    representation: input.representation,
    ttlMs: input.freshness.ttlMs,
    invalidationRef: keyHash,
  };

  input.signal?.throwIfAborted();
  if (!(await isAuthorized(input.authorization, input.zone))) {
    input.inspect?.({ ...base, outcome: "bypass", reason: "unauthorized" });
    const fresh = await fillFragment({ ...input, signal: input.signal });
    input.signal?.throwIfAborted();
    return { value: parseValue<T>(fresh.bytes, fresh.value), source: "render" };
  }

  let filled = false;
  let stored: StoredFragment;
  // Physical retention covers the full servable window (fresh + SWR +
  // stale-if-error); logical serving is decided by isPersonalizedCacheFresh.
  const retention = retentionMs(input.freshness);
  try {
    stored = await input.store.getOrSet<StoredFragment>(
      input.key,
      () => {
        filled = true;
        return fillFragment(input);
      },
      { ttlMs: retention },
    );
  } catch (error) {
    // Source failure: serve a bounded stale copy when the policy allows it,
    // otherwise surface the error without publishing a partial payload.
    // InMemory-like stores may throw the probe signal instead of returning
    // a value, so fall back to a direct stale read when getOrSet rejects.
    const stale = (await readStaleIfAllowed(input)) ?? (await readStaleDirect(input));
    if (stale !== undefined) {
      input.inspect?.({ ...base, outcome: "hit", reason: "stale-if-error" });
      return { value: parseValue<T>(stale.bytes, stale.value), source: "cache" };
    }
    throw error;
  }
  input.signal?.throwIfAborted();
  if (stored === undefined) {
    // Cancellation raced the fill: the store published nothing, so resolve
    // request-local without treating it as a successful shared hit.
    input.inspect?.({ ...base, outcome: "bypass", reason: "cancelled" });
    const fresh = await fillFragment(input);
    return { value: parseValue<T>(fresh.bytes, fresh.value), source: "render" };
  }
  if (filled) {
    input.inspect?.({ ...base, outcome: "miss", reason: "miss" });
    return { value: parseValue<T>(stored.bytes, stored.value), source: "render" };
  }

  const freshness = isPersonalizedCacheFresh(
    {
      cachedAtMs: stored.cachedAtMs,
      nowMs: input.nowMs,
      revision: stored.revision,
      expectedRevision: input.expectedRevision,
      dependencies: stored.dependencies,
      expectedDependencies: input.expectedDependencies,
      domain: input.loader.domain,
    },
    input.freshness,
  );

  if (freshness.fresh) {
    const hit = freshness.reason === "fresh";
    input.inspect?.({
      ...base,
      outcome: hit ? "hit" : "miss",
      reason: freshness.reason,
    });
    if (freshness.reason.startsWith("stale-while-revalidate")) {
      // Background refresh must outlive the foreground request: the caller
      // may abort after receiving the stale body, so detach its signal.
      void revalidateFragment({ ...input, signal: undefined }).catch(() => {});
    }
    return { value: parseValue<T>(stored.bytes, stored.value), source: "cache" };
  }

  input.inspect?.({ ...base, outcome: "miss", reason: freshness.reason });
  let fresh: StoredFragment;
  try {
    fresh = await fillFragment(input);
  } catch (error) {
    // Genuinely expired with no SWR: still allow one bounded stale-if-error
    // read of the previous full fragment when the domain permits it.
    const stale = (await readStaleIfAllowed(input)) ?? (await readStaleDirect(input));
    if (stale !== undefined) {
      input.inspect?.({ ...base, outcome: "hit", reason: "stale-if-error" });
      return { value: parseValue<T>(stale.bytes, stale.value), source: "cache" };
    }
    throw error;
  }
  try {
    await input.store.invalidate(input.key);
    await input.store.getOrSet<StoredFragment>(input.key, async () => fresh, {
      ttlMs: retention,
    });
  } catch (error) {
    // Cache persistence is best-effort: a concurrent fill may win the race,
    // or the store may reject the write. Either way the freshly loaded value
    // is already in hand, so report the write outcome and return it instead
    // of falling back to a stale copy.
    void error;
    input.inspect?.({ ...base, outcome: "miss", reason: "cache-write-failed" });
  }
  return { value: parseValue<T>(fresh.bytes, fresh.value), source: "render" };
}

async function fillFragment<T>(input: {
  readonly key: string;
  readonly expectedDependencies: readonly PersonalizedCacheDependency[];
  readonly expectedRevision: string;
  readonly nowMs: number;
  readonly loader: PersonalizedFragmentLoader<T>;
  readonly signal?: AbortSignal;
}): Promise<StoredFragment> {
  input.signal?.throwIfAborted();
  const loaded = await input.loader.load();
  input.signal?.throwIfAborted();
  if (loaded.bytes.length === 0) {
    throw new PersonalizedFragmentProblem("Fragment loader returned empty bytes.", {
      reason: "empty-fragment",
    });
  }
  try {
    JSON.parse(loaded.bytes);
  } catch {
    throw new PersonalizedFragmentProblem(
      "Fragment bytes must be the JSON serialization of value.",
      {
        reason: "fragment-bytes-not-json",
      },
    );
  }
  return {
    bytes: loaded.bytes,
    value: loaded.value,
    valueHash: hashKey(loaded.bytes),
    cachedAtMs: input.nowMs,
    revision: input.expectedRevision,
    dependencies: [...input.expectedDependencies],
  };
}

async function revalidateFragment<T>(input: {
  readonly store: PersonalizedFragmentStore;
  readonly key: string;
  readonly loader: PersonalizedFragmentLoader<T>;
  readonly expectedDependencies: readonly PersonalizedCacheDependency[];
  readonly expectedRevision: string;
  readonly freshness: PersonalizedCacheFreshnessPolicy;
  readonly nowMs: number;
  readonly signal?: AbortSignal;
}): Promise<void> {
  try {
    const fresh = await fillFragment(input);
    await input.store.invalidate(input.key);
    await input.store.getOrSet<StoredFragment>(input.key, async () => fresh, {
      ttlMs: retentionMs(input.freshness),
    });
  } catch (error) {
    void error;
    // Background revalidation is best-effort; the stale response already went out.
    // The empty catch documents intentional best-effort recovery; reviewed in
    // scripts/static-misuse-empty-catch-allowlist.json.
  }
}

/**
 * Failure/cancel note: this module never publishes failed, cancelled, or
 * partial fills. Loader errors propagate without writing, `undefined` store
 * results (cancellation racing a fill) resolve request-local, and
 * `stale-if-error` only serves an already-stored full fragment inside its
 * explicit bound. Long-lived private copies are never retained.
 */
async function readStaleIfAllowed<T>(input: {
  readonly store: PersonalizedFragmentStore;
  readonly key: string;
  readonly expectedDependencies: readonly PersonalizedCacheDependency[];
  readonly expectedRevision: string;
  readonly freshness: PersonalizedCacheFreshnessPolicy;
  readonly loader: PersonalizedFragmentLoader<T>;
  readonly nowMs: number;
}): Promise<StoredFragment | undefined> {
  const budgetMs = input.freshness.staleIfErrorMs ?? 0;
  if (budgetMs <= 0) {
    return undefined;
  }
  if (
    input.freshness.noStaleDomains?.includes(input.loader.domain ?? "") === true ||
    input.loader.domain === "price" ||
    input.loader.domain === "eligibility" ||
    input.loader.domain === "balance"
  ) {
    return undefined;
  }
  let stale: StoredFragment | undefined;
  try {
    stale = await input.store.getOrSet<StoredFragment>(
      input.key,
      async () => {
        throw new PersonalizedFragmentProblem("stale-if-error probe must not fill.", {
          reason: "stale-probe-no-fill",
        });
      },
      { ttlMs: retentionMs(input.freshness) },
    );
  } catch (error) {
    void error;
    return undefined;
  }
  if (stale === undefined) {
    return undefined;
  }
  const freshness = isPersonalizedCacheFresh(
    {
      cachedAtMs: stale.cachedAtMs,
      nowMs: input.nowMs,
      revision: stale.revision,
      expectedRevision: input.expectedRevision,
      dependencies: stale.dependencies,
      expectedDependencies: input.expectedDependencies,
      domain: input.loader.domain,
    },
    input.freshness,
  );
  if (freshness.fresh) {
    return stale;
  }
  if (freshness.reason !== "expired") {
    return undefined;
  }
  if (input.nowMs - stale.cachedAtMs > input.freshness.ttlMs + budgetMs) {
    return undefined;
  }
  // Expired but inside the explicit stale-if-error bound with matching
  // revision/dependencies: safe to serve once while the source recovers.
  return stale;
}

async function readStaleDirect<T>(input: {
  readonly store: PersonalizedFragmentStore;
  readonly key: string;
  readonly expectedDependencies: readonly PersonalizedCacheDependency[];
  readonly expectedRevision: string;
  readonly freshness: PersonalizedCacheFreshnessPolicy;
  readonly loader: PersonalizedFragmentLoader<T>;
  readonly nowMs: number;
}): Promise<StoredFragment | undefined> {
  if (typeof input.store.get !== "function") {
    return undefined;
  }
  const stale = await input.store.get<StoredFragment>(input.key);
  if (stale === undefined) {
    return undefined;
  }
  const budgetMs = input.freshness.staleIfErrorMs ?? 0;
  if (budgetMs <= 0) {
    return undefined;
  }
  if (
    input.freshness.noStaleDomains?.includes(input.loader.domain ?? "") === true ||
    input.loader.domain === "price" ||
    input.loader.domain === "eligibility" ||
    input.loader.domain === "balance"
  ) {
    return undefined;
  }
  const freshness = isPersonalizedCacheFresh(
    {
      cachedAtMs: stale.cachedAtMs,
      nowMs: input.nowMs,
      revision: stale.revision,
      expectedRevision: input.expectedRevision,
      dependencies: stale.dependencies,
      expectedDependencies: input.expectedDependencies,
      domain: input.loader.domain,
    },
    input.freshness,
  );
  if (freshness.fresh || freshness.reason !== "expired") {
    return undefined;
  }
  if (input.nowMs - stale.cachedAtMs > input.freshness.ttlMs + budgetMs) {
    return undefined;
  }
  return stale;
}

function retentionMs(freshness: PersonalizedCacheFreshnessPolicy): number {
  return (
    freshness.ttlMs + (freshness.staleWhileRevalidateMs ?? 0) + (freshness.staleIfErrorMs ?? 0)
  );
}

function parseValue<T>(bytes: string, value: unknown): T {
  try {
    return JSON.parse(bytes) as T;
  } catch {
    // fillFragment rejects non-JSON bytes at write time, so a parse failure
    // here means the shared store was seeded outside this module; fail
    // through the registered Problem instead of leaking a raw SyntaxError.
    void value;
    throw new PersonalizedFragmentProblem("Stored fragment bytes are not JSON-serialized.", {
      reason: "fragment-bytes-not-json",
    });
  }
}

function assertTrustedVariant(
  variant: string | undefined,
  allowedVariants: readonly string[] | undefined,
): void {
  if (variant === undefined || variant.length === 0) {
    throw new PersonalizedFragmentProblem("Variant zone requires an explicit trusted variant.", {
      reason: "variant-missing",
    });
  }
  if (allowedVariants !== undefined && !allowedVariants.includes(variant)) {
    throw new PersonalizedFragmentProblem(`Untrusted variant '${variant}' rejected.`, {
      reason: "variant-untrusted",
    });
  }
}

function hashKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function isAuthorized(
  authorization:
    | ((input: { readonly zone: PersonalizedCacheZone }) => boolean | Promise<boolean>)
    | undefined,
  zone: PersonalizedCacheZone,
): Promise<boolean> {
  if (authorization === undefined) {
    return true;
  }
  return (await authorization({ zone })) === true;
}

function dimensionNamesOf(dimensions: Readonly<Record<string, string>>): readonly string[] {
  return Object.keys(dimensions).sort();
}

function dependencyNamesOf(
  dependencies: readonly PersonalizedCacheDependency[],
): readonly string[] {
  return dependencies.map((entry) => entry.name).sort();
}
