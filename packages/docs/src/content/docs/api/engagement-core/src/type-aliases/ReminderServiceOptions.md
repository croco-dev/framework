---
editUrl: false
next: false
prev: false
title: "ReminderServiceOptions"
---

> **ReminderServiceOptions** = `Readonly`\<\{ `authorize`: (`access`, `action`) => `Promise`\<`boolean`\>; `clock`: () => `Date`; `resourceState`: (`reminder`) => `Promise`\<`"active"` \| `"completed"` \| `"deleted"`\>; `send`: (`reminder`, `occurrence`) => `Promise`\<[`EngagementSendResult`](/api/engagement-core/src/type-aliases/engagementsendresult/)\>; `store`: [`ReminderStore`](/api/engagement-core/src/interfaces/reminderstore/); `validateInput`: (`access`, `input`) => `Promise`\<`void`\>; \}\>
