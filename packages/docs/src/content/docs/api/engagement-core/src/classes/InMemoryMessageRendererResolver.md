---
editUrl: false
next: false
prev: false
title: "InMemoryMessageRendererResolver"
---

## Implements

- [`MessageRendererResolver`](/api/engagement-core/src/interfaces/messagerendererresolver/)

## Constructors

### Constructor

> **new InMemoryMessageRendererResolver**(): `InMemoryMessageRendererResolver`

#### Returns

`InMemoryMessageRendererResolver`

## Methods

### register()

> **register**\<`TMessage`\>(`message`, `renderer`): `void`

#### Type Parameters

##### TMessage

`TMessage` _extends_ `Readonly`\<\{ `channels`: readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]; `data`: `ZodTypeAny`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]\>; `id`: `string`; `topic`: `string`; \}\>

#### Parameters

##### message

`TMessage`

##### renderer

[`MessageRenderer`](/api/engagement-core/src/type-aliases/messagerenderer/)\<`TMessage`\>

#### Returns

`void`

---

### resolve()

> **resolve**\<`TMessage`\>(`message`): [`MessageRenderer`](/api/engagement-core/src/type-aliases/messagerenderer/)\<`TMessage`\>

#### Type Parameters

##### TMessage

`TMessage` _extends_ `Readonly`\<\{ `channels`: readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]; `data`: `ZodTypeAny`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]\>; `id`: `string`; `topic`: `string`; \}\>

#### Parameters

##### message

`TMessage`

#### Returns

[`MessageRenderer`](/api/engagement-core/src/type-aliases/messagerenderer/)\<`TMessage`\>

#### Implementation of

[`MessageRendererResolver`](/api/engagement-core/src/interfaces/messagerendererresolver/).[`resolve`](/api/engagement-core/src/interfaces/messagerendererresolver/#resolve)
