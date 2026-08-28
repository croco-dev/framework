---
editUrl: false
next: false
prev: false
title: "InMemoryRecipientDirectory"
---

## Implements

- [`RecipientDirectory`](/api/engagement-core/src/interfaces/recipientdirectory/)

## Constructors

### Constructor

> **new InMemoryRecipientDirectory**(`recipients?`): `InMemoryRecipientDirectory`

#### Parameters

##### recipients?

readonly `Readonly`\<\{ `email?`: `Readonly`\<\{ `address`: `string`; `id`: `string`; \}\>; `locale?`: `string`; `push`: readonly `Readonly`\<\{ `id`: `string`; `token`: `string`; \}\>[]; `recipient`: [`RecipientRef`](/api/engagement-core/src/type-aliases/recipientref/); `timezone?`: `string`; \}\>[] = `[]`

#### Returns

`InMemoryRecipientDirectory`

## Methods

### delete()

> **delete**(`ref`): `boolean`

#### Parameters

##### ref

[`RecipientRef`](/api/engagement-core/src/type-aliases/recipientref/)

#### Returns

`boolean`

---

### resolve()

> **resolve**(`ref`): `Promise`\<`Readonly`\<\{ `email?`: `Readonly`\<\{ `address`: `string`; `id`: `string`; \}\>; `locale?`: `string`; `push`: readonly `Readonly`\<\{ `id`: `string`; `token`: `string`; \}\>[]; `recipient`: [`RecipientRef`](/api/engagement-core/src/type-aliases/recipientref/); `timezone?`: `string`; \}\> \| `undefined`\>

#### Parameters

##### ref

[`RecipientRef`](/api/engagement-core/src/type-aliases/recipientref/)

#### Returns

`Promise`\<`Readonly`\<\{ `email?`: `Readonly`\<\{ `address`: `string`; `id`: `string`; \}\>; `locale?`: `string`; `push`: readonly `Readonly`\<\{ `id`: `string`; `token`: `string`; \}\>[]; `recipient`: [`RecipientRef`](/api/engagement-core/src/type-aliases/recipientref/); `timezone?`: `string`; \}\> \| `undefined`\>

#### Implementation of

[`RecipientDirectory`](/api/engagement-core/src/interfaces/recipientdirectory/).[`resolve`](/api/engagement-core/src/interfaces/recipientdirectory/#resolve)

---

### set()

> **set**(`recipient`): `void`

#### Parameters

##### recipient

[`ResolvedRecipient`](/api/engagement-core/src/type-aliases/resolvedrecipient/)

#### Returns

`void`
