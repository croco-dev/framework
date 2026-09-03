---
editUrl: false
next: false
prev: false
title: "defineCampaign"
---

> **defineCampaign**\<`TId`, `TVersion`, `TAudience`, `TMessage`, `TCommand`\>(`input`): [`DefinedCampaign`](/api/engagement-core/src/type-aliases/definedcampaign/)\<`TId`, `TVersion`, `TAudience`, `TMessage`\>

Typed message contracts and explicit, decorator-bound renderer registration for Croco engagement.

## Type Parameters

### TId

`TId` _extends_ `string`

### TVersion

`TVersion` _extends_ `string`

### TAudience

`TAudience` _extends_ [`AudienceConstructor`](/api/engagement-core/src/type-aliases/audienceconstructor/)\<`unknown`\>

### TMessage

`TMessage` _extends_ `Readonly`\<\{ `channels`: readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]; `data`: `ZodTypeAny`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]\>; `id`: `string`; `topic`: `string`; \}\>

### TCommand

`TCommand` _extends_ `Readonly`\<\{ `data`: [`MessageDataInput`](/api/engagement-core/src/type-aliases/messagedatainput/)\<`TMessage`\>; `key`: `string`; `policy?`: [`EngagementDeliveryPolicy`](/api/engagement-core/src/type-aliases/engagementdeliverypolicy/); `recipient`: [`RecipientRef`](/api/engagement-core/src/type-aliases/recipientref/); \}\>

## Parameters

### input

`Omit`\<`Readonly`\<\{ `audience`: `TAudience`; `id`: `TId`; `map`: (`member`) => [`EngagementSendCommand`](/api/engagement-core/src/type-aliases/engagementsendcommand/)\<`TMessage`\>; `message`: `TMessage`; `version`: `NonEmptyStringLiteral`\<`TVersion`\>; \}\>, `"map"`\> & `Readonly`\<\{ `map`: (`member`) => `ExactCampaignCommand`\<`TMessage`, `TCommand`\>; \}\>

## Returns

[`DefinedCampaign`](/api/engagement-core/src/type-aliases/definedcampaign/)\<`TId`, `TVersion`, `TAudience`, `TMessage`\>
