---
editUrl: false
next: false
prev: false
title: "MeteredOptions"
---

> **MeteredOptions** = `object`

문자열 meter ID를 사용하는 기존 `@Metered` 데코레이터 옵션입니다.

## Properties

### billing?

> `optional` **billing?**: `"local"` \| `"required"`

---

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

### valueExtractor?

> `optional` **valueExtractor?**: (`args`, `result`) => `number`

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

`number`
