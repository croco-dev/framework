import { triggerRegistry } from '../TriggerRegistry';
import type { WebhookOptions, WebhookTriggerMetadata } from '../types';

export const WEBHOOK_METADATA_KEY = Symbol('WEBHOOK_METADATA');

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

    triggerRegistry.register(metadata);

    return descriptor;
  };
}
