---
editUrl: false
next: false
prev: false
title: "ModelPricing"
---

> **ModelPricing** = `object`

모델별 입력/출력 토큰 단가와 가격 메타데이터입니다.

## Extended by

- [`PricingRegistryEntry`](/api/llm-metering/src/interfaces/pricingregistryentry/)

## Properties

### currency

> **currency**: `string`

가격 통화 코드입니다.

***

### effectiveDate?

> `optional` **effectiveDate?**: `string`

가격이 적용되기 시작하는 날짜입니다.

***

### inputPricePerToken

> **inputPricePerToken**: `number`

입력 토큰 하나에 적용되는 단가입니다.

***

### outputPricePerToken

> **outputPricePerToken**: `number`

출력 토큰 하나에 적용되는 단가입니다.

***

### source?

> `optional` **source?**: `string`

가격 데이터의 출처입니다.
