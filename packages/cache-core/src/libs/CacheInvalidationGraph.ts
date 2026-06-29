import type { CachePattern, CacheStore } from "./CacheStore";
import {
  CacheInvalidationAssertionProblem,
  CacheInvalidationFailedProblem,
  CacheInvalidationGraphProblem,
  UnknownCacheInvalidationEventProblem,
  UnsupportedCacheInvalidationCapabilityProblem,
} from "./problems/CacheDecoratorProblems";
import type { CacheInvalidationDiagnostic } from "./problems/CacheDecoratorProblems";

export const CACHE_INVALIDATION_MANIFEST_SCHEMA_VERSION =
  "croco.cache-invalidation-graph.manifest.v1" as const;
export const CACHE_ADAPTER_CAPABILITY_MANIFEST_SCHEMA_VERSION =
  "croco.cache-adapter-capabilities.v1" as const;

export type CacheInvalidationManifestSchemaVersion =
  typeof CACHE_INVALIDATION_MANIFEST_SCHEMA_VERSION;
export type CacheAdapterCapabilityManifestSchemaVersion =
  typeof CACHE_ADAPTER_CAPABILITY_MANIFEST_SCHEMA_VERSION;

export type CacheInvalidationManifestStatus = "ready" | "failed";

export type CacheInvalidationEventDeclaration = {
  readonly description?: string;
  readonly eventName: string;
};

export type CacheKeyDeclaration = {
  readonly description?: string;
  readonly id: string;
  readonly key?: string;
  readonly pattern?: CachePattern;
};

export type CacheTagDeclaration = {
  readonly description?: string;
  readonly id: string;
  readonly tag: string;
};

export type CacheInvalidationReference =
  | {
      readonly id: string;
      readonly kind: "key";
    }
  | {
      readonly id: string;
      readonly kind: "tag";
    };

export type CacheInvalidationRule = {
  readonly eventName: string;
  readonly invalidates: readonly CacheInvalidationReference[];
};

export type CacheInvalidationGraphDefinition = {
  readonly events: readonly CacheInvalidationEventDeclaration[];
  readonly keys: readonly CacheKeyDeclaration[];
  readonly rules: readonly CacheInvalidationRule[];
  readonly tags?: readonly CacheTagDeclaration[];
};

export type CacheInvalidationManifestOperation =
  | {
      readonly id: string;
      readonly key: string;
      readonly kind: "key";
    }
  | {
      readonly id: string;
      readonly kind: "pattern";
      readonly pattern: CachePattern;
    }
  | {
      readonly id: string;
      readonly kind: "tag";
      readonly tag: string;
    };

export type CacheInvalidationManifestEvent = {
  readonly eventName: string;
  readonly invalidates: readonly CacheInvalidationManifestOperation[];
};

export type CacheInvalidationManifest = {
  readonly diagnostics: readonly CacheInvalidationDiagnostic[];
  readonly events: readonly CacheInvalidationManifestEvent[];
  readonly schemaVersion: CacheInvalidationManifestSchemaVersion;
  readonly status: CacheInvalidationManifestStatus;
};

export type CacheInvalidationAdapterCapabilities = {
  readonly exactKey: boolean;
  readonly pattern: boolean;
  readonly tag: boolean;
};

export type CacheInvalidationAdapterOperationResult = {
  readonly affectedCount?: number;
};

export type CacheInvalidationAdapter = {
  readonly capabilities: CacheInvalidationAdapterCapabilities;
  readonly name?: string;
  readonly invalidateKey?: (key: string) => Promise<CacheInvalidationAdapterOperationResult | void>;
  readonly invalidatePattern?: (
    pattern: CachePattern,
  ) => Promise<CacheInvalidationAdapterOperationResult | void>;
  readonly invalidateTag?: (tag: string) => Promise<CacheInvalidationAdapterOperationResult | void>;
};

export type CacheAdapterCapabilityManifest = {
  readonly adapterName: string;
  readonly capabilities: CacheInvalidationAdapterCapabilities;
  readonly schemaVersion: CacheAdapterCapabilityManifestSchemaVersion;
};

export type CacheStoreInvalidationAdapterOptions = {
  readonly name?: string;
};

export type CacheInvalidationAppliedOperation = CacheInvalidationManifestOperation & {
  readonly affectedCount?: number;
};

export type CacheInvalidationResult = {
  readonly eventName: string;
  readonly operations: readonly CacheInvalidationAppliedOperation[];
};

export type CacheInvalidationTelemetryContext = {
  readonly adapterName: string;
  readonly eventName: string;
  readonly operation: CacheInvalidationManifestOperation;
};

export type CacheInvalidationTelemetryEvent = CacheInvalidationTelemetryContext & {
  readonly affectedCount?: number;
  readonly kind: "cache.invalidation.applied";
};

export type CacheInvalidationTelemetrySink = {
  readonly recordError?: (
    problem: CacheInvalidationFailedProblem,
    context: CacheInvalidationTelemetryContext,
  ) => void;
  readonly recordEvent?: (event: CacheInvalidationTelemetryEvent) => void;
};

export type CacheInvalidationEventLike =
  | string
  | {
      readonly eventName: string;
    };

export type InvalidateCacheForEventOptions = {
  readonly adapter: CacheInvalidationAdapter;
  readonly event: CacheInvalidationEventLike;
  readonly manifest: CacheInvalidationManifest;
  readonly telemetry?: CacheInvalidationTelemetrySink;
};

export type AssertCacheInvalidatesForEventOptions = {
  readonly eventName: string;
  readonly expectedInvalidations: readonly CacheInvalidationManifestOperation[];
  readonly manifest: CacheInvalidationManifest;
};

export function defineCacheInvalidationEvent(
  event: CacheInvalidationEventDeclaration,
): CacheInvalidationEventDeclaration {
  return event;
}

export function defineCacheKey(key: CacheKeyDeclaration): CacheKeyDeclaration {
  return key;
}

export function defineCacheTag(tag: CacheTagDeclaration): CacheTagDeclaration {
  return tag;
}

export function defineCacheInvalidationRule(rule: CacheInvalidationRule): CacheInvalidationRule {
  return rule;
}

export function defineCacheInvalidationGraph(
  graph: CacheInvalidationGraphDefinition,
): CacheInvalidationGraphDefinition {
  return graph;
}

export function invalidateCacheKey(id: string): CacheInvalidationReference {
  return { id, kind: "key" };
}

export function invalidateCacheTag(id: string): CacheInvalidationReference {
  return { id, kind: "tag" };
}

export function createCacheInvalidationManifest(
  graph: CacheInvalidationGraphDefinition,
): CacheInvalidationManifest {
  const diagnostics: CacheInvalidationDiagnostic[] = [];
  const events = createEventMap(graph.events, diagnostics);
  const keys = createCacheKeyMap(graph.keys, diagnostics);
  const tags = createCacheTagMap(graph.tags ?? [], diagnostics);
  const invalidationsByEvent = new Map<string, CacheInvalidationManifestOperation[]>();

  for (const rule of graph.rules) {
    validateRule(rule, events, keys, tags, diagnostics);

    if (!events.has(rule.eventName)) {
      continue;
    }

    const operations = invalidationsByEvent.get(rule.eventName) ?? [];
    for (const reference of rule.invalidates) {
      const operation = createManifestOperation(reference, keys, tags);

      if (operation !== undefined) {
        operations.push(operation);
      }
    }
    invalidationsByEvent.set(rule.eventName, operations);
  }

  return {
    diagnostics: diagnostics.sort(compareDiagnostics),
    events: Array.from(events.keys())
      .sort()
      .map((eventName) => ({
        eventName,
        invalidates: deduplicateOperations(invalidationsByEvent.get(eventName) ?? []).sort(
          compareOperations,
        ),
      })),
    schemaVersion: CACHE_INVALIDATION_MANIFEST_SCHEMA_VERSION,
    status: diagnostics.length === 0 ? "ready" : "failed",
  };
}

export function serializeCacheInvalidationManifest(manifest: CacheInvalidationManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function assertCacheInvalidationGraphValid(
  input: CacheInvalidationGraphDefinition | CacheInvalidationManifest,
): CacheInvalidationManifest {
  const manifest = isCacheInvalidationManifest(input)
    ? input
    : createCacheInvalidationManifest(input);

  if (manifest.status !== "ready" || manifest.diagnostics.length > 0) {
    throw new CacheInvalidationGraphProblem(manifest.diagnostics);
  }

  return manifest;
}

export function createCacheStoreInvalidationAdapter(
  store: CacheStore<string, unknown>,
  options: CacheStoreInvalidationAdapterOptions = {},
): CacheInvalidationAdapter {
  return {
    capabilities: {
      exactKey: true,
      pattern: true,
      tag: false,
    },
    invalidateKey: async (key) => {
      await store.delete(key);
    },
    invalidatePattern: async (pattern) => {
      const affectedCount = await store.invalidatePattern(pattern);
      return { affectedCount };
    },
    name: options.name ?? "cache-store",
  };
}

export function createCacheAdapterCapabilityManifest(
  adapter: CacheInvalidationAdapter,
): CacheAdapterCapabilityManifest {
  return {
    adapterName: resolveAdapterName(adapter),
    capabilities: adapter.capabilities,
    schemaVersion: CACHE_ADAPTER_CAPABILITY_MANIFEST_SCHEMA_VERSION,
  };
}

export async function invalidateCacheForEvent(
  options: InvalidateCacheForEventOptions,
): Promise<CacheInvalidationResult> {
  const manifest = assertCacheInvalidationGraphValid(options.manifest);
  const eventName = resolveEventName(options.event);
  const event = manifest.events.find((candidate) => candidate.eventName === eventName);

  if (event === undefined) {
    throw new UnknownCacheInvalidationEventProblem(eventName);
  }

  const adapterName = resolveAdapterName(options.adapter);
  const operations: CacheInvalidationAppliedOperation[] = [];

  for (const operation of event.invalidates) {
    const context = {
      adapterName,
      eventName,
      operation,
    };

    try {
      const appliedOperation = await applyInvalidationOperation(options.adapter, operation);
      operations.push(appliedOperation);
      recordTelemetryEvent(options.telemetry, {
        ...context,
        ...affectedCountObject(appliedOperation.affectedCount),
        kind: "cache.invalidation.applied",
      });
    } catch (cause) {
      const problem = new CacheInvalidationFailedProblem(eventName, adapterName, operation, cause);
      recordTelemetryError(options.telemetry, problem, context);
      throw problem;
    }
  }

  return {
    eventName,
    operations,
  };
}

export function assertCacheInvalidatesForEvent(
  options: AssertCacheInvalidatesForEventOptions,
): void {
  const manifest = assertCacheInvalidationGraphValid(options.manifest);
  const event = manifest.events.find((candidate) => candidate.eventName === options.eventName);

  if (event === undefined) {
    throw new CacheInvalidationAssertionProblem(
      `Expected event '${options.eventName}' to be declared in the cache invalidation manifest.`,
    );
  }

  const actual = new Set(event.invalidates.map(operationKey));
  const missing = options.expectedInvalidations.filter(
    (operation) => !actual.has(operationKey(operation)),
  );

  if (missing.length > 0) {
    throw new CacheInvalidationAssertionProblem(
      `Expected event '${options.eventName}' to invalidate ${missing.map(formatOperation).join(", ")}.`,
    );
  }
}

function createEventMap(
  events: readonly CacheInvalidationEventDeclaration[],
  diagnostics: CacheInvalidationDiagnostic[],
): Map<string, CacheInvalidationEventDeclaration> {
  const map = new Map<string, CacheInvalidationEventDeclaration>();

  for (const event of events) {
    if (!isNonEmpty(event.eventName)) {
      diagnostics.push(
        createDiagnostic(
          "cache-invalidation/invalid-event-declaration",
          "events",
          "Cache invalidation events require a non-empty eventName.",
        ),
      );
      continue;
    }

    if (map.has(event.eventName)) {
      diagnostics.push(
        createDiagnostic(
          "cache-invalidation/duplicate-event",
          `events.${event.eventName}`,
          `Duplicate cache invalidation event '${event.eventName}'.`,
        ),
      );
      continue;
    }

    map.set(event.eventName, event);
  }

  return map;
}

function createCacheKeyMap(
  keys: readonly CacheKeyDeclaration[],
  diagnostics: CacheInvalidationDiagnostic[],
): Map<string, CacheKeyDeclaration> {
  const map = new Map<string, CacheKeyDeclaration>();

  for (const key of keys) {
    if (!isNonEmpty(key.id)) {
      diagnostics.push(
        createDiagnostic(
          "cache-invalidation/invalid-cache-key-declaration",
          "keys",
          "Cache key declarations require a non-empty id.",
        ),
      );
      continue;
    }

    if (map.has(key.id)) {
      diagnostics.push(
        createDiagnostic(
          "cache-invalidation/duplicate-cache-key",
          `keys.${key.id}`,
          `Duplicate cache key declaration '${key.id}'.`,
        ),
      );
      continue;
    }

    const hasKey = isNonEmpty(key.key);
    const hasPattern = isNonEmpty(key.pattern);
    if (hasKey === hasPattern) {
      diagnostics.push(
        createDiagnostic(
          "cache-invalidation/invalid-cache-key-declaration",
          `keys.${key.id}`,
          `Cache key declaration '${key.id}' must provide exactly one of key or pattern.`,
        ),
      );
      continue;
    }

    map.set(key.id, key);
  }

  return map;
}

function createCacheTagMap(
  tags: readonly CacheTagDeclaration[],
  diagnostics: CacheInvalidationDiagnostic[],
): Map<string, CacheTagDeclaration> {
  const map = new Map<string, CacheTagDeclaration>();

  for (const tag of tags) {
    if (!isNonEmpty(tag.id) || !isNonEmpty(tag.tag)) {
      diagnostics.push(
        createDiagnostic(
          "cache-invalidation/invalid-cache-tag-declaration",
          "tags",
          "Cache tag declarations require non-empty id and tag values.",
        ),
      );
      continue;
    }

    if (map.has(tag.id)) {
      diagnostics.push(
        createDiagnostic(
          "cache-invalidation/duplicate-cache-tag",
          `tags.${tag.id}`,
          `Duplicate cache tag declaration '${tag.id}'.`,
        ),
      );
      continue;
    }

    map.set(tag.id, tag);
  }

  return map;
}

function validateRule(
  rule: CacheInvalidationRule,
  events: ReadonlyMap<string, CacheInvalidationEventDeclaration>,
  keys: ReadonlyMap<string, CacheKeyDeclaration>,
  tags: ReadonlyMap<string, CacheTagDeclaration>,
  diagnostics: CacheInvalidationDiagnostic[],
): void {
  if (!events.has(rule.eventName)) {
    diagnostics.push(
      createDiagnostic(
        "cache-invalidation/unknown-event-reference",
        `rules.${rule.eventName}`,
        `Cache invalidation rule references unknown event '${rule.eventName}'.`,
      ),
    );
  }

  if (rule.invalidates.length === 0) {
    diagnostics.push(
      createDiagnostic(
        "cache-invalidation/empty-invalidation-rule",
        `rules.${rule.eventName}`,
        `Cache invalidation rule for event '${rule.eventName}' does not invalidate any cache key or tag.`,
      ),
    );
  }

  for (const reference of rule.invalidates) {
    if (reference.kind === "key" && !keys.has(reference.id)) {
      diagnostics.push(
        createDiagnostic(
          "cache-invalidation/orphan-cache-key-rule",
          `rules.${rule.eventName}.${reference.id}`,
          `Cache invalidation rule for event '${rule.eventName}' references unknown cache key '${reference.id}'.`,
        ),
      );
    }

    if (reference.kind === "tag" && !tags.has(reference.id)) {
      diagnostics.push(
        createDiagnostic(
          "cache-invalidation/orphan-cache-tag-rule",
          `rules.${rule.eventName}.${reference.id}`,
          `Cache invalidation rule for event '${rule.eventName}' references unknown cache tag '${reference.id}'.`,
        ),
      );
    }
  }
}

function createManifestOperation(
  reference: CacheInvalidationReference,
  keys: ReadonlyMap<string, CacheKeyDeclaration>,
  tags: ReadonlyMap<string, CacheTagDeclaration>,
): CacheInvalidationManifestOperation | undefined {
  if (reference.kind === "tag") {
    const tag = tags.get(reference.id);
    return tag === undefined ? undefined : { id: tag.id, kind: "tag", tag: tag.tag };
  }

  const key = keys.get(reference.id);

  if (key === undefined) {
    return undefined;
  }

  if (key.pattern !== undefined) {
    return { id: key.id, kind: "pattern", pattern: key.pattern };
  }

  if (key.key !== undefined) {
    return { id: key.id, key: key.key, kind: "key" };
  }

  return undefined;
}

function deduplicateOperations(
  operations: readonly CacheInvalidationManifestOperation[],
): CacheInvalidationManifestOperation[] {
  const byKey = new Map<string, CacheInvalidationManifestOperation>();

  for (const operation of operations) {
    byKey.set(operationKey(operation), operation);
  }

  return Array.from(byKey.values());
}

async function applyInvalidationOperation(
  adapter: CacheInvalidationAdapter,
  operation: CacheInvalidationManifestOperation,
): Promise<CacheInvalidationAppliedOperation> {
  if (operation.kind === "key") {
    assertCapability(adapter, "exactKey", operation);
    const result = await adapter.invalidateKey?.(operation.key);
    return { ...operation, ...affectedCountObject(result?.affectedCount) };
  }

  if (operation.kind === "pattern") {
    assertCapability(adapter, "pattern", operation);
    const result = await adapter.invalidatePattern?.(operation.pattern);
    return { ...operation, ...affectedCountObject(result?.affectedCount) };
  }

  assertCapability(adapter, "tag", operation);
  const result = await adapter.invalidateTag?.(operation.tag);
  return { ...operation, ...affectedCountObject(result?.affectedCount) };
}

function assertCapability(
  adapter: CacheInvalidationAdapter,
  capability: keyof CacheInvalidationAdapterCapabilities,
  operation: CacheInvalidationManifestOperation,
): void {
  const methodAvailable =
    (capability === "exactKey" && adapter.invalidateKey !== undefined) ||
    (capability === "pattern" && adapter.invalidatePattern !== undefined) ||
    (capability === "tag" && adapter.invalidateTag !== undefined);

  if (!adapter.capabilities[capability] || !methodAvailable) {
    throw new UnsupportedCacheInvalidationCapabilityProblem(resolveAdapterName(adapter), operation);
  }
}

function isCacheInvalidationManifest(
  input: CacheInvalidationGraphDefinition | CacheInvalidationManifest,
): input is CacheInvalidationManifest {
  return (
    "schemaVersion" in input && input.schemaVersion === CACHE_INVALIDATION_MANIFEST_SCHEMA_VERSION
  );
}

function resolveEventName(event: CacheInvalidationEventLike): string {
  return typeof event === "string" ? event : event.eventName;
}

function resolveAdapterName(adapter: CacheInvalidationAdapter): string {
  return adapter.name ?? "cache-invalidation-adapter";
}

function createDiagnostic(
  code: string,
  target: string,
  message: string,
): CacheInvalidationDiagnostic {
  return {
    code,
    message,
    target,
  };
}

function compareDiagnostics(
  left: CacheInvalidationDiagnostic,
  right: CacheInvalidationDiagnostic,
): number {
  return (
    left.code.localeCompare(right.code) ||
    left.target.localeCompare(right.target) ||
    left.message.localeCompare(right.message)
  );
}

function compareOperations(
  left: CacheInvalidationManifestOperation,
  right: CacheInvalidationManifestOperation,
): number {
  return operationKey(left).localeCompare(operationKey(right));
}

function operationKey(operation: CacheInvalidationManifestOperation): string {
  if (operation.kind === "key") {
    return JSON.stringify([operation.id, "key", operation.key]);
  }

  if (operation.kind === "pattern") {
    return JSON.stringify([operation.id, "pattern", operation.pattern]);
  }

  return JSON.stringify([operation.id, "tag", operation.tag]);
}

function formatOperation(operation: CacheInvalidationManifestOperation): string {
  if (operation.kind === "key") {
    return `key:${operation.key}`;
  }

  if (operation.kind === "pattern") {
    return `pattern:${operation.pattern}`;
  }

  return `tag:${operation.tag}`;
}

function affectedCountObject(affectedCount: number | undefined): {
  readonly affectedCount?: number;
} {
  return affectedCount === undefined ? {} : { affectedCount };
}

function recordTelemetryEvent(
  telemetry: CacheInvalidationTelemetrySink | undefined,
  event: CacheInvalidationTelemetryEvent,
): void {
  try {
    telemetry?.recordEvent?.(event);
  } catch {
    // Telemetry is best-effort and must not replace the cache invalidation outcome.
  }
}

function recordTelemetryError(
  telemetry: CacheInvalidationTelemetrySink | undefined,
  problem: CacheInvalidationFailedProblem,
  context: CacheInvalidationTelemetryContext,
): void {
  try {
    telemetry?.recordError?.(problem, context);
  } catch {
    // Telemetry is best-effort and must not replace the adapter failure evidence.
  }
}

function isNonEmpty(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}
