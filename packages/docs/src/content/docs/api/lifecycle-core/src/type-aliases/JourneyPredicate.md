---
editUrl: false
next: false
prev: false
title: "JourneyPredicate"
---

> **JourneyPredicate** = `object`

## Methods

### evaluate()

> **evaluate**(`context`, `params`): `Promise`\<`boolean` \| `"unknown"`\>

#### Parameters

##### context

[`JourneyContext`](/api/lifecycle-core/src/type-aliases/journeycontext/)

##### params

`Readonly`\<`Record`\<`string`, `unknown`\>\>

#### Returns

`Promise`\<`boolean` \| `"unknown"`\>

---

### validate()

> **validate**(`params`): `void`

#### Parameters

##### params

`Readonly`\<`Record`\<`string`, `unknown`\>\>

#### Returns

`void`
