---
editUrl: false
next: false
prev: false
title: "AiPricingTable"
---

## Constructors

### Constructor

> **new AiPricingTable**(`pricing?`, `options?`): `AiPricingTable`

#### Parameters

##### pricing?

`Map`\<`string`, `Map`\<`string`, [`ModelPricing`](/api/ai-usage/src/type-aliases/modelpricing/)\>\> = `...`

##### options?

###### effectiveDate?

`string`

###### notes?

`string`

###### source?

`string`

###### version?

`string`

#### Returns

`AiPricingTable`

## Properties

### effectiveDate?

> `readonly` `optional` **effectiveDate?**: `string`

---

### notes?

> `readonly` `optional` **notes?**: `string`

---

### source?

> `readonly` `optional` **source?**: `string`

---

### version

> `readonly` **version**: `string`

## Methods

### calculateCost()

#### Call Signature

> **calculateCost**(`usage`, `pricing`): `number`

##### Parameters

###### usage

[`AiUsageRecord`](/api/ai-usage/src/type-aliases/aiusagerecord/)

###### pricing

[`ModelPricing`](/api/ai-usage/src/type-aliases/modelpricing/)

##### Returns

`number`

#### Call Signature

> **calculateCost**(`usage`, `pricing`): `number`

##### Parameters

###### usage

[`AiEmbeddingUsageRecord`](/api/ai-usage/src/type-aliases/aiembeddingusagerecord/)

###### pricing

[`ModelPricing`](/api/ai-usage/src/type-aliases/modelpricing/)

##### Returns

`number`

---

### getPrice()

> **getPrice**(`provider`, `modelId`): [`ModelPricing`](/api/ai-usage/src/type-aliases/modelpricing/) \| `null`

#### Parameters

##### provider

`string`

##### modelId

`string`

#### Returns

[`ModelPricing`](/api/ai-usage/src/type-aliases/modelpricing/) \| `null`

---

### setPrice()

> **setPrice**(`provider`, `modelId`, `pricing`): `void`

#### Parameters

##### provider

`string`

##### modelId

`string`

##### pricing

[`ModelPricing`](/api/ai-usage/src/type-aliases/modelpricing/)

#### Returns

`void`

---

### toRegistry()

> **toRegistry**(): [`PricingRegistryDefinition`](/api/ai-usage/src/type-aliases/pricingregistrydefinition/)

#### Returns

[`PricingRegistryDefinition`](/api/ai-usage/src/type-aliases/pricingregistrydefinition/)

---

### fromRegistry()

> `static` **fromRegistry**(`registry`): `AiPricingTable`

#### Parameters

##### registry

[`PricingRegistryDefinition`](/api/ai-usage/src/type-aliases/pricingregistrydefinition/)

#### Returns

`AiPricingTable`
