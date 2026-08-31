---
editUrl: false
next: false
prev: false
title: "StoreBackedRecipientDirectory"
---

Combines an application-owned recipient directory with durable endpoint state.

## Implements

- [`RecipientDirectory`](/api/engagement-core/src/interfaces/recipientdirectory/)

## Constructors

### Constructor

> **new StoreBackedRecipientDirectory**(`recipients`, `endpoints`, `pushTokens`): `StoreBackedRecipientDirectory`

#### Parameters

##### recipients

[`RecipientDirectory`](/api/engagement-core/src/interfaces/recipientdirectory/)

##### endpoints

[`ContactEndpointStore`](/api/engagement-core/src/interfaces/contactendpointstore/)

##### pushTokens

[`PushTokenResolver`](/api/engagement-core/src/interfaces/pushtokenresolver/)

#### Returns

`StoreBackedRecipientDirectory`

## Methods

### resolve()

> **resolve**(`ref`): `Promise`\<`Readonly`\<\{ `email?`: `Readonly`\<\{ `address`: `string`; `id`: `string`; `version?`: `number`; \}\>; `emails?`: readonly `Readonly`\<\{ `address`: `string`; `id`: `string`; `version?`: `number`; \}\>[]; `locale?`: `string`; `push`: readonly `Readonly`\<\{ `app?`: `string`; `environment?`: `string`; `id`: `string`; `lastSeenAt?`: `Date`; `platform?`: `string`; `provider?`: `string`; `token`: `string`; `version?`: `number`; \}\>[]; `recipient`: [`RecipientRef`](/api/engagement-core/src/type-aliases/recipientref/); `timezone?`: `string`; \}\> \| `undefined`\>

#### Parameters

##### ref

[`RecipientRef`](/api/engagement-core/src/type-aliases/recipientref/)

#### Returns

`Promise`\<`Readonly`\<\{ `email?`: `Readonly`\<\{ `address`: `string`; `id`: `string`; `version?`: `number`; \}\>; `emails?`: readonly `Readonly`\<\{ `address`: `string`; `id`: `string`; `version?`: `number`; \}\>[]; `locale?`: `string`; `push`: readonly `Readonly`\<\{ `app?`: `string`; `environment?`: `string`; `id`: `string`; `lastSeenAt?`: `Date`; `platform?`: `string`; `provider?`: `string`; `token`: `string`; `version?`: `number`; \}\>[]; `recipient`: [`RecipientRef`](/api/engagement-core/src/type-aliases/recipientref/); `timezone?`: `string`; \}\> \| `undefined`\>

#### Implementation of

[`RecipientDirectory`](/api/engagement-core/src/interfaces/recipientdirectory/).[`resolve`](/api/engagement-core/src/interfaces/recipientdirectory/#resolve)
