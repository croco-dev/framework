import type {
  WebhookDispatchContext,
  WebhookEvent,
  WebhookEventCatalog,
  WebhookEventHandler,
} from "./types";
import { WebhookGatewayConfigurationProblem } from "./problems/WebhookProblems";

type EventPayload<
  TEvents extends WebhookEventCatalog,
  TType extends keyof TEvents & string,
> = TEvents[TType]["payload"];

type EventResult<
  TEvents extends WebhookEventCatalog,
  TType extends keyof TEvents & string,
> = TEvents[TType]["result"];

export class WebhookEventRouter<TEvents extends WebhookEventCatalog = WebhookEventCatalog> {
  private readonly handlers = new Map<string, WebhookEventHandler<WebhookEvent, unknown>>();

  register<TType extends keyof TEvents & string>(
    eventType: TType,
    handler: WebhookEventHandler<
      WebhookEvent<EventPayload<TEvents, TType>, TType>,
      EventResult<TEvents, TType>
    >,
  ): this {
    if (this.handlers.has(eventType)) {
      throw new WebhookGatewayConfigurationProblem(
        `handler already registered for event type '${eventType}'`,
        { eventType },
      );
    }

    this.handlers.set(eventType, handler as WebhookEventHandler<WebhookEvent, unknown>);
    return this;
  }

  has(eventType: string): boolean {
    return this.handlers.has(eventType);
  }

  async dispatch<TType extends keyof TEvents & string>(
    event: WebhookEvent<EventPayload<TEvents, TType>, TType>,
    context: WebhookDispatchContext,
  ): Promise<EventResult<TEvents, TType>> {
    const handler = this.handlers.get(event.type);
    if (!handler) {
      throw new WebhookGatewayConfigurationProblem("no webhook handler registered for event type", {
        eventId: event.id,
        eventType: event.type,
        provider: event.provider,
      });
    }

    return (await handler(event, context)) as EventResult<TEvents, TType>;
  }
}

export function createWebhookEventRouter<
  TEvents extends WebhookEventCatalog = WebhookEventCatalog,
>(): WebhookEventRouter<TEvents> {
  return new WebhookEventRouter<TEvents>();
}
