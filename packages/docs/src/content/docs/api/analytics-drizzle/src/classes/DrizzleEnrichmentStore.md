---
editUrl: false
next: false
prev: false
title: "DrizzleEnrichmentStore"
---

PostgreSQL run-local CAS and cross-run immutable input receipts.

## Implements

- `EnrichmentStore`

## Constructors

### Constructor

> **new DrizzleEnrichmentStore**(`db`): `DrizzleEnrichmentStore`

#### Parameters

##### db

[`FactHistoryDatabase`](/api/analytics-drizzle/src/interfaces/facthistorydatabase/)

#### Returns

`DrizzleEnrichmentStore`

## Methods

### compareAndSet()

> **compareAndSet**(`run`, `expectedRevision`): `Promise`\<`boolean`\>

#### Parameters

##### run

`EnrichmentRun`

##### expectedRevision

`number`

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

`EnrichmentStore.compareAndSet`

---

### create()

> **create**(`run`): `Promise`\<`EnrichmentRun`\>

#### Parameters

##### run

`EnrichmentRun`

#### Returns

`Promise`\<`EnrichmentRun`\>

#### Implementation of

`EnrichmentStore.create`

---

### load()

> **load**(`scope`, `runId`): `Promise`\<`EnrichmentRun` \| `null`\>

#### Parameters

##### scope

`EnrichmentScope`

##### runId

`string`

#### Returns

`Promise`\<`EnrichmentRun` \| `null`\>

#### Implementation of

`EnrichmentStore.load`
