---
editUrl: false
next: false
prev: false
title: "CampaignDefinitionInput"
---

> **CampaignDefinitionInput**\<`TId`, `TVersion`, `TAudience`, `TMessage`\> = `Readonly`\<\{ `audience`: `TAudience`; `id`: `TId`; `map`: (`member`) => [`EngagementSendCommand`](/api/engagement-core/src/type-aliases/engagementsendcommand/)\<`TMessage`\>; `message`: `TMessage`; `version`: `NonEmptyStringLiteral`\<`TVersion`\>; \}\>

## Type Parameters

### TId

`TId` _extends_ `string`

### TVersion

`TVersion` _extends_ `string`

### TAudience

`TAudience` _extends_ [`AudienceConstructor`](/api/engagement-core/src/type-aliases/audienceconstructor/)

### TMessage

`TMessage` _extends_ [`AnyMessage`](/api/engagement-core/src/type-aliases/anymessage/)
