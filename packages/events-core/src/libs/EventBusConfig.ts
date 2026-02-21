import type { EventBus, EventSubscription } from './EventBus';
import type { EventHandlerClass } from './EventHandler';
import type { HandlerResolver } from './HandlerResolver';
import { DefaultHandlerResolver } from './HandlerResolver';

export interface EventBusStartOptions {
  handlers: EventHandlerClass[];
  resolver?: HandlerResolver;
}

export class EventBusConfig {
  private static INSTANCE: EventBusConfig;
  private readonly subscriptions: Set<EventSubscription> = new Set();
  private eventBus?: EventBus;

  private constructor() {}

  public static getInstance(): EventBusConfig {
    if (!EventBusConfig.INSTANCE) {
      EventBusConfig.INSTANCE = new EventBusConfig();
    }

    return EventBusConfig.INSTANCE;
  }

  public getEventBus(): EventBus {
    if (!this.eventBus) {
      throw new Error('EventBus has not been set. Call setEventBus() first.');
    }
    return this.eventBus;
  }

  public setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  public subscribe(subscription: EventSubscription): void {
    this.subscriptions.add(subscription);
  }

  public async start(options: EventBusStartOptions): Promise<void> {
    if (!this.eventBus) {
      throw new Error('EventBus is not set');
    }

    const resolver = options.resolver ?? new DefaultHandlerResolver();

    for (const subscription of this.subscriptions) {
      const handler = resolver.resolve(subscription.handlerClass);
      this.eventBus.subscribe({
        ...subscription,
        handler,
      });
    }
  }
}
