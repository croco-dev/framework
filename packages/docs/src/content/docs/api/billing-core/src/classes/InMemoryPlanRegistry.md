---
editUrl: false
next: false
prev: false
title: "InMemoryPlanRegistry"
---

Publish-once in-memory plan registry and branded ref constructor.

## Implements

- [`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/)

## Constructors

### Constructor

> **new InMemoryPlanRegistry**(`definitions?`): `InMemoryPlanRegistry`

#### Parameters

##### definitions?

readonly [`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)[] = `[]`

#### Returns

`InMemoryPlanRegistry`

## Methods

### getAllPlans()

> **getAllPlans**(): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)[]\>

Get all available plans.

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)[]\>

Array of all plans

#### Implementation of

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/).[`getAllPlans`](/api/billing-core/src/interfaces/planregistry/#getallplans)

---

### getPlan()

> **getPlan**(`planId`): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

Get the latest effective published version of a plan.

#### Parameters

##### planId

`string`

The plan identifier

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

The plan or null if not found

#### Implementation of

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/).[`getPlan`](/api/billing-core/src/interfaces/planregistry/#getplan)

---

### getPlanAtDate()

> **getPlanAtDate**(`planId`, `date`): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

Get a plan as it was configured at a specific point in time.
Useful for handling historical pricing (e.g., legacy subscriptions).

#### Parameters

##### planId

`string`

The plan identifier

##### date

`Date`

The date to query historical pricing for

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

The plan at the given date or null if not found

#### Implementation of

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/).[`getPlanAtDate`](/api/billing-core/src/interfaces/planregistry/#getplanatdate)

---

### getPlanVersion()

> **getPlanVersion**(`ref`): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

Resolve an exact version pinned by a subscription.

#### Parameters

##### ref

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`\>

#### Implementation of

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/).[`getPlanVersion`](/api/billing-core/src/interfaces/planregistry/#getplanversion)

---

### publishPlanVersion()

> **publishPlanVersion**(`definition`): `Promise`\<`void`\>

Publish a new immutable version. An existing ref can never be overwritten.

#### Parameters

##### definition

[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/).[`publishPlanVersion`](/api/billing-core/src/interfaces/planregistry/#publishplanversion)

---

### resolveProviderPlanVersion()

> **resolveProviderPlanVersion**(`mapping`): `Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)\>

Resolve a provider product/price identity to exactly one published plan version.
Implementations throw UnknownPlanVersionMappingProblem for missing or ambiguous mappings.

#### Parameters

##### mapping

[`ProviderPlanMapping`](/api/billing-core/src/type-aliases/providerplanmapping/)

#### Returns

`Promise`\<[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)\>

#### Implementation of

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/).[`resolveProviderPlanVersion`](/api/billing-core/src/interfaces/planregistry/#resolveproviderplanversion)
