---
editUrl: false
next: false
prev: false
title: "WebhookEndpointOperationsRow"
---

> **WebhookEndpointOperationsRow** = `object`

## Properties

### id

> `readonly` **id**: `string`

***

### lastFailureAt?

> `readonly` `optional` **lastFailureAt?**: `Date`

***

### lastSuccessAt?

> `readonly` `optional` **lastSuccessAt?**: `Date`

***

### maskedUrl

> `readonly` **maskedUrl**: `string`

***

### secret

> `readonly` **secret**: [`WebhookSecretVersionMetadata`](/api/admin-core/src/type-aliases/webhooksecretversionmetadata/)

***

### status

> `readonly` **status**: [`WebhookEndpointOperationalStatus`](/api/admin-core/src/type-aliases/webhookendpointoperationalstatus/)

***

### subscriptions

> `readonly` **subscriptions**: readonly [`WebhookEventSubscription`](/api/admin-core/src/type-aliases/webhookeventsubscription/)[]

***

### successRate?

> `readonly` `optional` **successRate?**: `number`

***

### tenantId

> `readonly` **tenantId**: `string`
