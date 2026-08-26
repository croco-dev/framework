---
editUrl: false
next: false
prev: false
title: "OnWebhook"
---

Webhook trigger metadata key and decorator.

## Call Signature

> **OnWebhook**\<`Ref`\>(`webhook`, `options?`): `TypedTriggerMethodDecorator`\<`TriggerRefInput`\<`Ref`\>, `TriggerRefResult`\<`Ref`\>\>

OnWebhook decorator for handling HTTP webhook requests.

Pass a typed reference from `defineWebhookTrigger` to verify the handler request and result at
compile time. Path/method arguments remain available for compatibility and accept only supported
HTTP method literals.

### Type Parameters

#### Ref

`Ref` _extends_ `AnyWebhookTriggerRef`

### Parameters

#### webhook

`Ref`

#### options?

[`WebhookOptions`](/api/triggers-core/src/type-aliases/webhookoptions/)

### Returns

`TypedTriggerMethodDecorator`\<`TriggerRefInput`\<`Ref`\>, `TriggerRefResult`\<`Ref`\>\>

### Example

```ts
const stripeWebhook = defineWebhookTrigger<Request, Response>()('/webhooks/stripe', 'POST');

class StripeWebhookHandler {
  &#64;OnWebhook(stripeWebhook, { auth: true })
  async handleStripeWebhook(request: Request): Promise<Response> {
    const payload = await request.json();
    return new Response(JSON.stringify(payload));
  }

  &#64;OnWebhook('/webhooks/github', 'POST', {
    cors: { origin: 'https://github.com' }
  })
  async handleGithubWebhook(request: Request) {
    const payload = await request.json();
    // GitHub 웹훅 처리
  }
}
```

## Call Signature

> **OnWebhook**\<`Method`\>(`path`, `method`, `options?`): `MethodDecorator`

OnWebhook decorator for handling HTTP webhook requests.

Pass a typed reference from `defineWebhookTrigger` to verify the handler request and result at
compile time. Path/method arguments remain available for compatibility and accept only supported
HTTP method literals.

### Type Parameters

#### Method

`Method` _extends_ `string`

### Parameters

#### path

`string`

#### method

`Method` & `SupportedOrDynamicWebhookMethod`\<`NoInfer`\<`Method`\>\>

#### options?

[`WebhookOptions`](/api/triggers-core/src/type-aliases/webhookoptions/)

### Returns

`MethodDecorator`

### Example

```ts
const stripeWebhook = defineWebhookTrigger<Request, Response>()('/webhooks/stripe', 'POST');

class StripeWebhookHandler {
  &#64;OnWebhook(stripeWebhook, { auth: true })
  async handleStripeWebhook(request: Request): Promise<Response> {
    const payload = await request.json();
    return new Response(JSON.stringify(payload));
  }

  &#64;OnWebhook('/webhooks/github', 'POST', {
    cors: { origin: 'https://github.com' }
  })
  async handleGithubWebhook(request: Request) {
    const payload = await request.json();
    // GitHub 웹훅 처리
  }
}
```
