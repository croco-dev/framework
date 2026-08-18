---
editUrl: false
next: false
prev: false
title: "PlanRegistry"
---

Registry interface for publishing and resolving immutable billing plan versions.

## Methods

### getAllPlans()

> **getAllPlans**(): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)[]\>

Get all currently effective plan versions, one per plan family.

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)[]\>

***

### getAllPlanVersions()

> **getAllPlanVersions**(`planId?`): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)[]\>

Get every published version, including future-effective versions.

#### Parameters

##### planId?

`string`

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)[]\>

***

### getPlan()

> **getPlan**(`planId`): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

Get the currently effective version for a plan family.

#### Parameters

##### planId

`string`

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

***

### getPlanAtDate()

> **getPlanAtDate**(`planId`, `date`): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

Get the identified plan version effective at a historical instant.

#### Parameters

##### planId

`string`

##### date

`Date`

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

***

### getPlanVersion()

> **getPlanVersion**(`ref`): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

Get an immutable plan version by its pinned reference.

#### Parameters

##### ref

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

***

### publishPlanVersion()

> **publishPlanVersion**(`planVersion`): `Promise`\<`void`\>

Publish a plan version exactly once.

#### Parameters

##### planVersion

[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)

#### Returns

`Promise`\<`void`\>

***

### resolveProviderPlanVersion()

> **resolveProviderPlanVersion**(`lookup`): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)\>

Resolve provider subscription state to exactly one published plan version.

#### Parameters

##### lookup

[`ProviderPlanLookup`](/api/billing-core/src/type-aliases/providerplanlookup/)

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)\>
