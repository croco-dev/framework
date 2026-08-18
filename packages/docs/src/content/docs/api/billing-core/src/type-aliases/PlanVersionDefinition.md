---
editUrl: false
next: false
prev: false
title: "PlanVersionDefinition"
---

> **PlanVersionDefinition** = `object`

billing account, invoice, order, plan, subscription 도메인 타입입니다.

## Properties

### amount

> `readonly` **amount**: `number`

***

### currency

> `readonly` **currency**: `string`

***

### effectiveAt

> `readonly` **effectiveAt**: `string`

***

### effectiveUntil?

> `readonly` `optional` **effectiveUntil?**: `string`

***

### entitlements?

> `readonly` `optional` **entitlements?**: readonly [`PlanEntitlementDefinition`](/api/billing-core/src/type-aliases/planentitlementdefinition/)[]

***

### interval

> `readonly` **interval**: [`PlanInterval`](/api/billing-core/src/type-aliases/planinterval/)

***

### intervalCount

> `readonly` **intervalCount**: `number`

***

### name

> `readonly` **name**: `string`

***

### planId

> `readonly` **planId**: `string`

***

### providerBindings

> `readonly` **providerBindings**: readonly [`ProviderPlanBinding`](/api/billing-core/src/type-aliases/providerplanbinding/)[]

***

### quantityPolicy

> `readonly` **quantityPolicy**: [`SubscriptionQuantityPolicy`](/api/billing-core/src/type-aliases/subscriptionquantitypolicy/)

***

### rating

> `readonly` **rating**: [`PlanRatingDefinition`](/api/billing-core/src/type-aliases/planratingdefinition/)

***

### ref

> `readonly` **ref**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

***

### seatUnitAmount?

> `readonly` `optional` **seatUnitAmount?**: `number`

***

### trial?

> `readonly` `optional` **trial?**: [`PlanTrialDefinition`](/api/billing-core/src/type-aliases/plantrialdefinition/)

***

### usageTiers?

> `readonly` `optional` **usageTiers?**: readonly [`PlanUsageTier`](/api/billing-core/src/type-aliases/planusagetier/)[]

***

### versionId

> `readonly` **versionId**: `string`
