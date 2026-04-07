---
editUrl: false
next: false
prev: false
title: "MeteredMetadata"
---

> **MeteredMetadata** = `object`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:16](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/decorators/Metered.ts#L16)

Metered 메서드 데코레이터의 메타데이터 타입입니다.

## Description

`@Metered` 데코레이터로 메서드에 정의된 자동 기록 옵션의 메타데이터를 나타냅니다.

## Properties

### idempotencyKeyExtractor()?

> `optional` **idempotencyKeyExtractor**: (`args`) => `string` \| `undefined`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:19](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/decorators/Metered.ts#L19)

#### Parameters

##### args

`unknown`[]

#### Returns

`string` \| `undefined`

***

### metadataExtractor()?

> `optional` **metadataExtractor**: (`args`, `result`) => `Record`\<`string`, `unknown`\> \| `undefined`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:20](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/decorators/Metered.ts#L20)

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

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:17](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/decorators/Metered.ts#L17)

***

### valueExtractor()

> **valueExtractor**: (`args`, `result`) => `number`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:18](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/decorators/Metered.ts#L18)

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

`number`
