---
editUrl: false
next: false
prev: false
title: "executeWebhookOperationsAction"
---

> **executeWebhookOperationsAction**\<`TResult`\>(`input`): `Promise`\<`TResult`\>

## Type Parameters

### TResult

`TResult`

## Parameters

### input

#### action

[`WebhookOperationsAction`](/api/admin-core/src/type-aliases/webhookoperationsaction/)

#### executor

[`WebhookOperationsMutationExecutor`](/api/admin-core/src/type-aliases/webhookoperationsmutationexecutor/)\<`TResult`\>

#### expectedTenantId

`string`

#### grantedPermissions

readonly `string`[]

#### request

[`WebhookOperationsActionRequest`](/api/admin-core/src/type-aliases/webhookoperationsactionrequest/)

## Returns

`Promise`\<`TResult`\>
