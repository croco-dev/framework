---
editUrl: false
next: false
prev: false
title: "AiUsageIngestServiceOptions"
---

> **AiUsageIngestServiceOptions** = `object`

## Properties

### defaultPricing?

> `optional` **defaultPricing?**: `object`

#### currency

> **currency**: `string`

#### inputPricePerToken

> **inputPricePerToken**: `number`

#### outputPricePerToken

> **outputPricePerToken**: `number`

---

### eventBus?

> `optional` **eventBus?**: [`EventBus`](/api/events-core/src/interfaces/eventbus/)

---

### failurePolicy?

> `optional` **failurePolicy?**: [`AiUsageFailurePolicy`](/api/ai-usage/src/type-aliases/aiusagefailurepolicy/)

---

### meteringService

> **meteringService**: [`MeteringService`](/api/metering-core/src/classes/meteringservice/)

---

### pricingTable?

> `optional` **pricingTable?**: [`AiPricingTable`](/api/ai-usage/src/classes/aipricingtable/)

---

### quotaPolicy?

> `optional` **quotaPolicy?**: [`AiUsageQuotaPolicy`](/api/ai-usage/src/interfaces/aiusagequotapolicy/)
