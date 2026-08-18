---
editUrl: false
next: false
prev: false
title: "WebhookEventHandler"
---

> **WebhookEventHandler**\<`TEvent`, `TResult`\> = (`event`, `context`) => `Promise`\<`TResult`\> \| `TResult`

## Type Parameters

### TEvent

`TEvent` _extends_ [`WebhookEvent`](/api/webhooks-core/src/type-aliases/webhookevent/) = [`WebhookEvent`](/api/webhooks-core/src/type-aliases/webhookevent/)

### TResult

`TResult` = `unknown`

## Parameters

### event

`TEvent`

### context

[`WebhookDispatchContext`](/api/webhooks-core/src/type-aliases/webhookdispatchcontext/)

## Returns

`Promise`\<`TResult`\> \| `TResult`
