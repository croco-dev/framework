---
editUrl: false
next: false
prev: false
title: "createResearchEngagementSender"
---

> **createResearchEngagementSender**\<`TMessage`\>(`engagement`, `message`, `data`): [`ResearchSender`](/api/research-core/src/interfaces/researchsender/)

The application supplies a durable EngagementService with notification idempotency and current preferences.

## Type Parameters

### TMessage

`TMessage` _extends_ `Readonly`\<\{ `channels`: readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]; `data`: `ZodTypeAny`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]\>; `id`: `string`; `topic`: `string`; \}\>

## Parameters

### engagement

[`EngagementService`](/api/engagement-core/src/classes/engagementservice/)

### message

`TMessage`

### data

(`study`, `invitation`) => `Promise`\<[`MessageDataInput`](/api/engagement-core/src/type-aliases/messagedatainput/)\<`TMessage`\>\>

## Returns

[`ResearchSender`](/api/research-core/src/interfaces/researchsender/)
