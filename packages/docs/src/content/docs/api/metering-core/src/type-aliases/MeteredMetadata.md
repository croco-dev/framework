---
editUrl: false
next: false
prev: false
title: "MeteredMetadata"
---

> **MeteredMetadata** = `object`

`@Metered`가 메서드에 저장하는 정규화된 런타임 메타데이터입니다.

## Properties

### billing?

> `optional` **billing?**: `"local"` \| `"required"`

---

### dimensionsExtractor?

> `optional` **dimensionsExtractor?**: (`args`) => `Record`\<`string`, `string` \| `number` \| `boolean`\>

#### Parameters

##### args

`unknown`[]

#### Returns

`Record`\<`string`, `string` \| `number` \| `boolean`\>

---

### eventIdExtractor?

> `optional` **eventIdExtractor?**: (`args`) => `string` \| `undefined`

#### Parameters

##### args

`unknown`[]

#### Returns

`string` \| `undefined`

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

### meter?

> `optional` **meter?**: [`CountMeterRef`](/api/metering-core/src/type-aliases/countmeterref/)

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
