---
editUrl: false
next: false
prev: false
title: "MeterRepository"
---

Defined in: [packages/metering-core/src/libs/MeterRepository.ts:10](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/MeterRepository.ts#L10)

Meter 정의 및 Usage 데이터를 DB에 저장하는 인터페이스

## Description

구현체는 사용자가 제공 (예: Drizzle, Prisma 등)
metering-core는 이 인터페이스만 의존

## Methods

### findAll()

> **findAll**(): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)[]\>

Defined in: [packages/metering-core/src/libs/MeterRepository.ts:24](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/MeterRepository.ts#L24)

앱 시작 시 모든 meter 로딩

#### Returns

`Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)[]\>

***

### findByMeterIdAndTenant()

> **findByMeterIdAndTenant**(`meterId`, `tenantId`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/) \| `null`\>

Defined in: [packages/metering-core/src/libs/MeterRepository.ts:14](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/MeterRepository.ts#L14)

Meter 정의 조회 (tenantId + meterId로 검색)

#### Parameters

##### meterId

`string`

##### tenantId

`string`

#### Returns

`Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/) \| `null`\>

***

### findByTenant()

> **findByTenant**(`tenantId`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)[]\>

Defined in: [packages/metering-core/src/libs/MeterRepository.ts:29](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/MeterRepository.ts#L29)

테넌트별 meter 조회

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)[]\>

***

### save()

> **save**(`meter`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)\>

Defined in: [packages/metering-core/src/libs/MeterRepository.ts:19](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/MeterRepository.ts#L19)

Meter 정의 등록 (정적 + 동적 모두 사용)

#### Parameters

##### meter

[`MeterRegistrationOptions`](/api/metering-core/src/type-aliases/meterregistrationoptions/)

#### Returns

`Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)\>

***

### saveUsageRecords()

> **saveUsageRecords**(`records`): `Promise`\<`void`\>

Defined in: [packages/metering-core/src/libs/MeterRepository.ts:34](https://github.com/croco-dev/shared/blob/7b5dfb630d061e74d83e139728e0f55e1dfd9dd0/packages/metering-core/src/libs/MeterRepository.ts#L34)

배치 저장용 - Usage 레코드들을 DB에 영구 저장

#### Parameters

##### records

[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)[]

#### Returns

`Promise`\<`void`\>
