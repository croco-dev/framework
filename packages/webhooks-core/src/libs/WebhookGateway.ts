import {
  IdempotencyCoordinator,
  deriveWebhookIdempotencyKey,
  type DerivedIdempotencyKey,
  type IdempotencyCompletedRecord,
  type IdempotencyExecutionResult,
} from "@croco/idempotency-core";
import { Problem } from "@croco/problems-core";
import { normalizeWebhookHeaders } from "./headers";
import {
  DuplicateWebhookEventProblem,
  InvalidWebhookEnvelopeProblem,
  InvalidWebhookFixtureProblem,
  UnknownWebhookEventProblem,
  WebhookDispatchProblem,
  WebhookGatewayConfigurationProblem,
  WebhookReporterProblem,
} from "./problems/WebhookProblems";
import type {
  NormalizedWebhookHeaders,
  WebhookDispatchContext,
  WebhookDispatchResult,
  WebhookEvent,
  WebhookGatewayOptions,
  WebhookGatewayReplayFixture,
  WebhookGatewayRequest,
  WebhookGatewayResult,
  WebhookGatewayStoredResult,
  WebhookRawBody,
} from "./types";

const DEFAULT_IDEMPOTENCY_TTL_MS = 86_400_000;

export class WebhookGateway {
  private readonly options: WebhookGatewayOptions;
  private readonly coordinator: IdempotencyCoordinator<WebhookGatewayStoredResult>;
  private readonly now: () => Date;

  constructor(options: WebhookGatewayOptions) {
    assertConfiguration(options);
    this.options = options;
    this.coordinator = new IdempotencyCoordinator({ store: options.idempotencyStore });
    this.now = options.now ?? (() => new Date());
  }

  async handle(request: WebhookGatewayRequest): Promise<WebhookGatewayResult> {
    return this.process(request, { replay: false });
  }

  async replay(fixture: WebhookGatewayReplayFixture): Promise<WebhookGatewayResult> {
    if (fixture.provider !== this.options.adapter.provider) {
      throw new WebhookGatewayConfigurationProblem("fixture provider does not match adapter", {
        fixtureProvider: fixture.provider,
        adapterProvider: this.options.adapter.provider,
        ...(fixture.name === undefined ? {} : { fixtureName: fixture.name }),
      });
    }

    return this.process(fixture, {
      replay: true,
      expectedEventId: fixture.eventId,
      expectedEventType: fixture.eventType,
      fixtureName: fixture.name,
    });
  }

  private async process(
    request: WebhookGatewayRequest,
    options: {
      readonly replay: boolean;
      readonly expectedEventId?: string;
      readonly expectedEventType?: string;
      readonly fixtureName?: string;
    },
  ): Promise<WebhookGatewayResult> {
    const receivedAt = request.receivedAt ?? this.now();
    const headers = normalizeWebhookHeaders(request.headers);
    const event = await this.verify({
      ...request,
      headers,
      receivedAt,
    });
    if (options.replay) {
      this.assertReplayFixtureMatches(event, options);
    }

    const idempotencyKey = this.deriveIdempotencyKey(event, request.rawBody);
    const context = this.createContext({
      event,
      headers,
      idempotencyKey,
      rawBody: request.rawBody,
      receivedAt,
      replay: options.replay,
      metadata: request.metadata,
    });
    const hasHandler = this.options.router.has(event.type);

    if (!hasHandler && this.options.unknownEventPolicy === "fail") {
      throw this.createUnknownEventProblem(event);
    }

    const execution = await this.coordinator.execute(
      {
        key: idempotencyKey,
        ttlMs: this.options.idempotencyTtlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS,
        metadata: {
          provider: event.provider,
          eventId: event.id,
          eventType: event.type,
          replay: options.replay,
          ...(request.metadata === undefined ? {} : request.metadata),
        },
      },
      async () => {
        if (!hasHandler) {
          return this.handleUnknownEvent(event, context);
        }

        return {
          outcome: "handled",
          dispatch: await this.dispatch(event, context),
        };
      },
    );

    return this.mapExecutionResult(execution, event, idempotencyKey);
  }

  private async verify(request: {
    readonly rawBody: WebhookRawBody;
    readonly headers: NormalizedWebhookHeaders;
    readonly receivedAt: Date;
    readonly metadata?: Record<string, unknown>;
  }): Promise<WebhookEvent> {
    try {
      const event = await this.options.adapter.verify(request);
      return this.normalizeVerifiedEvent(event);
    } catch (error) {
      if (error instanceof Problem) {
        throw error;
      }

      throw new InvalidWebhookEnvelopeProblem({
        provider: this.options.adapter.provider,
        reason: getErrorMessage(error),
      });
    }
  }

  private normalizeVerifiedEvent(event: WebhookEvent): WebhookEvent {
    const provider = event.provider || this.options.adapter.provider;
    if (provider.trim().length === 0) {
      throw new InvalidWebhookEnvelopeProblem({
        provider: this.options.adapter.provider,
        reason: "provider must be non-empty",
        eventId: event.id,
        eventType: event.type,
      });
    }

    if (event.id.trim().length === 0) {
      throw new InvalidWebhookEnvelopeProblem({
        provider,
        reason: "event id must be non-empty",
        eventType: event.type,
      });
    }

    if (event.type.trim().length === 0) {
      throw new InvalidWebhookEnvelopeProblem({
        provider,
        reason: "event type must be non-empty",
        eventId: event.id,
      });
    }

    return { ...event, provider };
  }

  private assertReplayFixtureMatches(
    event: WebhookEvent,
    fixture: {
      readonly expectedEventId?: string;
      readonly expectedEventType?: string;
      readonly fixtureName?: string;
    },
  ): void {
    if (fixture.expectedEventId !== undefined && fixture.expectedEventId !== event.id) {
      throw new InvalidWebhookFixtureProblem("fixture eventId does not match verified event", {
        expectedEventId: fixture.expectedEventId,
        actualEventId: event.id,
        provider: event.provider,
        ...(fixture.fixtureName === undefined ? {} : { fixtureName: fixture.fixtureName }),
      });
    }

    if (fixture.expectedEventType !== undefined && fixture.expectedEventType !== event.type) {
      throw new InvalidWebhookFixtureProblem("fixture eventType does not match verified event", {
        expectedEventType: fixture.expectedEventType,
        actualEventType: event.type,
        provider: event.provider,
        eventId: event.id,
        ...(fixture.fixtureName === undefined ? {} : { fixtureName: fixture.fixtureName }),
      });
    }
  }

  private deriveIdempotencyKey(
    event: WebhookEvent,
    rawBody: WebhookRawBody,
  ): DerivedIdempotencyKey {
    return deriveWebhookIdempotencyKey({
      provider: event.provider,
      eventId: event.id,
      tenantId: event.tenantId,
      namespace: this.options.idempotencyNamespace,
      fingerprint:
        event.fingerprint ??
        stableStringify({
          eventType: event.type,
          provider: event.provider,
          rawBody: rawBodyToString(rawBody),
        }),
    });
  }

  private createContext(options: {
    readonly event: WebhookEvent;
    readonly rawBody: WebhookRawBody;
    readonly headers: NormalizedWebhookHeaders;
    readonly receivedAt: Date;
    readonly replay: boolean;
    readonly idempotencyKey: DerivedIdempotencyKey;
    readonly metadata?: Record<string, unknown>;
  }): WebhookDispatchContext {
    return {
      provider: options.event.provider,
      eventId: options.event.id,
      eventType: options.event.type,
      rawBody: options.rawBody,
      headers: options.headers,
      receivedAt: options.receivedAt,
      replay: options.replay,
      idempotencyKey: options.idempotencyKey,
      ...(options.metadata === undefined ? {} : { metadata: options.metadata }),
    };
  }

  private async handleUnknownEvent(
    event: WebhookEvent,
    context: WebhookDispatchContext,
  ): Promise<WebhookGatewayStoredResult> {
    const problem = this.createUnknownEventProblem(event);

    if (this.options.unknownEventPolicy === "ignore") {
      return {
        outcome: "ignored",
        policy: this.options.unknownEventPolicy,
      };
    }

    if (this.options.unknownEventPolicy === "fail") {
      throw problem;
    }

    try {
      await this.options.unknownEventReporter?.reportUnknownEvent({
        event,
        problem,
        context: stripIdempotencyKey(context),
      });
    } catch (error) {
      throw new WebhookReporterProblem({
        provider: event.provider,
        eventId: event.id,
        eventType: event.type,
        reason: getErrorMessage(error),
        ...(error instanceof Error ? { cause: error } : {}),
      });
    }

    return {
      outcome: "reported",
      policy: this.options.unknownEventPolicy,
    };
  }

  private createUnknownEventProblem(
    event: WebhookEvent,
    policy = this.options.unknownEventPolicy,
  ): UnknownWebhookEventProblem {
    return new UnknownWebhookEventProblem({
      provider: event.provider,
      eventId: event.id,
      eventType: event.type,
      policy,
    });
  }

  private async dispatch(
    event: WebhookEvent,
    context: WebhookDispatchContext,
  ): Promise<WebhookDispatchResult> {
    try {
      return {
        eventId: event.id,
        eventType: event.type,
        provider: event.provider,
        handlerResult: await this.options.router.dispatch(event, context),
      };
    } catch (error) {
      throw new WebhookDispatchProblem({
        provider: event.provider,
        eventId: event.id,
        eventType: event.type,
        reason: getErrorMessage(error),
        ...(error instanceof Error ? { cause: error } : {}),
      });
    }
  }

  private mapExecutionResult(
    execution: IdempotencyExecutionResult<WebhookGatewayStoredResult>,
    event: WebhookEvent,
    idempotencyKey: DerivedIdempotencyKey,
  ): WebhookGatewayResult {
    switch (execution.outcome) {
      case "executed":
        return this.mapStoredResult(execution.response, event, idempotencyKey, execution.record);
      case "replayed": {
        const problem = new DuplicateWebhookEventProblem({
          provider: event.provider,
          eventId: event.id,
          eventType: event.type,
          state: "completed",
        });

        if (execution.response.outcome === "handled") {
          return {
            outcome: "duplicate",
            event,
            originalOutcome: "handled",
            dispatch: execution.response.dispatch,
            idempotencyKey,
            record: execution.record,
            problem,
          };
        }

        return {
          outcome: "duplicate",
          event,
          originalOutcome: execution.response.outcome,
          unknownProblem: this.createUnknownEventProblem(event, execution.response.policy),
          idempotencyKey,
          record: execution.record,
          problem,
        };
      }
      case "in-flight":
        return {
          outcome: "in-flight",
          event,
          idempotencyKey,
          record: execution.record,
          problem: new DuplicateWebhookEventProblem({
            provider: event.provider,
            eventId: event.id,
            eventType: event.type,
            state: "in-flight",
          }),
        };
      case "failed":
        return {
          outcome: "failed",
          event,
          idempotencyKey,
          record: execution.record,
          problem: new DuplicateWebhookEventProblem({
            provider: event.provider,
            eventId: event.id,
            eventType: event.type,
            state: "failed",
          }),
        };
    }

    throw new WebhookGatewayConfigurationProblem("unsupported idempotency outcome", {
      outcome: (execution as { readonly outcome: string }).outcome,
    });
  }

  private mapStoredResult(
    stored: WebhookGatewayStoredResult,
    event: WebhookEvent,
    idempotencyKey: DerivedIdempotencyKey,
    record: IdempotencyCompletedRecord<WebhookGatewayStoredResult>,
  ): WebhookGatewayResult {
    if (stored.outcome === "handled") {
      return {
        outcome: "handled",
        event,
        dispatch: stored.dispatch,
        idempotencyKey,
        record,
      };
    }

    return {
      outcome: stored.outcome,
      event,
      idempotencyKey,
      problem: this.createUnknownEventProblem(event, stored.policy),
    };
  }
}

export function createWebhookGateway(options: WebhookGatewayOptions): WebhookGateway {
  return new WebhookGateway(options);
}

function assertConfiguration(options: WebhookGatewayOptions): void {
  if (options.adapter.provider.trim().length === 0) {
    throw new WebhookGatewayConfigurationProblem("adapter provider must be non-empty");
  }

  if (!["fail", "ignore", "report"].includes(options.unknownEventPolicy)) {
    throw new WebhookGatewayConfigurationProblem(
      "unknownEventPolicy must be one of 'fail', 'ignore', or 'report'",
      { unknownEventPolicy: options.unknownEventPolicy },
    );
  }

  if (options.unknownEventPolicy === "report" && !options.unknownEventReporter) {
    throw new WebhookGatewayConfigurationProblem(
      "unknownEventReporter is required when unknownEventPolicy is 'report'",
      { unknownEventPolicy: options.unknownEventPolicy },
    );
  }
}

function stripIdempotencyKey(
  context: WebhookDispatchContext,
): Omit<WebhookDispatchContext, "idempotencyKey"> {
  const { idempotencyKey: _idempotencyKey, ...rest } = context;
  return rest;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function rawBodyToString(rawBody: WebhookRawBody): string {
  if (typeof rawBody === "string") {
    return rawBody;
  }

  return Array.from(rawBody)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
