---
editUrl: false
next: false
prev: false
title: "JourneyTaskBridge"
---

## Constructors

### Constructor

> **new JourneyTaskBridge**(`store`, `engine`, `tasks`): `JourneyTaskBridge`

#### Parameters

##### store

[`JourneyStore`](/api/lifecycle-core/src/interfaces/journeystore/)

##### engine

[`JourneyEngine`](/api/lifecycle-core/src/classes/journeyengine/)

##### tasks

[`JourneyTaskInvoker`](/api/lifecycle-core/src/interfaces/journeytaskinvoker/)

#### Returns

`JourneyTaskBridge`

## Methods

### dispatchDue()

> **dispatchDue**(`scope`, `now`, `limit?`, `leaseMs?`): `Promise`\<`number`\>

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

##### now

`Date`

##### limit?

`number` = `100`

##### leaseMs?

`number` = `30000`

#### Returns

`Promise`\<`number`\>

---

### execute()

> **execute**(`input`): `Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/) \| `undefined`\>

#### Parameters

##### input

###### episodeId

`string`

###### revision

`number`

###### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

#### Returns

`Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/) \| `undefined`\>
