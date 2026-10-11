---
editUrl: false
next: false
prev: false
title: "createReminderEngagementSender"
---

> **createReminderEngagementSender**(`engagement`, `bindings`): (`reminder`, `occurrence`) => `Promise`\<[`EngagementSendResult`](/api/engagement-core/src/type-aliases/engagementsendresult/)\>

Uses the existing recipient/preference/notification path; each binding has one declared channel.

## Parameters

### engagement

[`EngagementService`](/api/engagement-core/src/classes/engagementservice/)

### bindings

readonly `Readonly`\<\{ `message`: `TMessage`; `data`: `Promise`\<`any`\>; \}\>[]

## Returns

(`reminder`, `occurrence`) => `Promise`\<[`EngagementSendResult`](/api/engagement-core/src/type-aliases/engagementsendresult/)\>
