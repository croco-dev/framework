---
editUrl: false
next: false
prev: false
title: "MessageRendererResolver"
---

## Methods

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
