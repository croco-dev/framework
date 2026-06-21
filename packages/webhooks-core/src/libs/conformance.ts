import { InMemoryIdempotencyStore, type IdempotencyStore } from "@croco/idempotency-core";
import { WebhookGateway } from "./WebhookGateway";
import { createWebhookEventRouter } from "./WebhookEventRouter";
import { normalizeWebhookHeaders } from "./headers";
import { InvalidWebhookSignatureProblem } from "./problems/WebhookProblems";
import type {
  WebhookEvent,
  WebhookGatewayRequest,
  WebhookGatewayStoredResult,
  WebhookProviderAdapter,
} from "./types";

export type WebhookProviderAdapterConformanceCase = {
  readonly name: string;
  run(): Promise<void>;
};

export type WebhookProviderAdapterConformanceOptions<TEvent extends WebhookEvent = WebhookEvent> = {
  readonly createAdapter: () =>
    | Promise<WebhookProviderAdapter<TEvent>>
    | WebhookProviderAdapter<TEvent>;
  readonly validRequest: WebhookGatewayRequest;
  readonly invalidSignatureRequest: WebhookGatewayRequest;
  readonly expectedEvent: {
    readonly id: string;
    readonly type: TEvent["type"] & string;
    readonly provider?: string;
  };
  readonly createIdempotencyStore?: () =>
    | Promise<IdempotencyStore<WebhookGatewayStoredResult>>
    | IdempotencyStore<WebhookGatewayStoredResult>;
};

export type WebhookProviderAdapterConformanceSuite = {
  readonly cases: readonly WebhookProviderAdapterConformanceCase[];
};

export function createWebhookProviderAdapterConformanceSuite<TEvent extends WebhookEvent>(
  options: WebhookProviderAdapterConformanceOptions<TEvent>,
): WebhookProviderAdapterConformanceSuite {
  return {
    cases: [
      {
        name: "verifies a valid request into the provider-neutral webhook event envelope",
        run: async () => {
          const adapter = await options.createAdapter();
          const event = await adapter.verify({
            rawBody: options.validRequest.rawBody,
            headers: normalizeWebhookHeaders(options.validRequest.headers),
            receivedAt: options.validRequest.receivedAt ?? new Date("2026-06-21T00:00:00.000Z"),
            ...(options.validRequest.metadata === undefined
              ? {}
              : { metadata: options.validRequest.metadata }),
          });

          assertEqual(
            event.id,
            options.expectedEvent.id,
            "adapter must preserve the provider event id",
          );
          assertEqual(
            event.type,
            options.expectedEvent.type,
            "adapter must preserve the provider event type",
          );
          assertEqual(
            event.provider,
            options.expectedEvent.provider ?? adapter.provider,
            "adapter must emit the provider name used by the gateway",
          );
        },
      },
      {
        name: "rejects invalid signatures before gateway dispatch",
        run: async () => {
          const { gateway, handlerCalls } = await createConformanceGateway(options);

          await assertRejects(
            () => gateway.handle(options.invalidSignatureRequest),
            "InvalidWebhookSignatureProblem",
            (error) => error instanceof InvalidWebhookSignatureProblem,
          );
          assertEqual(handlerCalls.count, 0, "invalid signatures must not reach handlers");
        },
      },
      {
        name: "reuses gateway idempotency for deterministic duplicate deliveries",
        run: async () => {
          const { gateway, handlerCalls } = await createConformanceGateway(options);

          const first = await gateway.handle(options.validRequest);
          const duplicate = await gateway.handle(options.validRequest);

          assertEqual(first.outcome, "handled", "first verified delivery must dispatch once");
          assertEqual(duplicate.outcome, "duplicate", "second verified delivery must replay");
          assertEqual(handlerCalls.count, 1, "duplicate deliveries must not run the handler again");

          if (
            first.outcome === "handled" &&
            duplicate.outcome === "duplicate" &&
            duplicate.originalOutcome === "handled"
          ) {
            assertDeepEqual(
              duplicate.dispatch,
              first.dispatch,
              "duplicate deliveries must replay the stored dispatch result",
            );
          }
        },
      },
      {
        name: "replays local fixtures through the same gateway path",
        run: async () => {
          const { adapter, gateway, handlerCalls } = await createConformanceGateway(options);
          const result = await gateway.replay({
            provider: adapter.provider,
            ...options.validRequest,
          });

          assertEqual(
            result.outcome,
            "handled",
            "fixture replay must dispatch through the gateway",
          );
          assertEqual(
            handlerCalls.count,
            1,
            "fixture replay must invoke the matching handler once",
          );
        },
      },
    ],
  };
}

async function createConformanceGateway<TEvent extends WebhookEvent>(
  options: WebhookProviderAdapterConformanceOptions<TEvent>,
) {
  const adapter = await options.createAdapter();
  const handlerCalls = { count: 0 };
  const router = createWebhookEventRouter<
    Record<string, { payload: unknown; result: { handled: true } }>
  >().register(options.expectedEvent.type, () => {
    handlerCalls.count += 1;
    return { handled: true };
  });
  const idempotencyStore =
    (await options.createIdempotencyStore?.()) ??
    new InMemoryIdempotencyStore<WebhookGatewayStoredResult>();

  return {
    adapter,
    handlerCalls,
    gateway: new WebhookGateway({
      adapter,
      router,
      idempotencyStore,
      unknownEventPolicy: "fail",
      now: () => new Date("2026-06-21T00:00:00.000Z"),
    }),
  };
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}.`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}. Expected ${expectedJson}, got ${actualJson}.`);
  }
}

async function assertRejects(
  fn: () => Promise<unknown>,
  expectedName: string,
  matches: (error: unknown) => boolean,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (matches(error)) {
      return;
    }

    throw new Error(
      `Expected ${expectedName}, got ${error instanceof Error ? error.name : String(error)}.`,
    );
  }

  throw new Error(`Expected ${expectedName} to be thrown.`);
}
