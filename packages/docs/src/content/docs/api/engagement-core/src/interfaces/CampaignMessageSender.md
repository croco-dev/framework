---
editUrl: false
next: false
prev: false
title: "CampaignMessageSender"
---

## Methods

### send()

> **send**\<`TMessage`\>(`message`, `command`): `Promise`\<[`EngagementSendResult`](/api/engagement-core/src/type-aliases/engagementsendresult/)\>

#### Type Parameters

##### TMessage

`TMessage` _extends_ `Readonly`\<\{ `channels`: readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]; `data`: `ZodTypeAny`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]\>; `id`: `string`; `topic`: `string`; \}\>

#### Parameters

##### message

`TMessage`

##### command

[`EngagementSendCommand`](/api/engagement-core/src/type-aliases/engagementsendcommand/)\<`TMessage`\>

#### Returns

`Promise`\<[`EngagementSendResult`](/api/engagement-core/src/type-aliases/engagementsendresult/)\>
