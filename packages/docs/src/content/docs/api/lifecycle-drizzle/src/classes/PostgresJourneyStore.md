---
editUrl: false
next: false
prev: false
title: "PostgresJourneyStore"
---

PostgreSQL CAS is the atomic wake/admission fence for the complete episode and its receipts/intents.

## Implements

- [`JourneyStore`](/api/lifecycle-core/src/interfaces/journeystore/)

## Constructors

### Constructor

> **new PostgresJourneyStore**(`database`): `PostgresJourneyStore`

#### Parameters

##### database

[`JourneyPgDatabase`](/api/lifecycle-drizzle/src/interfaces/journeypgdatabase/)

#### Returns

`PostgresJourneyStore`

## Methods

### claimDue()

> **claimDue**(`scope`, `now`, `limit`, `leaseMs`): `Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)[]\>

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

##### now

`string`

##### limit

`number`

##### leaseMs

`number`

#### Returns

`Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)[]\>

#### Implementation of

[`JourneyStore`](/api/lifecycle-core/src/interfaces/journeystore/).[`claimDue`](/api/lifecycle-core/src/interfaces/journeystore/#claimdue)

---

### compareAndSet()

> **compareAndSet**(`scope`, `id`, `expectedRevision`, `next`): `Promise`\<`boolean`\>

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

##### id

`string`

##### expectedRevision

`number`

##### next

[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`JourneyStore`](/api/lifecycle-core/src/interfaces/journeystore/).[`compareAndSet`](/api/lifecycle-core/src/interfaces/journeystore/#compareandset)

---

### create()

> **create**(`episode`): `Promise`\<\{ `created`: `boolean`; `episode`: [`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/); \}\>

#### Parameters

##### episode

[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)

#### Returns

`Promise`\<\{ `created`: `boolean`; `episode`: [`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/); \}\>

#### Implementation of

[`JourneyStore`](/api/lifecycle-core/src/interfaces/journeystore/).[`create`](/api/lifecycle-core/src/interfaces/journeystore/#create)

---

### get()

> **get**(`scope`, `id`): `Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/) \| `undefined`\>

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

##### id

`string`

#### Returns

`Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/) \| `undefined`\>

#### Implementation of

[`JourneyStore`](/api/lifecycle-core/src/interfaces/journeystore/).[`get`](/api/lifecycle-core/src/interfaces/journeystore/#get)

---

### list()

> **list**(`scope`): `Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)[]\>

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

#### Returns

`Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)[]\>

#### Implementation of

[`JourneyStore`](/api/lifecycle-core/src/interfaces/journeystore/).[`list`](/api/lifecycle-core/src/interfaces/journeystore/#list)
