import type { EventBus, EventSubscription } from './EventBus';
import type { EventHandlerClass } from './EventHandler';
import type { HandlerResolver } from './HandlerResolver';
import { DefaultHandlerResolver } from './HandlerResolver';
import { EventBusNotSetProblem } from './problems/EventsProblems';

export interface EventBusStartOptions {
  handlers: EventHandlerClass[];
  resolver?: HandlerResolver;
}

export class EventBusConfig {
  private static instance?: EventBusConfig;
  private readonly subscriptions: Set<EventSubscription> = new Set();
  private readonly startedSubscriptionKeys: Set<string> = new Set();
  private eventBus?: EventBus;

  constructor() {}

  public static getInstance(): EventBusConfig {
    if (!EventBusConfig.instance) {
      EventBusConfig.instance = new EventBusConfig();
    }
    return EventBusConfig.instance;
  }

  public static setInstance(config: EventBusConfig): void {
    EventBusConfig.instance = config;
  }

  public getEventBus(): EventBus {
    if (!this.eventBus) {
      throw new EventBusNotSetProblem();
    }
    return this.eventBus;
  }

  public setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
    this.startedSubscriptionKeys.clear();
  }

  public subscribe(subscription: EventSubscription): void {
    this.subscriptions.add(subscription);
  }

  public async start(options: EventBusStartOptions): Promise<void> {
    if (!this.eventBus) {
      throw new EventBusNotSetProblem();
    }

    const resolver = options.resolver ?? new DefaultHandlerResolver();

    for (const subscription of this.subscriptions) {
      const subscriptionKey = this.createSubscriptionKey(subscription);

      if (this.startedSubscriptionKeys.has(subscriptionKey)) {
        continue;
      }

      const handler = resolver.resolve(subscription.handlerClass);
      this.eventBus.subscribe({
        ...subscription,
        handler,
      });
      this.startedSubscriptionKeys.add(subscriptionKey);
    }
  }

  private createSubscriptionKey(subscription: EventSubscription): string {
    return `${subscription.eventName}:${subscription.handlerClass.name}`;
  }
}
