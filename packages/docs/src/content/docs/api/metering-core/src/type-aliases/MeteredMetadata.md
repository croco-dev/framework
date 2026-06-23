---
editUrl: false
next: false
prev: false
title: "MeteredMetadata"
---

> **MeteredMetadata** = `object`

Metered 메서드 데코레이터의 메타데이터 타입입니다.

## Description

`@Metered` 데코레이터로 메서드에 정의된 자동 기록 옵션의 메타데이터를 나타냅니다.

## Properties

### idempotencyKeyExtractor?

> `optional` **idempotencyKeyExtractor?**: (`args`) => `string` \| `undefined`

#### Parameters

##### args

`unknown`[]

#### Returns

`string` \| `undefined`

---

### metadataExtractor?

> `optional` **metadataExtractor?**: (`args`, `result`) => `Record`\<`string`, `unknown`\> \| `undefined`

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

`Record`\<`string`, `unknown`\> \| `undefined`

---

### meterId

> **meterId**: `string`

---

### valueExtractor

> **valueExtractor**: (`args`, `result`) => `number`

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

`number`
