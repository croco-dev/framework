---
editUrl: false
next: false
prev: false
title: "PlanReleaseImpactAnalyzer"
---

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
