---
editUrl: false
next: false
prev: false
title: "PageExperienceCollection"
---

Server transport binds identity. No browser field can claim scope, subject or committed success.

## Constructors

### Constructor

> **new PageExperienceCollection**(`options`): `PageExperienceCollection`

#### Parameters

##### options

###### allowedOrigins

readonly `string`[]

###### clock

() => `Date`

###### definition

[`PageExperienceDefinition`](/api/metrics-core/src/type-aliases/pageexperiencedefinition/)

###### append

###### authorize

###### verifyReceipt

#### Returns

`PageExperienceCollection`

## Methods

### committed()

> **committed**(`ref`, `context`): `Promise`\<`"unavailable"` \| `"recorded"`\>

Invoke after domain commit (or from the existing outbox). Failure never changes that domain result.

#### Parameters

##### ref

`string`

##### context

[`PageExperienceCollectionContext`](/api/analytics-core/src/type-aliases/pageexperiencecollectioncontext/)

#### Returns

`Promise`\<`"unavailable"` \| `"recorded"`\>

---

### observe()

> **observe**(`payload`, `context`): `Promise`\<`"accepted"` \| `"disabled"`\>

#### Parameters

##### payload

`unknown`

##### context

[`PageExperienceCollectionContext`](/api/analytics-core/src/type-aliases/pageexperiencecollectioncontext/)

#### Returns

`Promise`\<`"accepted"` \| `"disabled"`\>
