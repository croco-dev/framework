import type { EventBus } from "./EventBus";
import { type EventHandlerClass, getEventHandlerSubscriptions } from "./EventHandler";
import type { HandlerResolver } from "./HandlerResolver";
import { DefaultHandlerResolver } from "./HandlerResolver";
import { EventBusNotSetProblem } from "./problems/EventsProblems";
import type { EventSubscription } from "./types/EventSubscription";
import type { EventBusStats } from "./EventBusStats";

export interface EventBusStartOptions {
  handlers: EventHandlerClass[];
  resolver?: HandlerResolver;
}

type StartedSubscription = EventSubscription & {
  handler: NonNullable<EventSubscription["handler"]>;
};

/**
 * 전역 EventBus 인스턴스와 핸들러 구독 등록을 관리하는 설정 객체입니다.
 */
export class EventBusConfig {
  private static instance?: EventBusConfig;
  private static stats?: EventBusStats;
  private static readonly handlerIds = new WeakMap<EventHandlerClass, string>();
  private static handlerIdCounter = 0;
  private readonly subscriptions: Set<EventSubscription> = new Set();
  private readonly startedSubscriptions: Map<string, StartedSubscription> = new Map();
  private eventBus?: EventBus;

  public static getInstance(): EventBusConfig {
    if (!EventBusConfig.instance) {
      EventBusConfig.instance = new EventBusConfig();
    }
    return EventBusConfig.instance;
  }

  public static setInstance(config: EventBusConfig): void {
    EventBusConfig.instance = config;
  }

  public static getStats(): EventBusStats | undefined {
    return EventBusConfig.stats;
  }

  public static setStats(stats: EventBusStats): void {
    EventBusConfig.stats = stats;
  }

  public getSubscriptions(): ReadonlySet<EventSubscription> {
    return this.subscriptions;
  }

  public getEventBus(): EventBus {
    if (!this.eventBus) {
      throw new EventBusNotSetProblem();
    }
    return this.eventBus;
  }

  public setEventBus(eventBus: EventBus): void {
    if (this.eventBus === eventBus) {
      return;
    }

    if (this.eventBus) {
      for (const subscription of this.startedSubscriptions.values()) {
        this.eventBus.unsubscribe(subscription);
      }
    }

    this.eventBus = eventBus;

    if (!this.eventBus) {
      return;
    }

    for (const subscription of this.startedSubscriptions.values()) {
      this.eventBus.subscribe(subscription);
    }
  }

  public subscribe(subscription: EventSubscription): void {
    this.subscriptions.add(subscription);
  }

  public unsubscribe(subscription: EventSubscription): void {
    this.subscriptions.delete(subscription);

    if (!this.eventBus) {
      return;
    }

    const subscriptionKey = this.createSubscriptionKey(subscription);
    if (!this.startedSubscriptions.has(subscriptionKey)) {
      return;
    }

    this.eventBus.unsubscribe(subscription);
    this.startedSubscriptions.delete(subscriptionKey);
  }

  public clear(): void {
    this.subscriptions.clear();
    this.startedSubscriptions.clear();
    this.eventBus?.clear();
  }

  public async start(options: EventBusStartOptions): Promise<void> {
    if (!this.eventBus) {
      throw new EventBusNotSetProblem();
    }

    const resolver = options.resolver ?? new DefaultHandlerResolver();

    for (const handlerClass of options.handlers) {
      for (const subscription of getEventHandlerSubscriptions(handlerClass)) {
        this.subscribe(subscription);
      }
    }

    for (const subscription of this.subscriptions) {
      const subscriptionKey = this.createSubscriptionKey(subscription);

      if (this.startedSubscriptions.has(subscriptionKey)) {
        continue;
      }

      const handler = resolver.resolve(subscription.handlerClass);
      const startedSubscription = {
        ...subscription,
        handler,
      };

      this.eventBus.subscribe(startedSubscription);
      this.startedSubscriptions.set(subscriptionKey, startedSubscription);
    }
  }

  private createSubscriptionKey(subscription: EventSubscription): string {
    return `${subscription.eventName}:${EventBusConfig.getHandlerId(subscription.handlerClass)}`;
  }

  private static getHandlerId(handlerClass: EventHandlerClass): string {
    const existing = EventBusConfig.handlerIds.get(handlerClass);
    if (existing) {
      return existing;
    }

    const handlerId = `${handlerClass.name}:${++EventBusConfig.handlerIdCounter}`;
    EventBusConfig.handlerIds.set(handlerClass, handlerId);
    return handlerId;
  }
}
