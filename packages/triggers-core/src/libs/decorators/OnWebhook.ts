import { MetadataStorage } from "@croco/framework-context";
import { WEBHOOK_METADATA_KEY } from "../metadataKeys";
import type {
  AnyWebhookTriggerRef,
  TriggerRefInput,
  TriggerRefResult,
  TypedTriggerMethodDecorator,
  WebhookHttpMethodInput,
} from "../TriggerRef";
import { normalizeWebhookHttpMethod } from "../TriggerRef";
import type { WebhookOptions, WebhookTriggerMetadata } from "../types";

export { WEBHOOK_METADATA_KEY } from "../metadataKeys";

type SupportedOrDynamicWebhookMethod<Method extends string> = string extends Method
  ? unknown
  : [Method] extends [WebhookHttpMethodInput]
    ? unknown
    : never;

/**
 * OnWebhook decorator for handling HTTP webhook requests.
 *
 * Pass a typed reference from `defineWebhookTrigger` to verify the handler request and result at
 * compile time. Path/method arguments remain available for compatibility and accept only supported
 * HTTP method literals.
 *
 * @example
 * const stripeWebhook = defineWebhookTrigger<Request, Response>()('/webhooks/stripe', 'POST');
 *
 * class StripeWebhookHandler {
 *   &#64;OnWebhook(stripeWebhook, { auth: true })
 *   async handleStripeWebhook(request: Request): Promise<Response> {
 *     const payload = await request.json();
 *     return new Response(JSON.stringify(payload));
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
export function OnWebhook<Ref extends AnyWebhookTriggerRef>(
  webhook: Ref,
  options?: WebhookOptions,
): TypedTriggerMethodDecorator<TriggerRefInput<Ref>, TriggerRefResult<Ref>>;
export function OnWebhook<const Method extends string>(
  path: string,
  method: Method & SupportedOrDynamicWebhookMethod<NoInfer<Method>>,
  options?: WebhookOptions,
): MethodDecorator;
export function OnWebhook(
  pathOrWebhook: string | AnyWebhookTriggerRef,
  methodOrOptions?: string | WebhookOptions,
  options: WebhookOptions = {},
): unknown {
  const webhook = typeof pathOrWebhook === "string" ? undefined : pathOrWebhook;
  const path = typeof pathOrWebhook === "string" ? pathOrWebhook : pathOrWebhook.path;
  const method = webhook?.method ?? (methodOrOptions as string);
  const normalizedOptions = webhook
    ? ((methodOrOptions as WebhookOptions | undefined) ?? {})
    : options;
  const normalizedMethod = normalizeWebhookHttpMethod(method);

  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const metadata: WebhookTriggerMetadata = {
      type: "webhook",
      path,
      method: normalizedMethod,
      methodName: propertyKey,
      options: normalizedOptions,
      target,
    };

    MetadataStorage.define(WEBHOOK_METADATA_KEY, target, metadata, propertyKey);

    return descriptor;
  };
}
