---
editUrl: false
next: false
prev: false
title: "WebhookEvent"
---

> **WebhookEvent**\<`TPayload`, `TType`\> = `object`

## Type Parameters

### TPayload

`TPayload` = `unknown`

### TType

`TType` *extends* `string` = `string`

## Properties

### fingerprint?

> `readonly` `optional` **fingerprint**: `string`

***

### id

> `readonly` **id**: `string`

***

### occurredAt?

> `readonly` `optional` **occurredAt**: `Date`

***

### payload

> `readonly` **payload**: `TPayload`

***

### provider

> `readonly` **provider**: `string`

***

### tenantId?

> `readonly` `optional` **tenantId**: `string` \| `null`

***

### type

> `readonly` **type**: `TType`
