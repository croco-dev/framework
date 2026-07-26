---
editUrl: false
next: false
prev: false
title: "PolarWebhookHandler"
---

Polar webhook handler for processing incoming webhook events.

Validates webhook signatures and delegates to event handlers.

## Example

```typescript
import { PolarWebhookHandler, PolarEventMapper } from '@croco/billing-polar';

const handler = new PolarWebhookHandler({
  accessToken: 'polar_access_token',
  environment: 'sandbox',
  webhookSecret: 'whsec_...'
}, {
  store,
  eventPublisher,
  planRegistry
});

const result = await handler.handle(rawPayload, requestHeaders);
```

## Constructors

### Constructor

> **new PolarWebhookHandler**(`config`, `deps`): `PolarWebhookHandler`

#### Parameters

##### config

[`PolarConfig`](/api/billing-polar/src/type-aliases/polarconfig/)

##### deps

[`WebhookDependencies`](/api/billing-polar/src/type-aliases/webhookdependencies/)

#### Returns

`PolarWebhookHandler`

## Methods

### handle()

> **handle**(`body`, `headers`): `Promise`\<[`WebhookHandlerResult`](/api/billing-polar/src/type-aliases/webhookhandlerresult/)\>

#### Parameters

##### body

`string` \| `Buffer`\<`ArrayBufferLike`\>

##### headers

`Record`\<`string`, `string`\>

#### Returns

`Promise`\<[`WebhookHandlerResult`](/api/billing-polar/src/type-aliases/webhookhandlerresult/)\>
