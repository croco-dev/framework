import { MetadataStorage } from '@croco/framework-context';
import { EVENT_METADATA_KEY } from '../metadataKeys';
import type { EventOptions, EventTriggerMetadata } from '../types';

export { EVENT_METADATA_KEY } from '../metadataKeys';

/**
 * OnEvent decorator for handling domain events.
 *
 * Integration with @croco/events-core will be implemented separately.
 *
 * @example
 * class OrderEventHandler {
 *   &#64;OnEvent('OrderPlaced', { name: 'order-confirmation' })
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
export function OnEvent(event: string, options: EventOptions = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const metadata: EventTriggerMetadata = {
      type: 'event',
      event,
      methodName: propertyKey,
      options,
      target,
    };

    MetadataStorage.define(EVENT_METADATA_KEY, target, metadata, propertyKey);

    return descriptor;
  };
}
