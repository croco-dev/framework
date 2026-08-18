---
editUrl: false
next: false
prev: false
title: "MeteredRefOptions"
---

> **MeteredRefOptions**\<`Meter`\> = `object` & `MeteredDimensionsExtractor`\<`Meter`\> & `MeteredEventExtractor`\<`Meter`\>

타입이 지정된 count meter 계약을 사용하는 `@Metered` 데코레이터 옵션입니다.

## Type Declaration

### metadataExtractor?

> `optional` **metadataExtractor?**: (`args`, `result`) => `Record`\<`string`, `unknown`\> \| `undefined`

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

`Record`\<`string`, `unknown`\> \| `undefined`

### meter

> **meter**: `Meter`

## Type Parameters

### Meter

`Meter` *extends* [`CountMeterRef`](/api/metering-core/src/type-aliases/countmeterref/)
