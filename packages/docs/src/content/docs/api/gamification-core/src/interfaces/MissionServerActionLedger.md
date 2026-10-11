---
editUrl: false
next: false
prev: false
title: "MissionServerActionLedger"
---

Implement against the server's durable domain-action ledger, never a client request body.

## Methods

### find()

> **find**(`input`): `Promise`\<[`MissionServerActionReceipt`](/api/gamification-core/src/type-aliases/missionserveractionreceipt/) \| `undefined`\>

#### Parameters

##### input

###### eventId

`string`

###### scope

[`MissionScope`](/api/gamification-core/src/type-aliases/missionscope/)

###### subjectId

`string`

#### Returns

`Promise`\<[`MissionServerActionReceipt`](/api/gamification-core/src/type-aliases/missionserveractionreceipt/) \| `undefined`\>
