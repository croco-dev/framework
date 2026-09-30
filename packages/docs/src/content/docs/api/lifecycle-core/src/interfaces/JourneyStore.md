---
editUrl: false
next: false
prev: false
title: "JourneyStore"
---

Implementations must isolate scope, uniquely create reentryKey, and atomically CAS the complete episode.

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

---

### create()

> **create**(`episode`): `Promise`\<\{ `created`: `boolean`; `episode`: [`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/); \}\>

#### Parameters

##### episode

[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)

#### Returns

`Promise`\<\{ `created`: `boolean`; `episode`: [`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/); \}\>

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

---

### list()

> **list**(`scope`): `Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)[]\>

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

#### Returns

`Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)[]\>
