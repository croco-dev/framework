---
editUrl: false
next: false
prev: false
title: "ExperimentDeliveryBridge"
---

## Constructors

### Constructor

> **new ExperimentDeliveryBridge**(`options`): `ExperimentDeliveryBridge`

#### Parameters

##### options

[`ExperimentDeliveryOptions`](/api/features-core/src/type-aliases/experimentdeliveryoptions/)

#### Returns

`ExperimentDeliveryBridge`

## Methods

### admit()

> **admit**(`token`, `identity`, `signal?`): `Promise`\<`Readonly`\<\{ `deliveryId`: `string`; `experimentRevision`: `string`; `phase`: `"admitted"` \| `"speculative"`; `policyRevision`: `string`; `receipt?`: `string`; `region`: `string`; `status`: `"assigned"` \| `"fallback"`; `validUntil`: `string`; `value?`: `string` \| `number` \| `boolean`; `variant?`: `string`; \}\>\>

Consume prefetch at the current authenticated scope; never choose another variant.

#### Parameters

##### token

`string`

##### identity

[`ExperimentDeliveryIdentity`](/api/features-core/src/type-aliases/experimentdeliveryidentity/)

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`Readonly`\<\{ `deliveryId`: `string`; `experimentRevision`: `string`; `phase`: `"admitted"` \| `"speculative"`; `policyRevision`: `string`; `receipt?`: `string`; `region`: `string`; `status`: `"assigned"` \| `"fallback"`; `validUntil`: `string`; `value?`: `string` \| `number` \| `boolean`; `variant?`: `string`; \}\>\>

---

### expose()

> **expose**(`token`, `identity`, `displayInstanceId`, `occurredAt`): `Promise`\<[`ExperimentExposure`](/api/features-core/src/type-aliases/experimentexposure/)\>

Historical reports resolve the original assignment, even after pause, expiry or publication rollback.

#### Parameters

##### token

`string`

##### identity

[`ExperimentDeliveryIdentity`](/api/features-core/src/type-aliases/experimentdeliveryidentity/)

##### displayInstanceId

`string`

##### occurredAt

`string`

#### Returns

`Promise`\<[`ExperimentExposure`](/api/features-core/src/type-aliases/experimentexposure/)\>

---

### getInspectionFailureCount()

> **getInspectionFailureCount**(): `number`

Synchronous inspector sink failures remain observable without changing business/render outcomes.

#### Returns

`number`

---

### prepare()

> **prepare**(`regionIds`, `identity`, `phase`, `signal?`): `Promise`\<readonly `Readonly`\<\{ `deliveryId`: `string`; `experimentRevision`: `string`; `phase`: `"admitted"` \| `"speculative"`; `policyRevision`: `string`; `receipt?`: `string`; `region`: `string`; `status`: `"assigned"` \| `"fallback"`; `validUntil`: `string`; `value?`: `string` \| `number` \| `boolean`; `variant?`: `string`; \}\>[]\>

Evaluate only the regions the route declares. Prefetch creates no display admission/exposure.

#### Parameters

##### regionIds

readonly `string`[]

##### identity

[`ExperimentDeliveryIdentity`](/api/features-core/src/type-aliases/experimentdeliveryidentity/)

##### phase

`"admitted"` \| `"speculative"`

##### signal?

`AbortSignal`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `deliveryId`: `string`; `experimentRevision`: `string`; `phase`: `"admitted"` \| `"speculative"`; `policyRevision`: `string`; `receipt?`: `string`; `region`: `string`; `status`: `"assigned"` \| `"fallback"`; `validUntil`: `string`; `value?`: `string` \| `number` \| `boolean`; `variant?`: `string`; \}\>[]\>

---

### render()

> **render**(`regionIds`, `identity`, `request`, `render`, `phase?`): `Promise`\<`Response`\>

Private request envelope for HTML/Flight. Render callbacks must use only the supplied frozen decisions.

#### Parameters

##### regionIds

readonly `string`[]

##### identity

[`ExperimentDeliveryIdentity`](/api/features-core/src/type-aliases/experimentdeliveryidentity/)

##### request

`Request`

##### render

(`decisions`) => `Promise`\<`Response`\>

##### phase?

`"admitted"` \| `"speculative"`

#### Returns

`Promise`\<`Response`\>
