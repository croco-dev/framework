---
editUrl: false
next: false
prev: false
title: "DefinedCampaign"
---

> **DefinedCampaign**\<`TId`, `TVersion`, `TAudience`, `TMessage`\> = `Readonly`\<\{ `audience`: `TAudience`; `descriptor`: [`CampaignDescriptor`](/api/engagement-core/src/type-aliases/campaigndescriptor/)\<`TVersion`\>; `id`: `TId`; `map`: (`member`) => [`EngagementSendCommand`](/api/engagement-core/src/type-aliases/engagementsendcommand/)\<`TMessage`\>; `message`: `TMessage`; `version`: `TVersion`; \}\>

## Type Parameters

### TId

`TId` _extends_ `string` = `string`

### TVersion

`TVersion` _extends_ `string` = `string`

### TAudience

`TAudience` _extends_ [`AudienceConstructor`](/api/engagement-core/src/type-aliases/audienceconstructor/) = [`AudienceConstructor`](/api/engagement-core/src/type-aliases/audienceconstructor/)

### TMessage

`TMessage` _extends_ [`AnyMessage`](/api/engagement-core/src/type-aliases/anymessage/) = [`AnyMessage`](/api/engagement-core/src/type-aliases/anymessage/)
