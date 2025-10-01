import { EventBus, EventSubscription } from './EventBus';
import { EventHandlerClass } from './EventHandler';

export class EventBusConfig {
  private static INSTANCE: EventBusConfig;
  private readonly subscriptions: Set<EventSubscription> = new Set();
  private eventBus: EventBus;

  private constructor() {}

  public static getInstance(): EventBusConfig {
    if (!EventBusConfig.INSTANCE) {
      EventBusConfig.INSTANCE = new EventBusConfig();
    }

    return EventBusConfig.INSTANCE;
  }

  public getEventBus(): EventBus {
    return this.eventBus;
  }

  public setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus;
  }

  public subscribe(subscription: EventSubscription): void {
    this.subscriptions.add(subscription);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async start(_: { handlers: EventHandlerClass[] }): Promise<void> {
    if (!this.eventBus) {
      throw new Error('EventBus is not set');
    }

    for (const subscription of this.subscriptions) {
      this.eventBus.subscribe(subscription);
    }
  }
}
