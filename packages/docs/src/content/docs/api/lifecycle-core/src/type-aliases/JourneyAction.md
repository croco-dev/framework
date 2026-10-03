---
editUrl: false
next: false
prev: false
title: "JourneyAction"
---

> **JourneyAction** = `object`

## Properties

### capability

> **capability**: `string`

## Methods

### dispatch()

> **dispatch**(`context`, `params`, `intent`): `Promise`\<`"indeterminate"` \| `"accepted"` \| `"rejected"`\>

#### Parameters

##### context

[`JourneyContext`](/api/lifecycle-core/src/type-aliases/journeycontext/)

##### params

`Readonly`\<`Record`\<`string`, `unknown`\>\>

##### intent

[`JourneyActionIntent`](/api/lifecycle-core/src/type-aliases/journeyactionintent/)

#### Returns

`Promise`\<`"indeterminate"` \| `"accepted"` \| `"rejected"`\>

---

### validate()

> **validate**(`params`): `void`

#### Parameters

##### params

`Readonly`\<`Record`\<`string`, `unknown`\>\>

#### Returns

`void`
