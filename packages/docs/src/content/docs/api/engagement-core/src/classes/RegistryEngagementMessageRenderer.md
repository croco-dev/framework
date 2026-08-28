---
editUrl: false
next: false
prev: false
title: "RegistryEngagementMessageRenderer"
---

## Implements

- [`EngagementMessageRenderer`](/api/engagement-core/src/interfaces/engagementmessagerenderer/)

## Constructors

### Constructor

> **new RegistryEngagementMessageRenderer**(`registry`, `resolver`): `RegistryEngagementMessageRenderer`

#### Parameters

##### registry

[`MessageRendererRegistry`](/api/engagement-core/src/classes/messagerendererregistry/)

##### resolver

[`MessageRendererResolver`](/api/engagement-core/src/interfaces/messagerendererresolver/)

#### Returns

`RegistryEngagementMessageRenderer`

## Methods

### render()

> **render**\<`TMessage`, `TChannel`\>(`message`, `channel`, `data`): `Promise`\<[`MessageContent`](/api/engagement-core/src/type-aliases/messagecontent/)\<`TChannel`\>\>

#### Type Parameters

##### TMessage

`TMessage` _extends_ `Readonly`\<\{ `channels`: readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]; `data`: `ZodTypeAny`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]\>; `id`: `string`; `topic`: `string`; \}\>

##### TChannel

`TChannel` _extends_ `"email"` \| `"push"` \| `"sms"` \| `"inApp"`

#### Parameters

##### message

`TMessage`

##### channel

`TChannel`

##### data

[`MessageData`](/api/engagement-core/src/type-aliases/messagedata/)\<`TMessage`\>

#### Returns

`Promise`\<[`MessageContent`](/api/engagement-core/src/type-aliases/messagecontent/)\<`TChannel`\>\>

#### Implementation of

[`EngagementMessageRenderer`](/api/engagement-core/src/interfaces/engagementmessagerenderer/).[`render`](/api/engagement-core/src/interfaces/engagementmessagerenderer/#render)
