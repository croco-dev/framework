---
editUrl: false
next: false
prev: false
title: "MeteredOptions"
---

> **MeteredOptions** = `object`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:8](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/metering-core/src/libs/decorators/Metered.ts#L8)

## Properties

### idempotencyKeyExtractor()?

> `optional` **idempotencyKeyExtractor**: (`args`) => `string` \| `undefined`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:11](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/metering-core/src/libs/decorators/Metered.ts#L11)

#### Parameters

##### args

`unknown`[]

#### Returns

`string` \| `undefined`

***

### metadataExtractor()?

> `optional` **metadataExtractor**: (`args`, `result`) => `Record`\<`string`, `unknown`\> \| `undefined`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:12](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/metering-core/src/libs/decorators/Metered.ts#L12)

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

`Record`\<`string`, `unknown`\> \| `undefined`

***

### meterId

> **meterId**: `string`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:9](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/metering-core/src/libs/decorators/Metered.ts#L9)

***

### valueExtractor()?

> `optional` **valueExtractor**: (`args`, `result`) => `number`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:10](https://github.com/croco-dev/shared/blob/eef1ef7ed8202cdfed44941cf281f5eb00e77492/packages/metering-core/src/libs/decorators/Metered.ts#L10)

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

`number`
