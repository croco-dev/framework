---
editUrl: false
next: false
prev: false
title: "SavedIntentConsoleProps"
---

> **SavedIntentConsoleProps** = `Readonly`\<\{ `canWrite`: `boolean`; `state`: [`SavedIntentAdminState`](/api/admin-core/src/type-aliases/savedintentadminstate/); `targets`: readonly `Readonly`\<\{ `id`: `string`; `label`: `string`; \}\>[]; `onInspect`: `Promise`\<`Readonly`\<\{ `exclusions`: readonly `Readonly`\<\{ `intentId`: `string`; `reason`: `string`; `resourceType`: `string`; \}\>[]; `nextOffset?`: `number`; `rows`: readonly `Readonly`\<\{ `availability`: `"available"` \| `"deleted"` \| `"denied"` \| `"expired"`; `intentId`: `string`; `rankReason`: `"pinned"` \| `"recent"`; `resourceType`: `string`; \}\>[]; \}\>\>; `onReload`: `void`; `onSave`: `Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\>\>; \}\>
