import { createHash } from "node:crypto";
import type { LifecycleContext, LifecycleSignal } from "./types";

export const LIFECYCLE_SOURCE_IDEMPOTENCY_VERSION = "v1";

export type LifecycleSourceIdentity = {
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly tenantId: string;
  readonly signalType: string;
  readonly sourceNamespace: string;
  readonly sourceEventId: string;
};

function encodeTupleSegment(value: string): string {
  const encoded = encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${encoded.length.toString(16)}:${encoded}`;
}

export function encodeLifecycleSourceKey(identity: LifecycleSourceIdentity): string {
  return [
    `version=${LIFECYCLE_SOURCE_IDEMPOTENCY_VERSION}`,
    encodeTupleSegment(identity.ruleId),
    encodeTupleSegment(identity.ruleVersion),
    encodeTupleSegment(identity.tenantId),
    encodeTupleSegment(identity.signalType),
    encodeTupleSegment(identity.sourceNamespace),
    encodeTupleSegment(identity.sourceEventId),
  ].join(":");
}

export function encodeLifecycleCustomKey(input: {
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly tenantId: string;
  readonly customKey: string;
}): string {
  return [
    `version=${LIFECYCLE_SOURCE_IDEMPOTENCY_VERSION}`,
    "custom",
    encodeTupleSegment(input.ruleId),
    encodeTupleSegment(input.ruleVersion),
    encodeTupleSegment(input.tenantId),
    encodeTupleSegment(input.customKey),
  ].join(":");
}

/**
 * Legacy default key issued before source identity became mandatory.
 * Accepted for one release as a migration fallback; new claims never issue it.
 */
export function buildLegacyLifecycleIdempotencyKey(input: {
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly tenantId: string;
  readonly signalType: string;
  readonly signalId?: string;
  readonly occurredAt: Date;
}): string {
  const signalKey = input.signalId ?? input.occurredAt.toISOString();
  return [input.ruleId, input.ruleVersion, input.tenantId, input.signalType, signalKey].join(":");
}

export function resolveLifecycleSourceIdentity(input: {
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly context: LifecycleContext;
}): LifecycleSourceIdentity | undefined {
  const sourceEventId = input.context.signal.id;
  if (sourceEventId === undefined || sourceEventId.trim().length === 0) {
    return undefined;
  }
  return {
    ruleId: input.ruleId,
    ruleVersion: input.ruleVersion,
    tenantId: input.context.tenantId,
    signalType: input.context.signal.type,
    sourceNamespace: input.context.signal.source ?? "",
    sourceEventId,
  };
}

function canonicalizeSourceValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeSourceValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, canonicalizeSourceValue(entry)]),
    );
  }
  return value;
}

function isReceiverMetadataKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized === "receivedat" ||
    normalized === "ingestedat" ||
    normalized === "attempt" ||
    normalized === "attemptcount" ||
    normalized === "attemptnumber" ||
    normalized === "retrycount" ||
    normalized === "deliveryattempt" ||
    normalized === "redeliverycount" ||
    normalized.endsWith("_at_receiver") ||
    normalized.endsWith("atreceiver") ||
    normalized.startsWith("receiver")
  );
}

function stripReceiverMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripReceiverMetadata);
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !isReceiverMetadataKey(key))
        .map(([key, entry]) => [key, stripReceiverMetadata(entry)]),
    );
  }
  return value;
}

/**
 * Canonical semantic payload fingerprint used only for conflict checks.
 * Identity is never derived from this value: receiver timestamps and attempt
 * metadata are excluded, while semantic `data` differences change the hash.
 */
export function fingerprintLifecycleSourcePayload(signal: LifecycleSignal): string {
  const material = canonicalizeSourceValue(
    stripReceiverMetadata({
      type: signal.type,
      data: signal.data,
    }),
  );
  return createHash("sha256").update(JSON.stringify(material)).digest("hex");
}

export type DurableLifecycleEnvelopeInput = {
  readonly signal: LifecycleSignal;
  readonly sourceEventId?: string;
};

export type DurableLifecycleSignal = LifecycleSignal & { readonly id: string };

function createSourceEventId(): string {
  return `source_event_${globalThis.crypto.randomUUID()}`;
}

/**
 * Durable ingress helper: issues a stable source event id exactly once when the
 * source did not supply one, and preserves an existing id on redelivery. The id
 * belongs on the retryable envelope/outbox record, not inside the evaluator.
 */
export function ensureDurableLifecycleSignal(
  input: DurableLifecycleEnvelopeInput,
): DurableLifecycleSignal {
  const candidate = input.sourceEventId ?? input.signal.id;
  if (candidate !== undefined && candidate.trim().length > 0) {
    return { ...input.signal, id: candidate };
  }
  return { ...input.signal, id: createSourceEventId() };
}
