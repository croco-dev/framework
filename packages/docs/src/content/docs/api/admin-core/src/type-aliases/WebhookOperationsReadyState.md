---
editUrl: false
next: false
prev: false
title: "WebhookOperationsReadyState"
---

> **WebhookOperationsReadyState** = `object`

## Properties

### actions

> `readonly` **actions**: readonly [`WebhookOperationsAction`](/api/admin-core/src/type-aliases/webhookoperationsaction/)[]

***

### attempts

> `readonly` **attempts**: readonly [`WebhookAttemptOperationsRow`](/api/admin-core/src/type-aliases/webhookattemptoperationsrow/)[]

***

### deliveries

> `readonly` **deliveries**: readonly [`WebhookDeliveryOperationsRow`](/api/admin-core/src/type-aliases/webhookdeliveryoperationsrow/)[]

***

### endpoints

> `readonly` **endpoints**: readonly [`WebhookEndpointOperationsRow`](/api/admin-core/src/type-aliases/webhookendpointoperationsrow/)[]

***

### events

> `readonly` **events**: readonly [`WebhookLogicalEventOperationsRow`](/api/admin-core/src/type-aliases/webhooklogicaleventoperationsrow/)[]

***

### generatedAt

> `readonly` **generatedAt**: `Date`

***

### kind

> `readonly` **kind**: `"ready"`

***

### tenantId

> `readonly` **tenantId**: `string`
