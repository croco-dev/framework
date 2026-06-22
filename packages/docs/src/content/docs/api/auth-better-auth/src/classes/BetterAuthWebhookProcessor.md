---
editUrl: false
next: false
prev: false
title: "BetterAuthWebhookProcessor"
---

Better Auth 웹훅 서명 검증과 이벤트 분기를 담당하는 처리기입니다.

## Constructors

### Constructor

> **new BetterAuthWebhookProcessor**(`options`, `handlers`, `_sessionProvider`): `BetterAuthWebhookProcessor`

#### Parameters

##### options

[`BetterAuthWebhookOptions`](/api/auth-better-auth/src/type-aliases/betterauthwebhookoptions/)

##### handlers

[`BetterAuthWebhookHandler`](/api/auth-better-auth/src/type-aliases/betterauthwebhookhandler/)

##### \_sessionProvider

[`BetterAuthSessionProvider`](/api/auth-better-auth/src/interfaces/betterauthsessionprovider/)

#### Returns

`BetterAuthWebhookProcessor`

## Methods

### processWebhook()

> **processWebhook**(`request`): `Promise`\<`void`\>

#### Parameters

##### request

###### headers

`Headers`

###### text

() => `Promise`\<`string`\>

#### Returns

`Promise`\<`void`\>
