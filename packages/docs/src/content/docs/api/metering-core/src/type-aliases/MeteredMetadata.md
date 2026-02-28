---
editUrl: false
next: false
prev: false
title: "MeteredMetadata"
---

> **MeteredMetadata** = `object`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:15](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/metering-core/src/libs/decorators/Metered.ts#L15)

Metered 메서드 데코레이터의 메타데이터 타입입니다.

## Description

`@Metered` 데코레이터로 메서드에 정의된 자동 기록 옵션의 메타데이터를 나타냅니다.

## Properties

### idempotencyKeyExtractor()?

> `optional` **idempotencyKeyExtractor**: (`args`) => `string` \| `undefined`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:18](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/metering-core/src/libs/decorators/Metered.ts#L18)

#### Parameters

##### args

`unknown`[]

#### Returns

`string` \| `undefined`

***

### metadataExtractor()?

> `optional` **metadataExtractor**: (`args`, `result`) => `Record`\<`string`, `unknown`\> \| `undefined`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:19](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/metering-core/src/libs/decorators/Metered.ts#L19)

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

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:16](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/metering-core/src/libs/decorators/Metered.ts#L16)

***

### valueExtractor()

> **valueExtractor**: (`args`, `result`) => `number`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:17](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/metering-core/src/libs/decorators/Metered.ts#L17)

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

`number`
