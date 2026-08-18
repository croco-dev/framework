---
editUrl: false
next: false
prev: false
title: "PricingRegistryEntry"
---

가격 레지스트리에 저장되는 모델 단가 항목입니다.

## Extends

- [`ModelPricing`](/api/llm-metering/src/type-aliases/modelpricing/)

## Properties

### currency

> **currency**: `string`

가격 통화 코드입니다.

#### Inherited from

`ModelPricing.currency`

---

### effectiveDate?

> `optional` **effectiveDate?**: `string`

가격이 적용되기 시작하는 날짜입니다.

#### Inherited from

`ModelPricing.effectiveDate`

---

### inputPricePerToken

> **inputPricePerToken**: `number`

입력 토큰 하나에 적용되는 단가입니다.

#### Inherited from

`ModelPricing.inputPricePerToken`

---

### modelId

> **modelId**: `string`

제공자 안에서 사용하는 모델 식별자입니다.

---

### outputPricePerToken

> **outputPricePerToken**: `number`

출력 토큰 하나에 적용되는 단가입니다.

#### Inherited from

`ModelPricing.outputPricePerToken`

---

### provider

> **provider**: `string`

LLM 제공자 식별자입니다.

---

### source?

> `optional` **source?**: `string`

가격 데이터의 출처입니다.

#### Inherited from

`ModelPricing.source`
