---
editUrl: false
next: false
prev: false
title: "InMemoryPlanReleaseStore"
---

Process-local reference store whose outbox is non-durable and intended for tests and local composition.

## Implements

- [`PlanReleaseStore`](/api/billing-core/src/interfaces/planreleasestore/)

## Constructors

### Constructor

> **new InMemoryPlanReleaseStore**(): `InMemoryPlanReleaseStore`

#### Returns

`InMemoryPlanReleaseStore`

## Methods

### create()

> **create**(`release`, `event`): `Promise`\<`void`\>

Atomically creates the draft and appends its lifecycle event to the durable outbox.

#### Parameters

##### release

[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)

##### event

[`PlanReleaseLifecycleEvent`](/api/billing-core/src/type-aliases/planreleaselifecycleevent/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PlanReleaseStore`](/api/billing-core/src/interfaces/planreleasestore/).[`create`](/api/billing-core/src/interfaces/planreleasestore/#create)

---

### get()

> **get**(`ref`): `Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/) \| `null`\>

#### Parameters

##### ref

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### Returns

`Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/) \| `null`\>

#### Implementation of

[`PlanReleaseStore`](/api/billing-core/src/interfaces/planreleasestore/).[`get`](/api/billing-core/src/interfaces/planreleasestore/#get)

---

### list()

> **list**(`planId?`): `Promise`\<readonly [`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)[]\>

#### Parameters

##### planId?

`string`

#### Returns

`Promise`\<readonly [`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)[]\>

#### Implementation of

[`PlanReleaseStore`](/api/billing-core/src/interfaces/planreleasestore/).[`list`](/api/billing-core/src/interfaces/planreleasestore/#list)

---

### listPendingEvents()

> **listPendingEvents**(`ref?`): `Promise`\<readonly [`PlanReleaseLifecycleEvent`](/api/billing-core/src/type-aliases/planreleaselifecycleevent/)[]\>

#### Parameters

##### ref?

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### Returns

`Promise`\<readonly [`PlanReleaseLifecycleEvent`](/api/billing-core/src/type-aliases/planreleaselifecycleevent/)[]\>

#### Implementation of

[`PlanReleaseStore`](/api/billing-core/src/interfaces/planreleasestore/).[`listPendingEvents`](/api/billing-core/src/interfaces/planreleasestore/#listpendingevents)

---

### markEventPublished()

> **markEventPublished**(`eventId`): `Promise`\<`void`\>

#### Parameters

##### eventId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PlanReleaseStore`](/api/billing-core/src/interfaces/planreleasestore/).[`markEventPublished`](/api/billing-core/src/interfaces/planreleasestore/#markeventpublished)

---

### save()

> **save**(`release`, `expectedRevision`, `options?`): `Promise`\<`void`\>

Atomically applies revision CAS, optional family-period exclusion, and optional outbox append.

#### Parameters

##### release

[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)

##### expectedRevision

`number`

##### options?

[`PlanReleaseStoreSaveOptions`](/api/billing-core/src/type-aliases/planreleasestoresaveoptions/) = `{}`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PlanReleaseStore`](/api/billing-core/src/interfaces/planreleasestore/).[`save`](/api/billing-core/src/interfaces/planreleasestore/#save)

---

### withPublicationLock()

> **withPublicationLock**\<`T`\>(`ref`, `operation`): `Promise`\<`T`\>

Serialize publication and cancellation for one ref across all users of this store.
Hold exclusivity until the callback settles; release it on both success and failure.
Durable adapters must coordinate workers, not just instances in one process. A lost
lease must fence the former owner before another callback can perform registry effects.

#### Type Parameters

##### T

`T`

#### Parameters

##### ref

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

##### operation

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

#### Implementation of

[`PlanReleaseStore`](/api/billing-core/src/interfaces/planreleasestore/).[`withPublicationLock`](/api/billing-core/src/interfaces/planreleasestore/#withpublicationlock)
