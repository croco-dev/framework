import { MetadataStorage } from "@croco/framework-context";
import { EVENT_METADATA_KEY } from "../metadataKeys";
import type {
  AnyEventTriggerRef,
  TriggerRefInput,
  TriggerRefResult,
  TypedTriggerMethodDecorator,
} from "../TriggerRef";
import type { EventOptions, EventTriggerMetadata } from "../types";

export { EVENT_METADATA_KEY } from "../metadataKeys";

/**
 * OnEvent decorator for handling domain events.
 *
 * Pass a typed reference from `defineEventTrigger` to verify the handler payload and result at
 * compile time. String event names remain available for compatibility.
 *
 * @example
 * const orderPlaced = defineEventTrigger<OrderPlacedEvent>()('OrderPlaced');
 *
 * class OrderEventHandler {
 *   &#64;OnEvent(orderPlaced, { name: 'order-confirmation' })
 *   async sendConfirmation(event: OrderPlacedEvent) {
 *     // 주문 확인 이메일 발송
 *   }
 *
 *   &#64;OnEvent('PaymentFailed', { concurrency: 5 })
 *   async handlePaymentFailure(event: PaymentFailedEvent) {
 *     // 결제 실패 처리
 *   }
 * }
 */
export function OnEvent<Ref extends AnyEventTriggerRef>(
  event: Ref,
  options?: EventOptions,
): TypedTriggerMethodDecorator<TriggerRefInput<Ref>, TriggerRefResult<Ref>>;
export function OnEvent(event: string, options?: EventOptions): MethodDecorator;
export function OnEvent(event: string | AnyEventTriggerRef, options: EventOptions = {}): unknown {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const metadata: EventTriggerMetadata = {
      type: "event",
      event: typeof event === "string" ? event : event.name,
      methodName: propertyKey,
      options,
      target,
    };

    MetadataStorage.define(EVENT_METADATA_KEY, target, metadata, propertyKey);

    return descriptor;
  };
}
