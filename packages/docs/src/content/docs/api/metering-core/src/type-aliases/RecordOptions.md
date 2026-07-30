---
editUrl: false
next: false
prev: false
title: "RecordOptions"
---

> **RecordOptions** = `object`

record() 메서드의 호환성 옵션

## Description

새 코드에서는 `defineMeter()`와 typed `record(meter, input)` 경로를 권장합니다.

## Properties

### idempotencyKey?

> `optional` **idempotencyKey?**: `string`

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### meterId

> **meterId**: `string`

***

### tenantId

> **tenantId**: `string`

***

### value?

> `optional` **value?**: `number`

Optional usage amount from 1 through 2_147_483_647. Defaults to 1.
