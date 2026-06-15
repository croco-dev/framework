---
editUrl: false
next: false
prev: false
title: "LlmMeteringServiceOptions"
---

> **LlmMeteringServiceOptions** = `object`

LlmMeteringService 입력과 결과에 사용하는 타입입니다.

## Properties

### defaultPricing?

> `optional` **defaultPricing**: `object`

#### currency

> **currency**: `string`

#### inputPricePerToken

> **inputPricePerToken**: `number`

#### outputPricePerToken

> **outputPricePerToken**: `number`

***

### eventBus?

> `optional` **eventBus**: [`EventBus`](/api/events-core/src/interfaces/eventbus/)

***

### meteringService

> **meteringService**: [`MeteringService`](/api/metering-core/src/classes/meteringservice/)

***

### pricingTable?

> `optional` **pricingTable**: [`PricingTable`](/api/llm-metering/src/classes/pricingtable/)
