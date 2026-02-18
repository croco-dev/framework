---
editUrl: false
next: false
prev: false
title: "MeterRegistry"
---

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:14](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/metering-core/src/libs/MeterRegistry.ts#L14)

Meter 정의 레지스트리

## Description

DB에서 Meter 정의를 로드하고 메모리 캐싱합니다.
- 앱 시작 시 모든 Meter 로드
- 런타임에 새 Meter 등록 가능
- 테넌트별 격리된 조회

## Constructors

### Constructor

> **new MeterRegistry**(`repository`): `MeterRegistry`

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:20](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/metering-core/src/libs/MeterRegistry.ts#L20)

#### Parameters

##### repository

[`MeterRepository`](/api/metering-core/src/interfaces/meterrepository/)

#### Returns

`MeterRegistry`

## Methods

### clearCache()

> **clearCache**(): `void`

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:94](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/metering-core/src/libs/MeterRegistry.ts#L94)

캐시 초기화 (테스트용)

#### Returns

`void`

***

### get()

> **get**(`tenantId`, `meterId`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/) \| `null`\>

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:38](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/metering-core/src/libs/MeterRegistry.ts#L38)

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

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:78](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/metering-core/src/libs/MeterRegistry.ts#L78)

테넌트별 모든 Meter 조회

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)[]\>

***

### getOrThrow()

> **getOrThrow**(`tenantId`, `meterId`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)\>

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:58](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/metering-core/src/libs/MeterRegistry.ts#L58)

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

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:25](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/metering-core/src/libs/MeterRegistry.ts#L25)

앱 시작 시 모든 Meter 로드

#### Returns

`Promise`\<`void`\>

***

### register()

> **register**(`options`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)\>

Defined in: [packages/metering-core/src/libs/MeterRegistry.ts:69](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/metering-core/src/libs/MeterRegistry.ts#L69)

새 Meter 등록

#### Parameters

##### options

[`MeterRegistrationOptions`](/api/metering-core/src/type-aliases/meterregistrationoptions/)

#### Returns

`Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)\>
