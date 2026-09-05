import { isDeepStrictEqual } from "node:util";
import type { AppendOutboxMessageInput, TransactionalOutboxMessage } from "./TransactionalEvents";
import type { OutboxIdempotencyField } from "./problems/EventsTxProblems";

export const OUTBOX_IDEMPOTENCY_FIELDS = [
  "eventId",
  "eventType",
  "aggregateId",
  "payload",
  "metadata",
] as const satisfies readonly OutboxIdempotencyField[];

type CanonicalOutboxRequest = {
  [TField in (typeof OUTBOX_IDEMPOTENCY_FIELDS)[number]]: AppendOutboxMessageInput[TField];
};

function jsonStorageValue(value: unknown): unknown {
  const serialized = JSON.stringify(value);
  return serialized === undefined ? null : JSON.parse(serialized);
}

// Delivery configuration, trace context, and diagnostics describe an append attempt rather than
// the event itself. JSON fields are compared after the same normalization PostgreSQL jsonb applies.
// occurredAt can change when an event is recreated or stored at a different precision;
// a replay keeps the first persisted timestamp instead of treating it as business identity.
function canonicalInput(input: AppendOutboxMessageInput): CanonicalOutboxRequest {
  return {
    eventId: input.eventId,
    eventType: input.eventType,
    aggregateId: input.aggregateId,
    payload: jsonStorageValue(input.payload) as Record<string, unknown>,
    metadata: jsonStorageValue(input.metadata ?? {}) as Record<string, unknown>,
  };
}

function canonicalMessage(message: TransactionalOutboxMessage): CanonicalOutboxRequest {
  return {
    eventId: message.eventId,
    eventType: message.eventType,
    aggregateId: message.aggregateId,
    payload: jsonStorageValue(message.payload) as Record<string, unknown>,
    metadata: jsonStorageValue(message.metadata) as Record<string, unknown>,
  };
}

export function findOutboxIdempotencyConflicts(
  input: AppendOutboxMessageInput,
  existing: TransactionalOutboxMessage,
): OutboxIdempotencyField[] {
  const requested = canonicalInput(input);
  const persisted = canonicalMessage(existing);
  return OUTBOX_IDEMPOTENCY_FIELDS.filter(
    (field) => !isDeepStrictEqual(requested[field], persisted[field]),
  );
}
