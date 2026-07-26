---
editUrl: false
next: false
prev: false
title: "InMemoryPlanRegistry"
---

테스트와 로컬 개발에 사용할 수 있는 불변 플랜 버전 레지스트리입니다.

## Implements

- [`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/)

## Constructors

### Constructor

> **new InMemoryPlanRegistry**(): `InMemoryPlanRegistry`

#### Returns

`InMemoryPlanRegistry`

## Methods

### getAllPlans()

> **getAllPlans**(): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)[]\>

Get all currently effective plan versions, one per plan family.

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)[]\>

#### Implementation of

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/).[`getAllPlans`](/api/billing-core/src/interfaces/planregistry/#getallplans)

***

### getAllPlanVersions()

> **getAllPlanVersions**(`planId?`): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)[]\>

Get every published version, including future-effective versions.

#### Parameters

##### planId?

`string`

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)[]\>

#### Implementation of

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/).[`getAllPlanVersions`](/api/billing-core/src/interfaces/planregistry/#getallplanversions)

***

### getPlan()

> **getPlan**(`planId`): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

Get the currently effective version for a plan family.

#### Parameters

##### planId

`string`

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

#### Implementation of

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/).[`getPlan`](/api/billing-core/src/interfaces/planregistry/#getplan)

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

#### Implementation of

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/).[`getPlanAtDate`](/api/billing-core/src/interfaces/planregistry/#getplanatdate)

***

### getPlanVersion()

> **getPlanVersion**(`ref`): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

Get an immutable plan version by its pinned reference.

#### Parameters

##### ref

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

#### Implementation of

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/).[`getPlanVersion`](/api/billing-core/src/interfaces/planregistry/#getplanversion)

***

### publishPlanVersion()

> **publishPlanVersion**(`planVersion`): `Promise`\<`void`\>

Publish a plan version exactly once.

#### Parameters

##### planVersion

[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/).[`publishPlanVersion`](/api/billing-core/src/interfaces/planregistry/#publishplanversion)

***

### resolveProviderPlanVersion()

> **resolveProviderPlanVersion**(`lookup`): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)\>

Resolve provider subscription state to exactly one published plan version.

#### Parameters

##### lookup

[`ProviderPlanLookup`](/api/billing-core/src/type-aliases/providerplanlookup/)

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)\>

#### Implementation of

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/).[`resolveProviderPlanVersion`](/api/billing-core/src/interfaces/planregistry/#resolveproviderplanversion)
