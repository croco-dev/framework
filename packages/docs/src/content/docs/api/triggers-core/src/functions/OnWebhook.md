---
editUrl: false
next: false
prev: false
title: "OnWebhook"
---

> **OnWebhook**(`path`, `method`, `options?`): `MethodDecorator`

OnWebhook decorator for handling HTTP webhook requests.

## Parameters

### path

`string`

### method

`string`

### options?

[`WebhookOptions`](/api/triggers-core/src/type-aliases/webhookoptions/) = `{}`

## Returns

`MethodDecorator`

## Example

```ts
class StripeWebhookHandler {
  &#64;OnWebhook('/webhooks/stripe', 'POST', { auth: true })
  async handleStripeWebhook(request: Request) {
    const payload = await request.json();
    // Stripe 웹훅 처리
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
