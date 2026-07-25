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

### rating

> `readonly` **rating**: [`PlanRatingDefinition`](/api/billing-core/src/type-aliases/planratingdefinition/)

***

### ref

> `readonly` **ref**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

***

### versionId

> `readonly` **versionId**: `string`
