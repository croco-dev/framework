---
editUrl: false
next: false
prev: false
title: "OutboundWebhookEndpoint"
---

> **OutboundWebhookEndpoint** = `object`

## Properties

### activeSecretVersion

> `readonly` **activeSecretVersion**: `string`

***

### id

> `readonly` **id**: `string`

***

### metadata?

> `readonly` `optional` **metadata?**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

***

### previousSecretValidUntil?

> `readonly` `optional` **previousSecretValidUntil?**: `Date`

***

### previousSecretVersion?

> `readonly` `optional` **previousSecretVersion?**: `string`

***

### signingAlgorithm

> `readonly` **signingAlgorithm**: [`OutboundWebhookSigningAlgorithm`](/api/webhooks-core/src/type-aliases/outboundwebhooksigningalgorithm/)

***

### status

> `readonly` **status**: [`OutboundWebhookEndpointStatus`](/api/webhooks-core/src/type-aliases/outboundwebhookendpointstatus/)

***

### subscribedEventNames

> `readonly` **subscribedEventNames**: readonly `string`[]

***

### tenantId

> `readonly` **tenantId**: `string`

***

### url

> `readonly` **url**: `string`
