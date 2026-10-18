---
editUrl: false
next: false
prev: false
title: "InMemoryExperimentDeliveryStore"
---

Local reference sink only; replicas/restarts require an application-owned shared receipt store.

## Implements

- [`ExperimentDeliveryStore`](/api/features-core/src/interfaces/experimentdeliverystore/)

## Constructors

### Constructor

> **new InMemoryExperimentDeliveryStore**(): `InMemoryExperimentDeliveryStore`

#### Returns

`InMemoryExperimentDeliveryStore`

## Methods

### create()

> **create**(`token`, `receipt`): `Promise`\<`void`\>

#### Parameters

##### token

`string`

##### receipt

[`ExperimentDeliveryReceipt`](/api/features-core/src/type-aliases/experimentdeliveryreceipt/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ExperimentDeliveryStore`](/api/features-core/src/interfaces/experimentdeliverystore/).[`create`](/api/features-core/src/interfaces/experimentdeliverystore/#create)

---

### read()

> **read**(`token`): `Promise`\<`Readonly`\<\{ `assignment`: [`ExperimentAssignment`](/api/features-core/src/type-aliases/experimentassignment/); `decision`: [`ExperimentRenderDecision`](/api/features-core/src/type-aliases/experimentrenderdecision/); \}\> \| `undefined`\>

#### Parameters

##### token

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `assignment`: [`ExperimentAssignment`](/api/features-core/src/type-aliases/experimentassignment/); `decision`: [`ExperimentRenderDecision`](/api/features-core/src/type-aliases/experimentrenderdecision/); \}\> \| `undefined`\>

#### Implementation of

[`ExperimentDeliveryStore`](/api/features-core/src/interfaces/experimentdeliverystore/).[`read`](/api/features-core/src/interfaces/experimentdeliverystore/#read)
