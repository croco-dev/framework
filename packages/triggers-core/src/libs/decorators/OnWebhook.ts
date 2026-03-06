import { MetadataStorage } from '@croco/framework-context';
import { WEBHOOK_METADATA_KEY } from '../metadataKeys';
import type { WebhookOptions, WebhookTriggerMetadata } from '../types';

export { WEBHOOK_METADATA_KEY } from '../metadataKeys';

/**
 * OnWebhook decorator for handling HTTP webhook requests.
 *
 * @example
 * class StripeWebhookHandler {
 *   &#64;OnWebhook('/webhooks/stripe', 'POST', { auth: true })
 *   async handleStripeWebhook(request: Request) {
 *     const payload = await request.json();
 *     // Stripe 웹훅 처리
 *   }
 *
 *   &#64;OnWebhook('/webhooks/github', 'POST', {
 *     cors: { origin: 'https://github.com' }
 *   })
 *   async handleGithubWebhook(request: Request) {
 *     const payload = await request.json();
 *     // GitHub 웹훅 처리
 *   }
 * }
 */
export function OnWebhook(path: string, method: string, options: WebhookOptions = {}): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const metadata: WebhookTriggerMetadata = {
      type: 'webhook',
      path,
      method: method.toUpperCase(),
      methodName: propertyKey,
      options,
      target,
    };

    MetadataStorage.define(WEBHOOK_METADATA_KEY, target, metadata, propertyKey);

    return descriptor;
  };
}
