---
editUrl: false
next: false
prev: false
title: "ClerkWebhookHandler"
---

Clerk 웹훅 서명 검증과 이벤트 분기를 처리하는 핸들러입니다.

## Constructors

### Constructor

> **new ClerkWebhookHandler**(`options`, `handlers`): `ClerkWebhookHandler`

#### Parameters

##### options

[`WebhookHandlerOptions`](/api/auth-clerk/src/type-aliases/webhookhandleroptions/)

##### handlers

[`WebhookEventHandler`](/api/auth-clerk/src/type-aliases/webhookeventhandler/)

#### Returns

`ClerkWebhookHandler`

## Methods

### handleWebhook()

> **handleWebhook**(`request`): `Promise`\<[`ClerkWebhookDeliveryOutcome`](/api/auth-clerk/src/type-aliases/clerkwebhookdeliveryoutcome/)\>

#### Parameters

##### request

`Request`

#### Returns

`Promise`\<[`ClerkWebhookDeliveryOutcome`](/api/auth-clerk/src/type-aliases/clerkwebhookdeliveryoutcome/)\>
