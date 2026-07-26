---
editUrl: false
next: false
prev: false
title: "WebhookOperationsMutationExecutor"
---

> **WebhookOperationsMutationExecutor**\<`TResult`\> = `object`

## Type Parameters

### TResult

`TResult`

## Methods

### execute()

> **execute**(`input`): `Promise`\<`TResult`\>

Implementations must apply the mutation, idempotency claim, and audit append atomically.

#### Parameters

##### input

###### action

[`WebhookOperationsAction`](/api/admin-core/src/type-aliases/webhookoperationsaction/)

###### request

[`WebhookOperationsActionRequest`](/api/admin-core/src/type-aliases/webhookoperationsactionrequest/)

#### Returns

`Promise`\<`TResult`\>
