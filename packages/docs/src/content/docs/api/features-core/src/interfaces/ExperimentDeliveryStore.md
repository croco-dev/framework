---
editUrl: false
next: false
prev: false
title: "ExperimentDeliveryStore"
---

Private receipt persistence. Implementations must preserve token uniqueness and immutable decisions.

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

---

### read()

> **read**(`token`): `Promise`\<`Readonly`\<\{ `assignment`: [`ExperimentAssignment`](/api/features-core/src/type-aliases/experimentassignment/); `decision`: [`ExperimentRenderDecision`](/api/features-core/src/type-aliases/experimentrenderdecision/); \}\> \| `undefined`\>

#### Parameters

##### token

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `assignment`: [`ExperimentAssignment`](/api/features-core/src/type-aliases/experimentassignment/); `decision`: [`ExperimentRenderDecision`](/api/features-core/src/type-aliases/experimentrenderdecision/); \}\> \| `undefined`\>
