import { randomUUID } from "node:crypto";
import {
  InvalidOutboundWebhookEventProblem,
  InvalidOutboundWebhookSecretVersionProblem,
  OutboundWebhookAcceptanceUnknownProblem,
  OutboundWebhookConfigurationProblem,
  OutboundWebhookEndpointNotFoundProblem,
  OutboundWebhookPermanentProblem,
  OutboundWebhookReplayNotAllowedProblem,
  OutboundWebhookRetryableProblem,
} from "./OutboundWebhookProblems";
import { defaultOutboundWebhookUrlPolicy, signOutboundWebhook } from "./signing";
import type {
  OutboundWebhookAttempt,
  OutboundWebhookAttemptOutcome,
  OutboundWebhookCommitResult,
  OutboundWebhookDelivery,
  OutboundWebhookDeliveryStatus,
  OutboundWebhookDiagnostics,
  OutboundWebhookDispatchIntent,
  OutboundWebhookEvent,
  OutboundWebhookEventDescriptor,
  OutboundWebhookOutcomeClassification,
  OutboundWebhookRetryPolicy,
  OutboundWebhookRuntimeOptions,
} from "./types";

const DEFAULT_RETRY_POLICY: OutboundWebhookRetryPolicy = {
  maxAttempts: 8,
  backoff: {
    getDelay(attempt): number {
      return Math.min(60_000 * 2 ** Math.max(0, attempt - 1), 86_400_000);
    },
  },
};

const DEFAULT_PAUSE_POLICY = {
  allowsDispatch(endpoint: { readonly status: string }): boolean {
    return endpoint.status === "active";
  },
};

export class OutboundWebhookRuntime {
  private readonly options: OutboundWebhookRuntimeOptions;
  private readonly retryPolicy: OutboundWebhookRetryPolicy;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: OutboundWebhookRuntimeOptions) {
    if (!Number.isInteger(options.retryPolicy?.maxAttempts ?? DEFAULT_RETRY_POLICY.maxAttempts)) {
      throw new OutboundWebhookConfigurationProblem("maxAttempts must be an integer");
    }
    this.options = options;
    this.retryPolicy = options.retryPolicy ?? DEFAULT_RETRY_POLICY;
    if (this.retryPolicy.maxAttempts < 1 || this.retryPolicy.maxAttempts > 100) {
      throw new OutboundWebhookConfigurationProblem("maxAttempts must be between 1 and 100");
    }
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  async publish<TPayload>(
    descriptor: OutboundWebhookEventDescriptor<TPayload>,
  ): Promise<OutboundWebhookCommitResult> {
    assertDescriptor(descriptor);
    const endpoints = await this.options.endpointStore.listSubscribedEndpoints(
      descriptor.tenantId,
      descriptor.name,
    );
    const pausePolicy = this.options.pausePolicy ?? DEFAULT_PAUSE_POLICY;
    const effectiveEndpoints = endpoints.map((endpoint) =>
      endpoint.status === "active" && !pausePolicy.allowsDispatch(endpoint)
        ? { ...endpoint, status: "paused" as const }
        : endpoint,
    );

    const committedAt = this.now();
    const event: OutboundWebhookEvent = {
      id: descriptor.id,
      name: descriptor.name,
      schemaVersion: descriptor.schemaVersion,
      subject: descriptor.subject,
      tenantId: descriptor.tenantId,
      occurredAt: new Date(descriptor.occurredAt),
      payloadBytes: serializeDescriptor(descriptor),
      committedAt,
    };
    const result = await this.options.store.commitEvent({ event, endpoints: effectiveEndpoints });
    await this.publishUnpublishedIntents(descriptor.tenantId);
    return result;
  }

  async publishUnpublishedIntents(tenantId: string): Promise<number> {
    const intents = await this.options.store.listUnpublishedIntents(tenantId);
    let published = 0;
    for (const intent of intents) {
      try {
        await this.publishIntent(intent);
        await this.options.store.markIntentPublished(tenantId, intent.id, this.now());
        published += 1;
      } catch (error) {
        if (error instanceof OutboundWebhookConfigurationProblem) {
          throw error;
        }
        throw new OutboundWebhookConfigurationProblem("task/outbox publication failed", {
          intentId: intent.id,
          deliveryId: intent.deliveryId,
        });
      }
    }
    return published;
  }

  async dispatch(
    tenantId: string,
    deliveryId: string,
    signal?: AbortSignal,
  ): Promise<OutboundWebhookDelivery> {
    const delivery = await this.options.store.getDelivery(tenantId, deliveryId);
    if (!delivery) {
      throw new OutboundWebhookConfigurationProblem("delivery was not found", {
        deliveryId,
      });
    }
    if (delivery.status !== "pending" && delivery.status !== "retrying") {
      throw new OutboundWebhookReplayNotAllowedProblem(delivery.id, delivery.status);
    }

    if (delivery.tenantId !== tenantId) {
      throw new OutboundWebhookConfigurationProblem("delivery tenant boundary is inconsistent", {
        deliveryId,
      });
    }
    const dispatchAt = this.now();
    if (
      delivery.status === "retrying" &&
      delivery.nextAttemptAt !== undefined &&
      delivery.nextAttemptAt.getTime() > dispatchAt.getTime()
    ) {
      throw new OutboundWebhookRetryableProblem(delivery.id, "retry is not due", {
        nextAttemptAt: delivery.nextAttemptAt.toISOString(),
      });
    }

    const [event, endpoint] = await Promise.all([
      this.options.store.getEvent(tenantId, delivery.eventId),
      this.options.endpointStore.getEndpoint(tenantId, delivery.endpointId),
    ]);
    if (!event) {
      throw new OutboundWebhookConfigurationProblem("delivery event was not found", {
        deliveryId,
        eventId: delivery.eventId,
      });
    }
    if (!endpoint) {
      throw new OutboundWebhookEndpointNotFoundProblem(delivery.endpointId);
    }
    if (endpoint.tenantId !== delivery.tenantId || event.tenantId !== delivery.tenantId) {
      throw new OutboundWebhookConfigurationProblem("delivery tenant boundary is inconsistent", {
        deliveryId,
      });
    }
    if (
      endpoint.status !== "active" ||
      !(this.options.pausePolicy ?? DEFAULT_PAUSE_POLICY).allowsDispatch(endpoint)
    ) {
      throw new OutboundWebhookReplayNotAllowedProblem(delivery.id, endpoint.status);
    }
    const validatedTarget = await (
      this.options.urlPolicy ?? defaultOutboundWebhookUrlPolicy
    ).validate(endpoint.url);

    const secret = await this.options.secretStore.getSecret(
      tenantId,
      endpoint.id,
      endpoint.activeSecretVersion,
    );
    if (!secret) {
      throw new InvalidOutboundWebhookSecretVersionProblem(
        endpoint.id,
        endpoint.activeSecretVersion,
        "unknown",
      );
    }
    if (
      secret.tenantId !== tenantId ||
      secret.endpointId !== endpoint.id ||
      secret.version !== endpoint.activeSecretVersion
    ) {
      throw new OutboundWebhookConfigurationProblem(
        "signing secret tenant or identity is inconsistent",
        { deliveryId, endpointId: endpoint.id },
      );
    }
    const startedAt = dispatchAt;
    if (secret.expiresAt !== undefined && secret.expiresAt.getTime() < startedAt.getTime()) {
      throw new InvalidOutboundWebhookSecretVersionProblem(
        endpoint.id,
        endpoint.activeSecretVersion,
        "expired",
      );
    }

    const claimed = await this.options.store.claimDelivery(tenantId, deliveryId, dispatchAt);
    if (!claimed) {
      throw new OutboundWebhookConfigurationProblem("delivery is already being dispatched", {
        deliveryId,
      });
    }

    try {
      const timestamp = String(Math.floor(startedAt.getTime() / 1_000));
      const signature = signOutboundWebhook(event.payloadBytes, timestamp, secret);
      const outcome = await this.options.transport.send({
        url: validatedTarget.url,
        resolvedAddresses: validatedTarget.resolvedAddresses,
        body: event.payloadBytes,
        headers: {
          "content-type": "application/json",
          "webhook-id": event.id,
          "webhook-delivery-id": delivery.id,
          "webhook-signature": signature,
          "webhook-signature-version": endpoint.activeSecretVersion,
          "webhook-timestamp": timestamp,
        },
        ...(signal === undefined ? {} : { signal }),
      });
      const completedAt = this.now();
      const classification = classifyOutboundWebhookOutcome(delivery.id, outcome);
      const attemptNumber = claimed.attemptCount + 1;
      const terminalByAttempts = attemptNumber >= this.retryPolicy.maxAttempts;
      const next = mapClassificationToState(
        classification,
        terminalByAttempts,
        completedAt,
        attemptNumber,
        this.retryPolicy,
      );
      const attempt: OutboundWebhookAttempt = {
        id: this.createId(),
        deliveryId,
        number: attemptNumber,
        secretVersion: endpoint.activeSecretVersion,
        signature,
        timestamp,
        startedAt,
        completedAt,
        outcome,
        classification: classification.policy,
      };
      const updated = await this.options.store.recordAttempt({
        tenantId,
        attempt,
        status: next.status,
        ...(next.nextAttemptAt === undefined ? {} : { nextAttemptAt: next.nextAttemptAt }),
      });
      if (next.status === "retrying") {
        await this.publishUnpublishedIntents(tenantId);
      }
      return updated;
    } finally {
      await this.options.store.releaseDeliveryClaim(tenantId, deliveryId);
    }
  }

  async replay(
    tenantId: string,
    deliveryId: string,
    replayId = this.createId(),
  ): Promise<OutboundWebhookDelivery> {
    const source = await this.options.store.getDelivery(tenantId, deliveryId);
    if (!source) {
      throw new OutboundWebhookConfigurationProblem("delivery was not found", {
        deliveryId,
      });
    }
    const endpoint = await this.options.endpointStore.getEndpoint(tenantId, source.endpointId);
    if (!endpoint) {
      throw new OutboundWebhookEndpointNotFoundProblem(source.endpointId);
    }
    if (
      endpoint.status !== "active" ||
      !(this.options.pausePolicy ?? DEFAULT_PAUSE_POLICY).allowsDispatch(endpoint)
    ) {
      throw new OutboundWebhookReplayNotAllowedProblem(deliveryId, endpoint.status);
    }
    const delivery = await this.options.store.createReplay({
      tenantId,
      deliveryId,
      replayId,
      createdAt: this.now(),
    });
    await this.publishUnpublishedIntents(tenantId);
    return delivery;
  }

  async resume(tenantId: string, deliveryId: string): Promise<OutboundWebhookDelivery> {
    const delivery = await this.options.store.getDelivery(tenantId, deliveryId);
    if (!delivery) {
      throw new OutboundWebhookConfigurationProblem("delivery was not found", { deliveryId });
    }
    const endpoint = await this.options.endpointStore.getEndpoint(tenantId, delivery.endpointId);
    if (!endpoint) {
      throw new OutboundWebhookEndpointNotFoundProblem(delivery.endpointId);
    }
    if (
      endpoint.status !== "active" ||
      !(this.options.pausePolicy ?? DEFAULT_PAUSE_POLICY).allowsDispatch(endpoint)
    ) {
      throw new OutboundWebhookReplayNotAllowedProblem(deliveryId, endpoint.status);
    }
    const resumed = await this.options.store.scheduleDelivery({
      tenantId,
      deliveryId,
      scheduledAt: this.now(),
    });
    await this.publishUnpublishedIntents(tenantId);
    return resumed;
  }

  async diagnostics(tenantId: string, eventId: string): Promise<OutboundWebhookDiagnostics> {
    const event = await this.options.store.getEvent(tenantId, eventId);
    if (!event) {
      throw new OutboundWebhookConfigurationProblem("event was not found", {
        eventId,
      });
    }
    const deliveries = await this.options.store.listDeliveries(tenantId, eventId);
    const attemptLists = await Promise.all(
      deliveries.map((delivery) => this.options.store.listAttempts(tenantId, delivery.id)),
    );
    const deliveryCounts = createEmptyDeliveryCounts();
    for (const delivery of deliveries) {
      deliveryCounts[delivery.status] += 1;
    }
    return {
      eventId,
      tenantId: event.tenantId,
      deliveryCounts,
      attemptCount: attemptLists.reduce((total, attempts) => total + attempts.length, 0),
    };
  }

  private async publishIntent(intent: OutboundWebhookDispatchIntent): Promise<void> {
    await this.options.taskPublisher.publish({
      taskName: intent.taskName,
      executionId: intent.executionId,
      idempotencyKey: intent.idempotencyKey,
      deliveryId: intent.deliveryId,
      visibleAt: intent.visibleAt,
      contracts: {
        task: {
          name: intent.taskName,
          maxAttempts: this.retryPolicy.maxAttempts,
          idempotencyKey: intent.idempotencyKey,
        },
        execution: {
          type: "task",
          maxAttempts: this.retryPolicy.maxAttempts,
          scheduledFor: intent.visibleAt,
          idempotencyKey: intent.idempotencyKey,
          metadata: {
            deliveryId: intent.deliveryId,
            eventId: intent.eventId,
            tenantId: intent.tenantId,
          },
        },
        outbox: {
          type: intent.taskName,
          tenant: { tenantId: intent.tenantId },
          idempotencyKey: intent.idempotencyKey,
          source: { eventId: intent.eventId },
          payload: { deliveryId: intent.deliveryId },
          occurredAt: intent.visibleAt,
        },
      },
    });
  }
}

export function classifyOutboundWebhookOutcome(
  deliveryId: string,
  outcome: OutboundWebhookAttemptOutcome,
): OutboundWebhookOutcomeClassification {
  if (outcome.kind === "http") {
    if (outcome.status === 202) {
      return { policy: "accepted" };
    }
    if (outcome.status >= 200 && outcome.status < 300) {
      return { policy: "delivered" };
    }
    if (outcome.status === 429 || outcome.status >= 500) {
      return {
        policy: "retryable",
        problem: new OutboundWebhookRetryableProblem(deliveryId, `HTTP ${outcome.status}`, {
          status: outcome.status,
        }),
      };
    }
    return {
      policy: "permanent",
      problem: new OutboundWebhookPermanentProblem(deliveryId, `HTTP ${outcome.status}`, {
        status: outcome.status,
      }),
    };
  }
  if (outcome.kind === "acceptance-unknown") {
    return {
      policy: "acceptance-unknown",
      problem: new OutboundWebhookAcceptanceUnknownProblem(deliveryId, outcome.reason),
    };
  }
  if (outcome.kind === "redirect") {
    return {
      policy: "permanent",
      problem: new OutboundWebhookPermanentProblem(
        deliveryId,
        `HTTP ${outcome.status} redirect was not followed`,
        { status: outcome.status },
      ),
    };
  }
  return {
    policy: "retryable",
    problem: new OutboundWebhookRetryableProblem(deliveryId, outcome.kind),
  };
}

function mapClassificationToState(
  classification: OutboundWebhookOutcomeClassification,
  terminalByAttempts: boolean,
  completedAt: Date,
  attemptNumber: number,
  retryPolicy: OutboundWebhookRetryPolicy,
): {
  readonly status: OutboundWebhookDeliveryStatus;
  readonly nextAttemptAt?: Date;
} {
  if (classification.policy === "accepted") {
    return { status: "accepted" };
  }
  if (classification.policy === "delivered") {
    return { status: "delivered" };
  }
  if (classification.policy === "permanent") {
    return { status: "dead" };
  }
  if (classification.policy === "acceptance-unknown") {
    return { status: "acceptance-unknown" };
  }
  if (terminalByAttempts) {
    return { status: "dead" };
  }

  const delay = classification.retryAfterMs ?? retryPolicy.backoff.getDelay(attemptNumber - 1);
  if (!Number.isFinite(delay) || delay < 0) {
    throw new OutboundWebhookConfigurationProblem("retry delay must be finite and non-negative", {
      attemptNumber,
    });
  }
  return {
    status: "retrying",
    nextAttemptAt: new Date(completedAt.getTime() + delay),
  };
}

function serializeDescriptor<TPayload>(
  descriptor: OutboundWebhookEventDescriptor<TPayload>,
): Uint8Array {
  try {
    return new TextEncoder().encode(
      JSON.stringify({
        id: descriptor.id,
        name: descriptor.name,
        schemaVersion: descriptor.schemaVersion,
        subject: descriptor.subject,
        tenantId: descriptor.tenantId,
        occurredAt: descriptor.occurredAt.toISOString(),
        payload: descriptor.payload,
      }),
    );
  } catch {
    throw new InvalidOutboundWebhookEventProblem(
      "payload must be JSON serializable",
      descriptor.id,
    );
  }
}

function assertDescriptor<TPayload>(descriptor: OutboundWebhookEventDescriptor<TPayload>): void {
  for (const [field, value] of Object.entries({
    id: descriptor.id,
    name: descriptor.name,
    schemaVersion: descriptor.schemaVersion,
    subject: descriptor.subject,
    tenantId: descriptor.tenantId,
  })) {
    if (value.trim().length === 0) {
      throw new InvalidOutboundWebhookEventProblem(`${field} must be non-empty`, descriptor.id);
    }
  }
  if (Number.isNaN(descriptor.occurredAt.getTime())) {
    throw new InvalidOutboundWebhookEventProblem("occurredAt must be valid", descriptor.id);
  }
}

function createEmptyDeliveryCounts(): Record<OutboundWebhookDeliveryStatus, number> {
  return {
    pending: 0,
    accepted: 0,
    delivered: 0,
    retrying: 0,
    dead: 0,
    canceled: 0,
    "acceptance-unknown": 0,
  };
}

export function createOutboundWebhookRuntime(
  options: OutboundWebhookRuntimeOptions,
): OutboundWebhookRuntime {
  return new OutboundWebhookRuntime(options);
}
