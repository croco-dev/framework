---
editUrl: false
next: false
prev: false
title: "PricingTable"
---

기본 가격표와 가격 계산기 구현체입니다.

## Constructors

### Constructor

> **new PricingTable**(`pricing?`): `PricingTable`

#### Parameters

##### pricing?

`Map`\<`string`, `Map`\<`string`, [`ModelPricing`](/api/llm-metering/src/type-aliases/modelpricing/)\>\> = `...`

#### Returns

`PricingTable`

## Methods

### calculateCost()

#### Call Signature

> **calculateCost**(`usage`, `pricing`): `number`

##### Parameters

###### usage

[`LlmUsageRecord`](/api/llm-metering/src/type-aliases/llmusagerecord/)

###### pricing

[`ModelPricing`](/api/llm-metering/src/type-aliases/modelpricing/)

##### Returns

`number`

#### Call Signature

> **calculateCost**(`usage`, `pricing`): `number`

##### Parameters

###### usage

[`LlmEmbeddingUsageRecord`](/api/llm-metering/src/type-aliases/llmembeddingusagerecord/)

###### pricing

[`ModelPricing`](/api/llm-metering/src/type-aliases/modelpricing/)

##### Returns

`number`

***

### getPrice()

> **getPrice**(`provider`, `modelId`): [`ModelPricing`](/api/llm-metering/src/type-aliases/modelpricing/)

#### Parameters

##### provider

`string`

##### modelId

`string`

#### Returns

[`ModelPricing`](/api/llm-metering/src/type-aliases/modelpricing/)

***

### setPrice()

> **setPrice**(`provider`, `modelId`, `pricing`): `void`

#### Parameters

##### provider

`string`

##### modelId

`string`

##### pricing

[`ModelPricing`](/api/llm-metering/src/type-aliases/modelpricing/)

#### Returns

`void`
