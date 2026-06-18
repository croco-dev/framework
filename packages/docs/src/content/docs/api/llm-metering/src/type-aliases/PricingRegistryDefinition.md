---
editUrl: false
next: false
prev: false
title: "PricingRegistryDefinition"
---

> **PricingRegistryDefinition** = `object`

버전과 출처를 포함하는 가격 레지스트리 정의입니다.

## Properties

### effectiveDate?

> `optional` **effectiveDate**: `string`

레지스트리 가격이 적용되기 시작하는 날짜입니다.

***

### entries

> **entries**: readonly [`PricingRegistryEntry`](/api/llm-metering/src/interfaces/pricingregistryentry/)[]

provider/model 단위 가격 항목 목록입니다.

***

### notes?

> `optional` **notes**: `string`

운영자가 참고할 추가 설명입니다.

***

### source?

> `optional` **source**: `string`

레지스트리 전체 가격 데이터의 출처입니다.

***

### version

> **version**: `string`

가격 레지스트리 버전입니다.
