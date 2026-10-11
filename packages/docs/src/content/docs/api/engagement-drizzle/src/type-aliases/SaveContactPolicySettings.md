---
editUrl: false
next: false
prev: false
title: "SaveContactPolicySettings"
---

> **SaveContactPolicySettings** = `Readonly`\<\{ `actorId`: `string`; `edit`: `Readonly`\<\{ `expectedRevision`: `number`; `idempotencyKey`: `string`; `limits`: `Readonly`\<`Record`\<`string`, `number`\>\>; `priorities`: `Readonly`\<`Record`\<`string`, `number`\>\>; `quietHours?`: [`ContactPolicyConfig`](/api/engagement-core/src/type-aliases/contactpolicyconfig/)\[`"quietHours"`\] \| `null`; `reason`: `string`; \}\>; `expectedRevision`: `number`; `idempotencyKey`: `string`; `policy`: [`ContactPolicySettingsSnapshot`](/api/engagement-drizzle/src/type-aliases/contactpolicysettingssnapshot/); `reason`: `string`; `target`: [`ContactPolicySettingsTarget`](/api/engagement-drizzle/src/type-aliases/contactpolicysettingstarget/); \}\>
