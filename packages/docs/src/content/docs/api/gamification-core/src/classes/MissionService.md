---
editUrl: false
next: false
prev: false
title: "MissionService"
---

## Constructors

### Constructor

> **new MissionService**(`options`): `MissionService`

#### Parameters

##### options

[`MissionServiceOptions`](/api/gamification-core/src/type-aliases/missionserviceoptions/)

#### Returns

`MissionService`

## Methods

### closePeriod()

> **closePeriod**(`command`): `Promise`\<[`MissionProgress`](/api/gamification-core/src/type-aliases/missionprogress/)\>

#### Parameters

##### command

[`MissionCommand`](/api/gamification-core/src/type-aliases/missioncommand/)

#### Returns

`Promise`\<[`MissionProgress`](/api/gamification-core/src/type-aliases/missionprogress/)\>

---

### getProgress()

> **getProgress**(`command`): `Promise`\<[`MissionProgress`](/api/gamification-core/src/type-aliases/missionprogress/)\>

#### Parameters

##### command

[`MissionCommand`](/api/gamification-core/src/type-aliases/missioncommand/)

#### Returns

`Promise`\<[`MissionProgress`](/api/gamification-core/src/type-aliases/missionprogress/)\>

---

### ingestEvidence()

> **ingestEvidence**(`command`): `Promise`\<[`MissionIngestResult`](/api/gamification-core/src/type-aliases/missioningestresult/)\>

#### Parameters

##### command

[`MissionCommand`](/api/gamification-core/src/type-aliases/missioncommand/) & `object`

#### Returns

`Promise`\<[`MissionIngestResult`](/api/gamification-core/src/type-aliases/missioningestresult/)\>

---

### publishDefinition()

> **publishDefinition**(`input`): `Promise`\<[`MissionPublication`](/api/gamification-core/src/type-aliases/missionpublication/)\>

#### Parameters

##### input

###### actor

\{ `id`: `string`; \}

###### actor.id

`string`

###### publication

[`MissionPublication`](/api/gamification-core/src/type-aliases/missionpublication/)

#### Returns

`Promise`\<[`MissionPublication`](/api/gamification-core/src/type-aliases/missionpublication/)\>
