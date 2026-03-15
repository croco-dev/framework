---
editUrl: false
next: false
prev: false
title: "MeteredOptions"
---

> **MeteredOptions** = `object`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:9](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/decorators/Metered.ts#L9)

Metered 메서드 데코레이터의 메타데이터 타입입니다.

## Description

`@Metered` 데코레이터로 메서드에 정의된 자동 기록 옵션의 메타데이터를 나타냅니다.

## Properties

### idempotencyKeyExtractor()?

> `optional` **idempotencyKeyExtractor**: (`args`) => `string` \| `undefined`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:12](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/decorators/Metered.ts#L12)

#### Parameters

##### args

`unknown`[]

#### Returns

`string` \| `undefined`

***

### metadataExtractor()?

> `optional` **metadataExtractor**: (`args`, `result`) => `Record`\<`string`, `unknown`\> \| `undefined`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:13](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/decorators/Metered.ts#L13)

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

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:10](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/decorators/Metered.ts#L10)

***

### valueExtractor()?

> `optional` **valueExtractor**: (`args`, `result`) => `number`

Defined in: [packages/metering-core/src/libs/decorators/Metered.ts:11](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/decorators/Metered.ts#L11)

#### Parameters

##### args

`unknown`[]

##### result

`unknown`

#### Returns

`number`
