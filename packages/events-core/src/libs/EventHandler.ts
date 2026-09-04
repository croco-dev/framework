import { type Constructor, MetadataStorage } from "@croco/framework-context";
import type { DomainEvent } from "./DomainEvent";
import type { EventSubscription } from "./types/EventSubscription";

export interface EventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void> | void;
}

type DomainEventClass<
  TEvent extends DomainEvent = DomainEvent,
  TArgs extends unknown[] = unknown[],
> = (new (...args: TArgs) => TEvent) & {
  eventName?: string;
};

export type EventHandlerClass<T extends DomainEvent = DomainEvent> = Constructor<EventHandler<T>>;

type AnyEventHandlerClass = EventHandlerClass<never>;

type OverloadUnionRecursive<
  TOverload,
  TPartialOverload = unknown,
  TSeenParameters extends unknown[] = never,
  TRepeated extends boolean = false,
> = TOverload extends (...args: infer TParameters) => infer TResult
  ? TPartialOverload extends TOverload
    ? never
    : [TParameters] extends [TSeenParameters]
      ? TRepeated extends true
        ? never
        :
            | OverloadUnionRecursive<
                TPartialOverload & TOverload,
                TPartialOverload & ((...args: TParameters) => TResult),
                TSeenParameters,
                true
              >
            | ((...args: TParameters) => TResult)
      :
          | OverloadUnionRecursive<
              TPartialOverload & TOverload,
              TPartialOverload & ((...args: TParameters) => TResult),
              TSeenParameters | TParameters,
              false
            >
          | ((...args: TParameters) => TResult)
  : never;

type OverloadUnion<TOverload extends (...args: never[]) => unknown> = Exclude<
  OverloadUnionRecursive<(() => never) & TOverload>,
  TOverload extends () => never ? never : () => never
>;

type FunctionParameters<TFunction> = TFunction extends (...args: infer TParameters) => unknown
  ? TParameters
  : never;

type EventHandlerParameterTuples<THandlerClass extends AnyEventHandlerClass> = FunctionParameters<
  OverloadUnion<InstanceType<THandlerClass>["handle"]>
>;

type EventHandlerParameterTupleAccepting<
  TParameters extends unknown[],
  TEvent extends DomainEvent,
> = TParameters extends unknown[] ? ([TEvent] extends TParameters ? TParameters : never) : never;

type StrictEventHandler<TEvent extends DomainEvent> = {
  handle: (event: TEvent) => Promise<void> | void;
};

type CompatibleEventHandlerClass<
  THandlerClass extends AnyEventHandlerClass,
  TEvent extends DomainEvent,
> = THandlerClass &
  ([
    EventHandlerParameterTupleAccepting<
      EventHandlerParameterTuples<NoInfer<THandlerClass>>,
      TEvent
    >,
  ] extends [never]
    ? InstanceType<THandlerClass>["handle"] extends () => unknown
      ? never
      : InstanceType<THandlerClass> extends StrictEventHandler<TEvent>
        ? unknown
        : never
    : unknown);

const EVENT_HANDLER_SUBSCRIPTION_METADATA = Symbol("events-core:event-handler-subscription");

/**
 * 핸들러 클래스에 등록된 이벤트 구독 메타데이터를 조회합니다.
 */
export function getEventHandlerSubscriptions<TEvent extends DomainEvent>(
  handlerClass: EventHandlerClass<TEvent>,
): EventSubscription<TEvent>[] {
  return MetadataStorage.getAllForTarget<EventSubscription<TEvent>>(
    EVENT_HANDLER_SUBSCRIPTION_METADATA,
    handlerClass,
  ).map(({ value }) => value);
}

/**
 * 이벤트 클래스와 핸들러 클래스를 연결하는 데코레이터입니다.
 */
export function RegisterEventHandler<TEvent extends DomainEvent, TArgs extends unknown[]>(
  eventClass: DomainEventClass<TEvent, TArgs>,
  options?: { eventName?: string; handlerId?: string },
) {
  return <T extends AnyEventHandlerClass>(f: CompatibleEventHandlerClass<T, TEvent>): void => {
    MetadataStorage.define(EVENT_HANDLER_SUBSCRIPTION_METADATA, f, {
      eventName: options?.eventName ?? eventClass.eventName ?? eventClass.name,
      handlerClass: f,
      ...(options?.handlerId === undefined ? {} : { handlerId: options.handlerId }),
    });
  };
}
