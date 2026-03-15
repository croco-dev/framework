---
editUrl: false
next: false
prev: false
title: "MeterRegistry"
---

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:14](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/MeterRegistry.ts#L14)

Meter 정의 레지스트리

## Description

DB에서 Meter 정의를 로드하고 메모리 캐싱합니다.
- 앱 시작 시 모든 Meter 로드
- 런타임에 새 Meter 등록 가능
- 테넌트별 격리된 조회

## Constructors

### Constructor

> **new MeterRegistry**(`repository`, `cacheTtlMs?`): `MeterRegistry`

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:23](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/MeterRegistry.ts#L23)

#### Parameters

##### repository

[`MeterRepository`](/api/metering-core/src/interfaces/meterrepository/)

##### cacheTtlMs?

`number` = `MeterRegistry.DEFAULT_CACHE_TTL_MS`

#### Returns

`MeterRegistry`

## Methods

### clearCache()

> **clearCache**(): `void`

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:100](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/MeterRegistry.ts#L100)

캐시 초기화 (테스트용)

#### Returns

`void`

***

### get()

> **get**(`tenantId`, `meterId`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/) \| `null`\>

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:44](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/MeterRegistry.ts#L44)

Meter 조회 (캐시 우선)

#### Parameters

##### tenantId

`string`

##### meterId

`string`

#### Returns

`Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/) \| `null`\>

MeterDefinition 또는 null

***

### getByTenant()

> **getByTenant**(`tenantId`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)[]\>

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:88](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/MeterRegistry.ts#L88)

테넌트별 모든 Meter 조회

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)[]\>

***

### getOrThrow()

> **getOrThrow**(`tenantId`, `meterId`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)\>

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:68](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/MeterRegistry.ts#L68)

Meter 조회 (없으면 throw)

#### Parameters

##### tenantId

`string`

##### meterId

`string`

#### Returns

`Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)\>

#### Throws

InvalidMeterProblem

***

### loadAll()

> **loadAll**(): `Promise`\<`void`\>

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:31](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/MeterRegistry.ts#L31)

앱 시작 시 모든 Meter 로드

#### Returns

`Promise`\<`void`\>

***

### register()

> **register**(`options`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)\>

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:79](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/metering-core/src/libs/MeterRegistry.ts#L79)

새 Meter 등록

#### Parameters

##### options

[`MeterRegistrationOptions`](/api/metering-core/src/type-aliases/meterregistrationoptions/)

#### Returns

`Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)\>
