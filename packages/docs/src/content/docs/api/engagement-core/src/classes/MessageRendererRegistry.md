---
editUrl: false
next: false
prev: false
title: "MessageRendererRegistry"
---

Typed message contracts and explicit, decorator-bound renderer registration for Croco engagement.

## Constructors

### Constructor

> **new MessageRendererRegistry**(): `MessageRendererRegistry`

#### Returns

`MessageRendererRegistry`

## Methods

### bootstrap()

> **bootstrap**(): `void`

Validates all explicit registrations without constructing renderer classes.

#### Returns

`void`

---

### inspect()

> **inspect**(): [`MessageRegistryInspection`](/api/engagement-core/src/type-aliases/messageregistryinspection/)

#### Returns

[`MessageRegistryInspection`](/api/engagement-core/src/type-aliases/messageregistryinspection/)

---

### parseData()

> **parseData**\<`TMessage`\>(`message`, `input`): [`MessageData`](/api/engagement-core/src/type-aliases/messagedata/)\<`TMessage`\>

#### Type Parameters

##### TMessage

`TMessage` _extends_ `Readonly`\<\{ `channels`: readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]; `data`: `ZodTypeAny`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]\>; `id`: `string`; `topic`: `string`; \}\>

#### Parameters

##### message

`TMessage`

##### input

`unknown`

#### Returns

[`MessageData`](/api/engagement-core/src/type-aliases/messagedata/)\<`TMessage`\>

---

### registerMessage()

> **registerMessage**\<`TMessage`\>(`message`): `void`

#### Type Parameters

##### TMessage

`TMessage` _extends_ `Readonly`\<\{ `channels`: readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]; `data`: `ZodTypeAny`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]\>; `id`: `string`; `topic`: `string`; \}\>

#### Parameters

##### message

`TMessage`

#### Returns

`void`

---

### registerMessages()

> **registerMessages**(`messages`): `void`

#### Parameters

##### messages

readonly `Readonly`\<\{ `channels`: readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]; `data`: `ZodTypeAny`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]\>; `id`: `string`; `topic`: `string`; \}\>[]

#### Returns

`void`

---

### registerRenderer()

> **registerRenderer**(`renderer`): `void`

#### Parameters

##### renderer

[`MessageRendererConstructor`](/api/engagement-core/src/type-aliases/messagerendererconstructor/)

#### Returns

`void`

---

### registerRenderers()

> **registerRenderers**(`renderers`): `void`

#### Parameters

##### renderers

readonly [`MessageRendererConstructor`](/api/engagement-core/src/type-aliases/messagerendererconstructor/)[]

#### Returns

`void`

---

### render()

> **render**\<`TMessage`, `TChannel`\>(`message`, `renderer`, `channel`, `input`): `Promise`\<[`MessageContent`](/api/engagement-core/src/type-aliases/messagecontent/)\<`TChannel`\>\>

Parses untrusted data before invoking an explicitly registered renderer instance.

#### Type Parameters

##### TMessage

`TMessage` _extends_ `Readonly`\<\{ `channels`: readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]; `data`: `ZodTypeAny`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]\>; `id`: `string`; `topic`: `string`; \}\>

##### TChannel

`TChannel` _extends_ `"email"` \| `"push"` \| `"sms"` \| `"inApp"`

#### Parameters

##### message

`TMessage`

##### renderer

[`MessageRenderer`](/api/engagement-core/src/type-aliases/messagerenderer/)\<`TMessage`\>

##### channel

`TChannel`

##### input

`unknown`

#### Returns

`Promise`\<[`MessageContent`](/api/engagement-core/src/type-aliases/messagecontent/)\<`TChannel`\>\>
