---
editUrl: false
next: false
prev: false
title: "Renders"
---

> **Renders**\<`TMessage`\>(`message`): `ClassDecorator`

Records the message-to-class binding without mutating a DI container or constructing the class.

## Type Parameters

### TMessage

`TMessage` _extends_ `Readonly`\<\{ `channels`: readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]; `data`: `ZodTypeAny`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]\>; `id`: `string`; `topic`: `string`; \}\>

## Parameters

### message

`TMessage`

## Returns

`ClassDecorator`
