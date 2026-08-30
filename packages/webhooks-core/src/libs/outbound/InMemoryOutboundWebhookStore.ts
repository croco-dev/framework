import {
  OutboundWebhookConfigurationProblem,
  OutboundWebhookReplayNotAllowedProblem,
} from "./OutboundWebhookProblems";
import { validateOutboundWebhookUrlSyntax } from "./signing";
import type {
  OutboundWebhookAttempt,
  OutboundWebhookCommitResult,
  OutboundWebhookDelivery,
  OutboundWebhookDeliveryStatus,
  OutboundWebhookDispatchIntent,
  OutboundWebhookEndpoint,
  OutboundWebhookEndpointStore,
  OutboundWebhookEvent,
  OutboundWebhookSecret,
  OutboundWebhookSecretStore,
  OutboundWebhookStore,
} from "./types";

const REPLAYABLE_STATUSES = new Set<OutboundWebhookDeliveryStatus>([
  "delivered",
  "dead",
  "canceled",
  "acceptance-unknown",
]);
const DELIVERY_CLAIM_TTL_MS = 5 * 60_000;

export class InMemoryOutboundWebhookStore implements OutboundWebhookStore {
  private readonly events = new Map<string, OutboundWebhookEvent>();
  private readonly deliveries = new Map<string, OutboundWebhookDelivery>();
  private readonly deliveryIdsByEvent = new Map<string, string[]>();
  private readonly attemptsByDelivery = new Map<string, OutboundWebhookAttempt[]>();
  private readonly intents = new Map<string, OutboundWebhookDispatchIntent>();
  private readonly claimedDeliveryIds = new Set<string>();
  private readonly claimedDeliveryAt = new Map<string, number>();
  private readonly replayIds = new Map<string, string>();

  async commitEvent(input: {
    readonly event: OutboundWebhookEvent;
    readonly endpoints: readonly OutboundWebhookEndpoint[];
  }): Promise<OutboundWebhookCommitResult> {
    const committedEventKey = eventKey(input.event.tenantId, input.event.id);
    const existing = this.events.get(committedEventKey);
    if (existing) {
      if (!equalEvent(existing, input.event)) {
        throw new OutboundWebhookConfigurationProblem(
          "event id was reused with different immutable bytes",
          {
            eventId: input.event.id,
          },
        );
      }
      return this.resultForEvent(existing, true);
    }

    const event = cloneEvent(input.event);
    for (const endpoint of input.endpoints) {
      if (endpoint.tenantId !== event.tenantId) {
        throw new OutboundWebhookConfigurationProblem(
          "endpoint tenant does not match event tenant",
          {
            eventId: event.id,
            endpointId: endpoint.id,
          },
        );
      }
    }
    const deliveries: OutboundWebhookDelivery[] = [];
    const intents: OutboundWebhookDispatchIntent[] = [];
    const seenEndpoints = new Set<string>();

    for (const endpoint of input.endpoints) {
      if (seenEndpoints.has(endpoint.id)) {
        continue;
      }
      seenEndpoints.add(endpoint.id);

      const deliveryId = `${event.tenantId}:${event.id}:${endpoint.id}`;
      const status: OutboundWebhookDeliveryStatus =
        endpoint.status === "disabled" ? "canceled" : "pending";
      const delivery: OutboundWebhookDelivery = {
        id: deliveryId,
        eventId: event.id,
        endpointId: endpoint.id,
        tenantId: event.tenantId,
        status,
        attemptCount: 0,
        createdAt: event.committedAt,
        updatedAt: event.committedAt,
      };
      deliveries.push(delivery);
      this.deliveries.set(deliveryKey(event.tenantId, deliveryId), delivery);

      if (endpoint.status === "active") {
        const intent = createIntent(delivery, event.committedAt);
        intents.push(intent);
        this.intents.set(intent.id, intent);
      }
    }

    this.events.set(committedEventKey, event);
    this.deliveryIdsByEvent.set(
      committedEventKey,
      deliveries.map((delivery) => delivery.id),
    );
    return {
      event: cloneEvent(event),
      deliveries: deliveries.map(cloneDelivery),
      intents: intents.map(cloneIntent),
      duplicate: false,
    };
  }

  async listUnpublishedIntents(
    tenantId: string,
  ): Promise<readonly OutboundWebhookDispatchIntent[]> {
    return [...this.intents.values()]
      .filter((intent) => intent.tenantId === tenantId && intent.publishedAt === undefined)
      .sort((left, right) => left.visibleAt.getTime() - right.visibleAt.getTime())
      .map(cloneIntent);
  }

  async markIntentPublished(tenantId: string, intentId: string, publishedAt: Date): Promise<void> {
    const intent = this.intents.get(intentId);
    if (!intent || intent.tenantId !== tenantId) {
      throw new OutboundWebhookConfigurationProblem("dispatch intent was not found", { intentId });
    }
    this.intents.set(intentId, {
      ...intent,
      publishedAt: new Date(publishedAt),
    });
  }

  async getEvent(tenantId: string, eventId: string): Promise<OutboundWebhookEvent | undefined> {
    const event = this.events.get(eventKey(tenantId, eventId));
    return event === undefined ? undefined : cloneEvent(event);
  }

  async getDelivery(
    tenantId: string,
    deliveryId: string,
  ): Promise<OutboundWebhookDelivery | undefined> {
    const delivery = this.deliveries.get(deliveryKey(tenantId, deliveryId));
    return delivery === undefined ? undefined : cloneDelivery(delivery);
  }

  async listDeliveries(
    tenantId: string,
    eventId: string,
  ): Promise<readonly OutboundWebhookDelivery[]> {
    return (this.deliveryIdsByEvent.get(eventKey(tenantId, eventId)) ?? [])
      .map((id) => this.deliveries.get(deliveryKey(tenantId, id)))
      .filter((delivery): delivery is OutboundWebhookDelivery => delivery !== undefined)
      .map(cloneDelivery);
  }

  async listAttempts(
    tenantId: string,
    deliveryId: string,
  ): Promise<readonly OutboundWebhookAttempt[]> {
    return (this.attemptsByDelivery.get(deliveryKey(tenantId, deliveryId)) ?? []).map(cloneAttempt);
  }

  async claimDelivery(
    tenantId: string,
    deliveryId: string,
    eligibleAt: Date,
  ): Promise<OutboundWebhookDelivery | undefined> {
    const key = deliveryKey(tenantId, deliveryId);
    const delivery = this.deliveries.get(key);
    if (
      !delivery ||
      (this.claimedDeliveryIds.has(key) &&
        (this.claimedDeliveryAt.get(key) ?? Number.POSITIVE_INFINITY) + DELIVERY_CLAIM_TTL_MS >
          eligibleAt.getTime()) ||
      (delivery.status !== "pending" && delivery.status !== "retrying") ||
      (delivery.nextAttemptAt !== undefined &&
        delivery.nextAttemptAt.getTime() > eligibleAt.getTime())
    ) {
      return undefined;
    }
    this.claimedDeliveryIds.delete(key);
    this.claimedDeliveryIds.add(key);
    this.claimedDeliveryAt.set(key, eligibleAt.getTime());
    return cloneDelivery(delivery);
  }

  async releaseDeliveryClaim(tenantId: string, deliveryId: string): Promise<void> {
    const key = deliveryKey(tenantId, deliveryId);
    this.claimedDeliveryIds.delete(key);
    this.claimedDeliveryAt.delete(key);
  }

  async recordAttempt(input: {
    readonly tenantId: string;
    readonly attempt: OutboundWebhookAttempt;
    readonly status: OutboundWebhookDeliveryStatus;
    readonly nextAttemptAt?: Date;
  }): Promise<OutboundWebhookDelivery> {
    const key = deliveryKey(input.tenantId, input.attempt.deliveryId);
    const current = this.deliveries.get(key);
    if (!current) {
      throw new OutboundWebhookConfigurationProblem("delivery was not found", {
        deliveryId: input.attempt.deliveryId,
      });
    }
    if (input.attempt.number !== current.attemptCount + 1) {
      throw new OutboundWebhookConfigurationProblem("attempt number is not sequential", {
        deliveryId: current.id,
        expectedAttempt: current.attemptCount + 1,
        actualAttempt: input.attempt.number,
      });
    }
    const nextAttemptTime = input.nextAttemptAt?.getTime();
    if (
      input.status === "retrying" &&
      (nextAttemptTime === undefined ||
        !Number.isFinite(nextAttemptTime) ||
        nextAttemptTime < input.attempt.completedAt.getTime())
    ) {
      throw new OutboundWebhookConfigurationProblem(
        "retrying delivery requires a valid next attempt time",
        { deliveryId: current.id },
      );
    }

    const attempts = this.attemptsByDelivery.get(key) ?? [];
    attempts.push(cloneAttempt(input.attempt));
    this.attemptsByDelivery.set(key, attempts);

    const updated: OutboundWebhookDelivery = {
      ...current,
      status: input.status,
      attemptCount: input.attempt.number,
      updatedAt: new Date(input.attempt.completedAt),
      nextAttemptAt:
        input.status === "retrying" && input.nextAttemptAt !== undefined
          ? new Date(input.nextAttemptAt)
          : undefined,
    };
    this.deliveries.set(key, updated);

    if (input.status === "retrying" && input.nextAttemptAt !== undefined) {
      const intent = createIntent(updated, input.nextAttemptAt);
      this.intents.set(intent.id, intent);
    }
    return cloneDelivery(updated);
  }

  async createReplay(input: {
    readonly tenantId: string;
    readonly deliveryId: string;
    readonly replayId: string;
    readonly createdAt: Date;
  }): Promise<OutboundWebhookDelivery> {
    const key = deliveryKey(input.tenantId, input.deliveryId);
    const source = this.deliveries.get(key);
    if (!source) {
      throw new OutboundWebhookConfigurationProblem("delivery was not found", {
        deliveryId: input.deliveryId,
      });
    }
    const replayKey = `${key}\u0000${input.replayId}`;
    if (this.replayIds.has(replayKey)) {
      return cloneDelivery(source);
    }
    if (!REPLAYABLE_STATUSES.has(source.status)) {
      throw new OutboundWebhookReplayNotAllowedProblem(source.id, source.status);
    }

    const replay: OutboundWebhookDelivery = {
      id: source.id,
      eventId: source.eventId,
      endpointId: source.endpointId,
      tenantId: source.tenantId,
      status: "pending",
      attemptCount: source.attemptCount,
      createdAt: new Date(source.createdAt),
      updatedAt: new Date(input.createdAt),
    };
    this.deliveries.set(key, replay);
    this.replayIds.set(replayKey, source.id);
    const intent = createIntent(replay, input.createdAt, `replay:${input.replayId}`);
    this.intents.set(intent.id, intent);
    return cloneDelivery(replay);
  }

  async scheduleDelivery(input: {
    readonly tenantId: string;
    readonly deliveryId: string;
    readonly scheduledAt: Date;
  }): Promise<OutboundWebhookDelivery> {
    const key = deliveryKey(input.tenantId, input.deliveryId);
    const delivery = this.deliveries.get(key);
    if (!delivery) {
      throw new OutboundWebhookConfigurationProblem("delivery was not found", {
        deliveryId: input.deliveryId,
      });
    }
    if (delivery.status !== "pending") {
      throw new OutboundWebhookReplayNotAllowedProblem(delivery.id, delivery.status);
    }
    const intent = createIntent(
      delivery,
      input.scheduledAt,
      `resume:${input.scheduledAt.toISOString()}`,
    );
    this.intents.set(intent.id, intent);
    return cloneDelivery(delivery);
  }

  private resultForEvent(
    event: OutboundWebhookEvent,
    duplicate: boolean,
  ): OutboundWebhookCommitResult {
    const deliveries = (this.deliveryIdsByEvent.get(eventKey(event.tenantId, event.id)) ?? [])
      .map((id) => this.deliveries.get(deliveryKey(event.tenantId, id)))
      .filter((delivery): delivery is OutboundWebhookDelivery => delivery !== undefined);
    const deliveryIds = new Set(deliveries.map((delivery) => delivery.id));
    const intents = [...this.intents.values()].filter((intent) =>
      deliveryIds.has(intent.deliveryId),
    );
    return {
      event: cloneEvent(event),
      deliveries: deliveries.map(cloneDelivery),
      intents: intents.map(cloneIntent),
      duplicate,
    };
  }
}

export class InMemoryOutboundWebhookEndpointStore implements OutboundWebhookEndpointStore {
  private readonly endpoints = new Map<string, OutboundWebhookEndpoint>();

  constructor(endpoints: readonly OutboundWebhookEndpoint[] = []) {
    for (const endpoint of endpoints) {
      this.set(endpoint);
    }
  }

  async listSubscribedEndpoints(
    tenantId: string,
    eventName: string,
  ): Promise<readonly OutboundWebhookEndpoint[]> {
    return [...this.endpoints.values()]
      .filter(
        (endpoint) =>
          endpoint.tenantId === tenantId && endpoint.subscribedEventNames.includes(eventName),
      )
      .map(cloneEndpoint);
  }

  async getEndpoint(
    tenantId: string,
    endpointId: string,
  ): Promise<OutboundWebhookEndpoint | undefined> {
    const endpoint = this.endpoints.get(endpointKey(tenantId, endpointId));
    return endpoint === undefined ? undefined : cloneEndpoint(endpoint);
  }

  set(endpoint: OutboundWebhookEndpoint): void {
    validateOutboundWebhookUrlSyntax(endpoint.url);
    this.endpoints.set(endpointKey(endpoint.tenantId, endpoint.id), cloneEndpoint(endpoint));
  }
}

export class InMemoryOutboundWebhookSecretStore implements OutboundWebhookSecretStore {
  private readonly secrets = new Map<string, OutboundWebhookSecret>();

  constructor(secrets: readonly OutboundWebhookSecret[] = []) {
    for (const secret of secrets) {
      this.set(secret);
    }
  }

  async getSecret(
    tenantId: string,
    endpointId: string,
    version: string,
  ): Promise<OutboundWebhookSecret | undefined> {
    const secret = this.secrets.get(secretKey(tenantId, endpointId, version));
    return secret === undefined ? undefined : cloneSecret(secret);
  }

  set(secret: OutboundWebhookSecret): void {
    this.secrets.set(
      secretKey(secret.tenantId, secret.endpointId, secret.version),
      cloneSecret(secret),
    );
  }
}

function createIntent(
  delivery: OutboundWebhookDelivery,
  visibleAt: Date,
  identity = `attempt:${delivery.attemptCount + 1}`,
): OutboundWebhookDispatchIntent {
  const attemptKey = `${delivery.id}:${identity}`;
  return {
    id: `${attemptKey}:dispatch`,
    deliveryId: delivery.id,
    eventId: delivery.eventId,
    tenantId: delivery.tenantId,
    taskName: "webhooks.outbound.deliver",
    idempotencyKey: attemptKey,
    executionId: `webhook-delivery:${attemptKey}`,
    visibleAt: new Date(visibleAt),
  };
}

function equalEvent(left: OutboundWebhookEvent, right: OutboundWebhookEvent): boolean {
  return (
    left.name === right.name &&
    left.schemaVersion === right.schemaVersion &&
    left.subject === right.subject &&
    left.tenantId === right.tenantId &&
    left.occurredAt.getTime() === right.occurredAt.getTime() &&
    Buffer.from(left.payloadBytes).equals(Buffer.from(right.payloadBytes))
  );
}

function cloneEvent(event: OutboundWebhookEvent): OutboundWebhookEvent {
  return {
    ...event,
    occurredAt: new Date(event.occurredAt),
    committedAt: new Date(event.committedAt),
    payloadBytes: new Uint8Array(event.payloadBytes),
  };
}

function cloneDelivery(delivery: OutboundWebhookDelivery): OutboundWebhookDelivery {
  return {
    ...delivery,
    createdAt: new Date(delivery.createdAt),
    updatedAt: new Date(delivery.updatedAt),
    ...(delivery.nextAttemptAt === undefined
      ? {}
      : { nextAttemptAt: new Date(delivery.nextAttemptAt) }),
  };
}

function cloneAttempt(attempt: OutboundWebhookAttempt): OutboundWebhookAttempt {
  return {
    ...attempt,
    startedAt: new Date(attempt.startedAt),
    completedAt: new Date(attempt.completedAt),
  };
}

function cloneIntent(intent: OutboundWebhookDispatchIntent): OutboundWebhookDispatchIntent {
  return {
    ...intent,
    visibleAt: new Date(intent.visibleAt),
    ...(intent.publishedAt === undefined ? {} : { publishedAt: new Date(intent.publishedAt) }),
  };
}

function cloneEndpoint(endpoint: OutboundWebhookEndpoint): OutboundWebhookEndpoint {
  return {
    ...endpoint,
    subscribedEventNames: [...endpoint.subscribedEventNames],
    ...(endpoint.previousSecretValidUntil === undefined
      ? {}
      : {
          previousSecretValidUntil: new Date(endpoint.previousSecretValidUntil),
        }),
    ...(endpoint.metadata === undefined ? {} : { metadata: { ...endpoint.metadata } }),
  };
}

function cloneSecret(secret: OutboundWebhookSecret): OutboundWebhookSecret {
  return {
    ...secret,
    material: new Uint8Array(secret.material),
    ...(secret.expiresAt === undefined ? {} : { expiresAt: new Date(secret.expiresAt) }),
  };
}

function eventKey(tenantId: string, eventId: string): string {
  return `${tenantId}\u0000${eventId}`;
}

function deliveryKey(tenantId: string, deliveryId: string): string {
  return `${tenantId}\u0000${deliveryId}`;
}

function endpointKey(tenantId: string, endpointId: string): string {
  return `${tenantId}\u0000${endpointId}`;
}

function secretKey(tenantId: string, endpointId: string, version: string): string {
  return `${tenantId}\u0000${endpointId}\u0000${version}`;
}
