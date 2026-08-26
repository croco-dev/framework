import { describe, expect, expectTypeOf, it } from "vitest";
import { defineEventTrigger, defineWebhookTrigger, OnEvent, OnWebhook } from "../index";

type OrderPlaced = {
  readonly orderId: string;
};

type JsonParseResult = ReturnType<typeof JSON.parse>;

const ORDER_PLACED = defineEventTrigger<OrderPlaced>()("OrderPlaced");
const PAYMENT_WEBHOOK = defineWebhookTrigger<Request, Response>()("/webhooks/payment", "POST");

describe("typed trigger references", () => {
  it("preserves serializable trigger literals", () => {
    const ping = defineEventTrigger("Ping");
    const mixedCaseWebhook = defineWebhookTrigger("/webhooks/mixed-case", "pOsT");

    expectTypeOf(ORDER_PLACED.type).toEqualTypeOf<"event">();
    expectTypeOf(ORDER_PLACED.name).toEqualTypeOf<"OrderPlaced">();
    expectTypeOf(ping.name).toEqualTypeOf<"Ping">();
    expectTypeOf(PAYMENT_WEBHOOK.type).toEqualTypeOf<"webhook">();
    expectTypeOf(PAYMENT_WEBHOOK.path).toEqualTypeOf<"/webhooks/payment">();
    expectTypeOf(PAYMENT_WEBHOOK.method).toEqualTypeOf<"POST">();
    expectTypeOf(mixedCaseWebhook.method).toEqualTypeOf<"POST">();
    expect(JSON.parse(JSON.stringify([ping, mixedCaseWebhook]))).toEqual([
      { type: "event", name: "Ping" },
      { type: "webhook", path: "/webhooks/mixed-case", method: "POST" },
    ]);
    expect(Object.isFrozen(ping)).toBe(true);
    expect(Object.isFrozen(mixedCaseWebhook)).toBe(true);
  });

  it("accepts handlers matching the declared input and result contracts", () => {
    class ValidHandlers {
      @OnEvent(ORDER_PLACED)
      async orderPlaced(event: OrderPlaced): Promise<void> {
        void event;
      }

      @OnWebhook(PAYMENT_WEBHOOK)
      payment(request: Request): Response {
        return new Response(request.url);
      }
    }

    expectTypeOf(new ValidHandlers().orderPlaced).toBeFunction();
  });

  it("accepts compatible private and protected handlers", () => {
    class EncapsulatedHandlers {
      @OnEvent(ORDER_PLACED)
      private orderPlaced(event: OrderPlaced): void {
        void event;
      }

      @OnWebhook(PAYMENT_WEBHOOK)
      protected payment(request: Request): Promise<Response> {
        return Promise.resolve(new Response(request.url));
      }
    }

    expectTypeOf(EncapsulatedHandlers).toBeConstructibleWith();
  });
});

class InvalidEventPayloadHandler {
  // @ts-expect-error event handlers must accept the referenced payload in their first argument
  @OnEvent(ORDER_PLACED)
  handle(_event: string): void {}
}

class MissingEventPayloadHandler {
  // @ts-expect-error typed event handlers require a first payload argument
  @OnEvent(ORDER_PLACED)
  handle(): void {}
}

class InvalidEventResultHandler {
  // @ts-expect-error event handler results must match the referenced result contract
  @OnEvent(ORDER_PLACED)
  handle(_event: OrderPlaced): string {
    return "invalid";
  }
}

class InvalidAsyncEventResultHandler {
  // @ts-expect-error awaited event handler results cannot bypass the contract with any
  @OnEvent(ORDER_PLACED)
  async handle(_event: OrderPlaced): Promise<JsonParseResult> {}
}

class InvalidWebhookRequestHandler {
  // @ts-expect-error webhook handlers must accept the referenced request in their first argument
  @OnWebhook(PAYMENT_WEBHOOK)
  handle(_request: URL): Response {
    return new Response();
  }
}

class InvalidWebhookResultHandler {
  // @ts-expect-error webhook handler results must match the referenced result contract
  @OnWebhook(PAYMENT_WEBHOOK)
  handle(_request: Request): void {}
}

class InvalidAsyncWebhookResultHandler {
  // @ts-expect-error awaited webhook handler results cannot bypass the contract with any
  @OnWebhook(PAYMENT_WEBHOOK)
  async handle(_request: Request): Promise<JsonParseResult> {}
}

function rejectUnsupportedWebhookMethodsAtCompileTime(): void {
  class UnsupportedWebhookMethodHandler {
    // @ts-expect-error unsupported HTTP methods are rejected before runtime
    @OnWebhook("/webhooks/payment", "BREW")
    handle(): void {}
  }

  // @ts-expect-error webhook references accept only supported HTTP method literals
  defineWebhookTrigger<Request>()("/webhooks/payment", "TRACE");

  void UnsupportedWebhookMethodHandler;
}

void InvalidEventPayloadHandler;
void MissingEventPayloadHandler;
void InvalidEventResultHandler;
void InvalidAsyncEventResultHandler;
void InvalidWebhookRequestHandler;
void InvalidWebhookResultHandler;
void InvalidAsyncWebhookResultHandler;
void rejectUnsupportedWebhookMethodsAtCompileTime;
