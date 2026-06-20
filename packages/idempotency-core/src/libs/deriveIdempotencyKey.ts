import { InvalidIdempotencyKeyProblem } from "./problems/IdempotencyProblems";
import type {
  DerivedIdempotencyKey,
  DeriveIdempotencyKeyOptions,
  IdempotencyKeySource,
  IdempotencyTelemetryAttributes,
} from "./types";

const DEFAULT_NAMESPACE = "default";

type RequestFingerprintParts = {
  readonly method: string;
  readonly path: string;
  readonly bodyFingerprint: string;
  readonly queryFingerprint?: string;
  readonly headerFingerprint?: string;
};

export function deriveIdempotencyKey(options: DeriveIdempotencyKeyOptions): DerivedIdempotencyKey {
  const namespace = normalizeSegment(options.namespace ?? DEFAULT_NAMESPACE, "namespace");
  const tenantId = resolveTenantId(options);
  const source = options.source;
  const key = normalizeSegment(resolveSourceKey(source), "key");
  const fingerprint = normalizeSegment(resolveFingerprint(source), "fingerprint");
  const scope = tenantId === null ? "global" : "tenant";
  const storageKey = [
    encodeIdempotencySegment(namespace),
    scope,
    tenantId === null ? "global" : encodeIdempotencySegment(tenantId),
    source.kind,
    encodeIdempotencySegment(key),
  ].join(":");
  const telemetryAttributes = createIdempotencyTelemetryAttributes({
    fingerprint,
    key,
    namespace,
    scope,
    source: source.kind,
    tenantId,
  });

  return {
    key,
    fingerprint,
    namespace,
    tenantId,
    scope,
    source: source.kind,
    storageKey,
    telemetryAttributes,
  };
}

export function createIdempotencyTelemetryAttributes(
  key: Omit<DerivedIdempotencyKey, "storageKey" | "telemetryAttributes">,
): IdempotencyTelemetryAttributes {
  return {
    "croco.idempotency.key": key.key,
    "croco.idempotency.namespace": key.namespace,
    "croco.idempotency.scope": key.scope,
    ...(key.tenantId === null ? {} : { "croco.idempotency.tenant_id": key.tenantId }),
    "croco.idempotency.source": key.source,
    "croco.idempotency.fingerprint": key.fingerprint,
  };
}

export function deriveHttpIdempotencyKey(options: {
  readonly namespace?: string;
  readonly tenantId?: string | null;
  readonly idempotencyKey?: string;
  readonly method: string;
  readonly path: string;
  readonly bodyFingerprint: string;
  readonly queryFingerprint?: string;
  readonly headerFingerprint?: string;
}): DerivedIdempotencyKey {
  return deriveIdempotencyKey({
    namespace: options.namespace ?? "http",
    tenantId: options.tenantId,
    source:
      options.idempotencyKey === undefined
        ? {
            kind: "request-fingerprint",
            method: options.method,
            path: options.path,
            bodyFingerprint: options.bodyFingerprint,
            queryFingerprint: options.queryFingerprint,
            headerFingerprint: options.headerFingerprint,
          }
        : {
            kind: "explicit",
            key: options.idempotencyKey,
            fingerprint: requestFingerprint({
              method: options.method,
              path: options.path,
              bodyFingerprint: options.bodyFingerprint,
              queryFingerprint: options.queryFingerprint,
              headerFingerprint: options.headerFingerprint,
            }),
          },
  });
}

export function deriveWebhookIdempotencyKey(options: {
  readonly provider: string;
  readonly eventId: string;
  readonly tenantId?: string | null;
  readonly namespace?: string;
  readonly fingerprint?: string;
}): DerivedIdempotencyKey {
  return deriveIdempotencyKey({
    namespace: options.namespace ?? "webhook",
    tenantId: options.tenantId,
    source: {
      kind: "provider-event",
      provider: options.provider,
      eventId: options.eventId,
      fingerprint: options.fingerprint,
    },
  });
}

export function deriveTaskIdempotencyKey(options: {
  readonly taskName: string;
  readonly taskId: string;
  readonly tenantId?: string | null;
  readonly namespace?: string;
  readonly payloadFingerprint?: string;
}): DerivedIdempotencyKey {
  const key = stableStringify({
    taskId: options.taskId,
    taskName: options.taskName,
  });

  return deriveIdempotencyKey({
    namespace: options.namespace ?? "task",
    tenantId: options.tenantId,
    source: {
      kind: "explicit",
      key,
      fingerprint: options.payloadFingerprint ?? key,
    },
  });
}

export function deriveEventConsumerIdempotencyKey(options: {
  readonly consumerName: string;
  readonly eventId: string;
  readonly eventType?: string;
  readonly tenantId?: string | null;
  readonly namespace?: string;
  readonly fingerprint?: string;
}): DerivedIdempotencyKey {
  const key = stableStringify({
    consumerName: options.consumerName,
    eventId: options.eventId,
  });

  return deriveIdempotencyKey({
    namespace: options.namespace ?? "event-consumer",
    tenantId: options.tenantId,
    source: {
      kind: "explicit",
      key,
      fingerprint:
        options.fingerprint ??
        stableStringify({
          consumerName: options.consumerName,
          eventId: options.eventId,
          eventType: options.eventType ?? "event",
        }),
    },
  });
}

function resolveTenantId(options: DeriveIdempotencyKeyOptions): string | null {
  if (options.source.kind === "tenant-scoped") {
    const tenantId = normalizeSegment(options.source.tenantId, "tenantId");
    if (
      options.tenantId !== undefined &&
      options.tenantId !== null &&
      options.tenantId !== tenantId
    ) {
      throw new InvalidIdempotencyKeyProblem("tenant-scoped source conflicts with scope tenant", {
        scopeTenantId: options.tenantId,
        sourceTenantId: tenantId,
      });
    }
    return tenantId;
  }

  if (options.tenantId === undefined || options.tenantId === null) {
    return null;
  }

  return normalizeSegment(options.tenantId, "tenantId");
}

function resolveSourceKey(source: IdempotencyKeySource): string {
  switch (source.kind) {
    case "explicit":
      return source.key;
    case "request-fingerprint":
      return source.key ?? requestFingerprint(source);
    case "provider-event":
      return stableStringify({
        eventId: source.eventId,
        provider: source.provider,
      });
    case "tenant-scoped":
      return source.key;
  }
}

function resolveFingerprint(source: IdempotencyKeySource): string {
  switch (source.kind) {
    case "explicit":
      return source.fingerprint ?? source.key;
    case "request-fingerprint":
      return source.fingerprint ?? requestFingerprint(source);
    case "provider-event":
      return (
        source.fingerprint ??
        stableStringify({
          eventId: source.eventId,
          provider: source.provider,
        })
      );
    case "tenant-scoped":
      return source.fingerprint ?? source.key;
  }
}

function requestFingerprint(source: RequestFingerprintParts): string {
  return stableStringify({
    body: source.bodyFingerprint,
    headers: source.headerFingerprint ?? null,
    method: source.method.toUpperCase(),
    path: source.path,
    query: source.queryFingerprint ?? null,
  });
}

function normalizeSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new InvalidIdempotencyKeyProblem(`${label} must be a non-empty string`, {
      [label]: value,
    });
  }
  return normalized;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function encodeIdempotencySegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
