---
editUrl: false
next: false
prev: false
title: "JourneyEngineOptions"
---

> **JourneyEngineOptions** = `object`

## Properties

### actions

> **actions**: `Readonly`\<`Record`\<`string`, [`JourneyAction`](/api/lifecycle-core/src/type-aliases/journeyaction/)\>\>

---

### capabilities

> **capabilities**: readonly `string`[]

---

### now?

> `optional` **now?**: () => `Date`

#### Returns

`Date`

---

### predicates

> **predicates**: `Readonly`\<`Record`\<`string`, [`JourneyPredicate`](/api/lifecycle-core/src/type-aliases/journeypredicate/)\>\>

---

### store

> **store**: [`JourneyStore`](/api/lifecycle-core/src/interfaces/journeystore/)

## Methods

### checkLatest()

> **checkLatest**(`context`): `Promise`\<`Omit`\<[`JourneyFacts`](/api/lifecycle-core/src/type-aliases/journeyfacts/), `"goal"`\>\>

#### Parameters

##### context

[`JourneyContext`](/api/lifecycle-core/src/type-aliases/journeycontext/)

#### Returns

`Promise`\<`Omit`\<[`JourneyFacts`](/api/lifecycle-core/src/type-aliases/journeyfacts/), `"goal"`\>\>
