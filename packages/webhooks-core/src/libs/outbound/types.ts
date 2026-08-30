import type { CreateExecutionParams } from "@croco/execution-core";
import type { OutboxIntent } from "@croco/outbox-core";
import type { Problem } from "@croco/problems-core";
import type { BackoffPolicy } from "@croco/retry-core";
import type { TaskOptions } from "@croco/tasks-core";

export type OutboundWebhookEventDescriptor<TPayload = unknown> = {
  readonly id: string;
  readonly name: string;
  readonly schemaVersion: string;
  readonly subject: string;
  readonly tenantId: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
};

export type OutboundWebhookEndpointStatus = "active" | "paused" | "disabled";
export type OutboundWebhookSigningAlgorithm = "hmac-sha256";

export type OutboundWebhookEndpoint = {
  readonly id: string;
  readonly tenantId: string;
  readonly url: string;
  readonly subscribedEventNames: readonly string[];
  readonly status: OutboundWebhookEndpointStatus;
  readonly signingAlgorithm: OutboundWebhookSigningAlgorithm;
  readonly activeSecretVersion: string;
  readonly previousSecretVersion?: string;
  readonly previousSecretValidUntil?: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type OutboundWebhookSecret = {
  readonly tenantId: string;
  readonly endpointId: string;
  readonly version: string;
  readonly material: Uint8Array;
  readonly expiresAt?: Date;
};

export type OutboundWebhookEvent = Omit<OutboundWebhookEventDescriptor, "payload"> & {
  readonly payloadBytes: Uint8Array;
  readonly committedAt: Date;
};

export type OutboundWebhookDeliveryStatus =
  | "pending"
  | "accepted"
  | "delivered"
  | "retrying"
  | "dead"
  | "canceled"
  | "acceptance-unknown";

export type OutboundWebhookDelivery = {
  readonly id: string;
  readonly eventId: string;
  readonly endpointId: string;
  readonly tenantId: string;
  readonly status: OutboundWebhookDeliveryStatus;
  readonly attemptCount: number;
  readonly nextAttemptAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type OutboundWebhookAttemptOutcome =
  | { readonly kind: "http"; readonly status: number }
  | { readonly kind: "redirect"; readonly status: number; readonly location: string }
  | { readonly kind: "timeout" }
  | { readonly kind: "connection-reset" }
  | { readonly kind: "acceptance-unknown"; readonly reason: string };

export type OutboundWebhookOutcomeClassification =
  | { readonly policy: "accepted" }
  | { readonly policy: "delivered" }
  | { readonly policy: "permanent"; readonly problem: Problem }
  | {
      readonly policy: "retryable";
      readonly problem: Problem;
      readonly retryAfterMs?: number;
    }
  | { readonly policy: "acceptance-unknown"; readonly problem: Problem };

export type OutboundWebhookAttempt = {
  readonly id: string;
  readonly deliveryId: string;
  readonly number: number;
  readonly secretVersion: string;
  readonly signature: string;
  readonly timestamp: string;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly outcome: OutboundWebhookAttemptOutcome;
  readonly classification: OutboundWebhookOutcomeClassification["policy"];
};

export type OutboundWebhookDispatchIntent = {
  readonly id: string;
  readonly deliveryId: string;
  readonly eventId: string;
  readonly tenantId: string;
  readonly taskName: "webhooks.outbound.deliver";
  readonly idempotencyKey: string;
  readonly executionId: string;
  readonly visibleAt: Date;
  readonly publishedAt?: Date;
};

export type OutboundWebhookCommitResult = {
  readonly event: OutboundWebhookEvent;
  readonly deliveries: readonly OutboundWebhookDelivery[];
  readonly intents: readonly OutboundWebhookDispatchIntent[];
  readonly duplicate: boolean;
};

export type OutboundWebhookIntentPublicationFailure = {
  readonly intentId: string;
  readonly deliveryId: string;
  readonly classification: "retryable" | "terminal";
  readonly problem: Problem;
};

export type OutboundWebhookIntentPublicationOutcome = {
  readonly publishedIntentIds: readonly string[];
  readonly failures: readonly OutboundWebhookIntentPublicationFailure[];
};

export type OutboundWebhookStore = {
  commitEvent(input: {
    readonly event: OutboundWebhookEvent;
    readonly endpoints: readonly OutboundWebhookEndpoint[];
  }): Promise<OutboundWebhookCommitResult>;
  listUnpublishedIntents(tenantId: string): Promise<readonly OutboundWebhookDispatchIntent[]>;
  /** Atomically marks an unpublished intent and returns whether this call made the transition. */
  markIntentPublished(tenantId: string, intentId: string, publishedAt: Date): Promise<boolean>;
  getEvent(tenantId: string, eventId: string): Promise<OutboundWebhookEvent | undefined>;
  getDelivery(tenantId: string, deliveryId: string): Promise<OutboundWebhookDelivery | undefined>;
  listDeliveries(tenantId: string, eventId: string): Promise<readonly OutboundWebhookDelivery[]>;
  listAttempts(tenantId: string, deliveryId: string): Promise<readonly OutboundWebhookAttempt[]>;
  claimDelivery(
    tenantId: string,
    deliveryId: string,
    eligibleAt: Date,
  ): Promise<OutboundWebhookDelivery | undefined>;
  releaseDeliveryClaim(tenantId: string, deliveryId: string): Promise<void>;
  recordAttempt(input: {
    readonly tenantId: string;
    readonly attempt: OutboundWebhookAttempt;
    readonly status: OutboundWebhookDeliveryStatus;
    readonly nextAttemptAt?: Date;
  }): Promise<OutboundWebhookDelivery>;
  createReplay(input: {
    readonly tenantId: string;
    readonly deliveryId: string;
    readonly replayId: string;
    readonly createdAt: Date;
  }): Promise<OutboundWebhookDelivery>;
  scheduleDelivery(input: {
    readonly tenantId: string;
    readonly deliveryId: string;
    readonly scheduledAt: Date;
  }): Promise<OutboundWebhookDelivery>;
};

export type OutboundWebhookEndpointStore = {
  listSubscribedEndpoints(
    tenantId: string,
    eventName: string,
  ): Promise<readonly OutboundWebhookEndpoint[]>;
  getEndpoint(tenantId: string, endpointId: string): Promise<OutboundWebhookEndpoint | undefined>;
};

export type OutboundWebhookSecretStore = {
  getSecret(
    tenantId: string,
    endpointId: string,
    version: string,
  ): Promise<OutboundWebhookSecret | undefined>;
};

export type OutboundWebhookTaskPublisher = {
  /**
   * Repeated calls with the same `idempotencyKey` must resolve without creating duplicate task,
   * execution, or outbox records.
   */
  publish(input: {
    readonly taskName: "webhooks.outbound.deliver";
    readonly executionId: string;
    readonly idempotencyKey: string;
    readonly deliveryId: string;
    readonly visibleAt: Date;
    readonly contracts: {
      readonly task: TaskOptions;
      readonly execution: CreateExecutionParams;
      readonly outbox: OutboxIntent;
    };
  }): Promise<void>;
};

export type OutboundWebhookTransportRequest = {
  readonly url: string;
  readonly resolvedAddresses: readonly string[];
  readonly body: Uint8Array;
  readonly headers: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
};

export type OutboundWebhookTransport = {
  /**
   * Connect only to an address in `request.resolvedAddresses`, preserve the URL hostname for
   * TLS/SNI, and return redirects without following them.
   */
  send(request: OutboundWebhookTransportRequest): Promise<OutboundWebhookAttemptOutcome>;
};

export type OutboundWebhookValidatedTarget = {
  readonly url: string;
  readonly resolvedAddresses: readonly string[];
};

export type OutboundWebhookUrlPolicy = {
  validate(url: string): Promise<OutboundWebhookValidatedTarget>;
};

export type OutboundWebhookPausePolicy = {
  allowsDispatch(endpoint: OutboundWebhookEndpoint): boolean;
};

export type OutboundWebhookRetryPolicy = {
  readonly maxAttempts: number;
  readonly backoff: Pick<BackoffPolicy, "getDelay">;
};

export type OutboundWebhookDiagnostics = {
  readonly eventId: string;
  readonly tenantId: string;
  readonly deliveryCounts: Readonly<Record<OutboundWebhookDeliveryStatus, number>>;
  readonly attemptCount: number;
};

export type OutboundWebhookRuntimeOptions = {
  readonly store: OutboundWebhookStore;
  readonly endpointStore: OutboundWebhookEndpointStore;
  readonly secretStore: OutboundWebhookSecretStore;
  readonly taskPublisher: OutboundWebhookTaskPublisher;
  readonly transport: OutboundWebhookTransport;
  readonly urlPolicy?: OutboundWebhookUrlPolicy;
  readonly pausePolicy?: OutboundWebhookPausePolicy;
  readonly retryPolicy?: OutboundWebhookRetryPolicy;
  readonly now?: () => Date;
  readonly createId?: () => string;
};
