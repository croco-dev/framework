---
editUrl: false
next: false
prev: false
title: "MissionStore"
---

## Methods

### getDefinition()

> **getDefinition**(`scope`, `missionId`, `version`): `Promise`\<[`MissionPublication`](/api/gamification-core/src/type-aliases/missionpublication/) \| `undefined`\>

#### Parameters

##### scope

[`MissionScope`](/api/gamification-core/src/type-aliases/missionscope/)

##### missionId

`string`

##### version

`number`

#### Returns

`Promise`\<[`MissionPublication`](/api/gamification-core/src/type-aliases/missionpublication/) \| `undefined`\>

---

### publish()

> **publish**(`publication`): `Promise`\<[`MissionPublication`](/api/gamification-core/src/type-aliases/missionpublication/)\>

Immutable versions; matching idempotency replays, conflicting payload/revision rejects.

#### Parameters

##### publication

[`MissionPublication`](/api/gamification-core/src/type-aliases/missionpublication/)

#### Returns

`Promise`\<[`MissionPublication`](/api/gamification-core/src/type-aliases/missionpublication/)\>

---

### read()

> **read**(`key`): `Promise`\<[`MissionAggregate`](/api/gamification-core/src/type-aliases/missionaggregate/) \| `undefined`\>

#### Parameters

##### key

[`MissionAggregateKey`](/api/gamification-core/src/type-aliases/missionaggregatekey/)

#### Returns

`Promise`\<[`MissionAggregate`](/api/gamification-core/src/type-aliases/missionaggregate/) \| `undefined`\>

---

### transaction()

> **transaction**\<`T`\>(`key`, `operation`): `Promise`\<`T`\>

Serialize per key and atomically persist aggregate, receipts and unique completions. Roll back thrown operations.

#### Type Parameters

##### T

`T`

#### Parameters

##### key

[`MissionAggregateKey`](/api/gamification-core/src/type-aliases/missionaggregatekey/)

##### operation

(`current`) => `object`

#### Returns

`Promise`\<`T`\>
