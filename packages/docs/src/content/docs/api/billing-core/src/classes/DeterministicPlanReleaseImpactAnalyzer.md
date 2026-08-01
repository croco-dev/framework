---
editUrl: false
next: false
prev: false
title: "DeterministicPlanReleaseImpactAnalyzer"
---

## Implements

- [`PlanReleaseImpactAnalyzer`](/api/billing-core/src/interfaces/planreleaseimpactanalyzer/)

## Constructors

### Constructor

> **new DeterministicPlanReleaseImpactAnalyzer**(): `DeterministicPlanReleaseImpactAnalyzer`

#### Returns

`DeterministicPlanReleaseImpactAnalyzer`

## Methods

### analyze()

> **analyze**(`input`): `Promise`\<[`PlanReleaseImpactPreview`](/api/billing-core/src/type-aliases/planreleaseimpactpreview/)\>

#### Parameters

##### input

###### audience

`"new_subscriptions"` \| `"grandfathered_subscriptions"` \| \{ `migrationCohortId`: `string`; \}

###### previous

[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/) \| `null`

###### proposed

[`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)

###### validation

[`PlanReleaseValidationEvidence`](/api/billing-core/src/type-aliases/planreleasevalidationevidence/)

#### Returns

`Promise`\<[`PlanReleaseImpactPreview`](/api/billing-core/src/type-aliases/planreleaseimpactpreview/)\>

#### Implementation of

[`PlanReleaseImpactAnalyzer`](/api/billing-core/src/interfaces/planreleaseimpactanalyzer/).[`analyze`](/api/billing-core/src/interfaces/planreleaseimpactanalyzer/#analyze)
