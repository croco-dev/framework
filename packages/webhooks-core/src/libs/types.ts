import type {
  DerivedIdempotencyKey,
  IdempotencyCompletedRecord,
  IdempotencyFailedRecord,
  IdempotencyInFlightRecord,
  IdempotencyStore,
} from "@croco/idempotency-core";
import type { Problem } from "@croco/problems-core";

export type WebhookRawBody = string | Uint8Array;

export type WebhookHeaders = Record<string, string | readonly string[] | undefined>;

export type NormalizedWebhookHeaders = Readonly<Record<string, string>>;

export type WebhookGatewayRequest = {
  readonly rawBody: WebhookRawBody;
  readonly headers: WebhookHeaders;
  readonly receivedAt?: Date;
  readonly metadata?: Record<string, unknown>;
};

export type WebhookGatewayReplayFixture = WebhookGatewayRequest & {
  readonly provider: string;
  readonly name?: string;
  readonly eventId?: string;
  readonly eventType?: string;
};

export type WebhookEvent<TPayload = unknown, TType extends string = string> = {
  readonly id: string;
  readonly type: TType;
  readonly provider: string;
  readonly payload: TPayload;
  readonly tenantId?: string | null;
  readonly occurredAt?: Date;
  readonly fingerprint?: string;
};

export type WebhookProviderAdapter<TEvent extends WebhookEvent = WebhookEvent> = {
  readonly provider: string;
  verify(request: {
    readonly rawBody: WebhookRawBody;
    readonly headers: NormalizedWebhookHeaders;
    readonly receivedAt: Date;
    readonly metadata?: Record<string, unknown>;
  }): Promise<TEvent> | TEvent;
};

export type WebhookEventDefinition<TPayload = unknown, TResult = unknown> = {
  readonly payload: TPayload;
  readonly result: TResult;
};

export type WebhookEventCatalog = Record<string, WebhookEventDefinition>;

export type WebhookDispatchContext = {
  readonly provider: string;
  readonly eventId: string;
  readonly eventType: string;
  readonly rawBody: WebhookRawBody;
  readonly headers: NormalizedWebhookHeaders;
  readonly receivedAt: Date;
  readonly replay: boolean;
  readonly idempotencyKey: DerivedIdempotencyKey;
  readonly metadata?: Record<string, unknown>;
};

export type WebhookEventHandler<TEvent extends WebhookEvent = WebhookEvent, TResult = unknown> = (
  event: TEvent,
  context: WebhookDispatchContext,
) => Promise<TResult> | TResult;

export type UnknownEventPolicy = "fail" | "ignore" | "report";

export type WebhookUnknownEventReporter<TEvent extends WebhookEvent = WebhookEvent> = {
  reportUnknownEvent(options: {
    readonly event: TEvent;
    readonly problem: Problem;
    readonly context: Omit<WebhookDispatchContext, "idempotencyKey">;
  }): Promise<void> | void;
};

export type WebhookDispatchResult = {
  readonly eventId: string;
  readonly eventType: string;
  readonly provider: string;
  readonly handlerResult: unknown;
};

export type WebhookGatewayStoredResult =
  | {
      readonly outcome: "handled";
      readonly dispatch: WebhookDispatchResult;
    }
  | {
      readonly outcome: "ignored" | "reported";
      readonly policy: UnknownEventPolicy;
    };

export type WebhookGatewayHandledResult = {
  readonly outcome: "handled";
  readonly event: WebhookEvent;
  readonly dispatch: WebhookDispatchResult;
  readonly idempotencyKey: DerivedIdempotencyKey;
  readonly record: IdempotencyCompletedRecord<WebhookGatewayStoredResult>;
};

export type WebhookGatewayIdempotentResult =
  | {
      readonly outcome: "duplicate";
      readonly event: WebhookEvent;
      readonly originalOutcome: "handled";
      readonly dispatch: WebhookDispatchResult;
      readonly idempotencyKey: DerivedIdempotencyKey;
      readonly record: IdempotencyCompletedRecord<WebhookGatewayStoredResult>;
      readonly problem: Problem;
    }
  | {
      readonly outcome: "duplicate";
      readonly event: WebhookEvent;
      readonly originalOutcome: "ignored" | "reported";
      readonly unknownProblem: Problem;
      readonly idempotencyKey: DerivedIdempotencyKey;
      readonly record: IdempotencyCompletedRecord<WebhookGatewayStoredResult>;
      readonly problem: Problem;
    }
  | {
      readonly outcome: "in-flight";
      readonly event: WebhookEvent;
      readonly idempotencyKey: DerivedIdempotencyKey;
      readonly record: IdempotencyInFlightRecord;
      readonly problem: Problem;
    }
  | {
      readonly outcome: "failed";
      readonly event: WebhookEvent;
      readonly idempotencyKey: DerivedIdempotencyKey;
      readonly record: IdempotencyFailedRecord;
      readonly problem: Problem;
    };

export type WebhookGatewayIgnoredResult = {
  readonly outcome: "ignored" | "reported";
  readonly event: WebhookEvent;
  readonly idempotencyKey: DerivedIdempotencyKey;
  readonly problem: Problem;
};

export type WebhookGatewayResult =
  | WebhookGatewayHandledResult
  | WebhookGatewayIdempotentResult
  | WebhookGatewayIgnoredResult;

export type WebhookGatewayOptions = {
  readonly adapter: WebhookProviderAdapter;
  readonly router: {
    has(eventType: string): boolean;
    dispatch(event: WebhookEvent, context: WebhookDispatchContext): Promise<unknown>;
  };
  readonly idempotencyStore: IdempotencyStore<WebhookGatewayStoredResult>;
  readonly unknownEventPolicy: UnknownEventPolicy;
  readonly unknownEventReporter?: WebhookUnknownEventReporter;
  readonly idempotencyTtlMs?: number;
  readonly idempotencyNamespace?: string;
  readonly now?: () => Date;
};
