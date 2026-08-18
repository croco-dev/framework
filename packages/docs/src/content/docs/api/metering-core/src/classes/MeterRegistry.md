---
editUrl: false
next: false
prev: false
title: "MeterRegistry"
---

Meter 정의 레지스트리

## Description

DB에서 Meter 정의를 로드하고 메모리 캐싱합니다.

- 앱 시작 시 모든 Meter 로드
- 런타임에 새 Meter 등록 가능
- 테넌트별 격리된 조회

## Constructors

### Constructor

> **new MeterRegistry**(`repository`, `cacheTtlMs?`, `billableUsageJournal?`): `MeterRegistry`

#### Parameters

##### repository

[`MeterRepository`](/api/metering-core/src/classes/meterrepository/)

##### cacheTtlMs?

`number` = `MeterRegistry.DEFAULT_CACHE_TTL_MS`

##### billableUsageJournal?

[`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/)

#### Returns

`MeterRegistry`

## Properties

### billableUsageJournal?

> `readonly` `optional` **billableUsageJournal?**: [`BillableUsageJournal`](/api/metering-core/src/interfaces/billableusagejournal/)

## Methods

### clearCache()

> **clearCache**(): `void`

캐시 초기화 (테스트용)

#### Returns

`void`

---

### get()

> **get**(`tenantId`, `meterId`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/) \| `null`\>

Meter 조회 (캐시 우선)

#### Parameters

##### tenantId

`string`

##### meterId

`string`

#### Returns

`Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/) \| `null`\>

MeterDefinition 또는 null

---

### getByTenant()

> **getByTenant**(`tenantId`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)[]\>

테넌트별 모든 Meter 조회

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)[]\>

---

### getCachedBillingRequirement()

> **getCachedBillingRequirement**(`tenantId`, `meterId`): `"unknown"` \| `"local"` \| `"required"`

#### Parameters

##### tenantId

`string`

##### meterId

`string`

#### Returns

`"unknown"` \| `"local"` \| `"required"`

---

### getOrThrow()

> **getOrThrow**(`tenantId`, `meterId`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)\>

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

---

### loadAll()

> **loadAll**(): `Promise`\<`void`\>

앱 시작 시 모든 Meter 로드

#### Returns

`Promise`\<`void`\>

---

### register()

> **register**(`options`): `Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)\>

새 Meter 등록

#### Parameters

##### options

[`MeterRegistrationOptions`](/api/metering-core/src/type-aliases/meterregistrationoptions/)

#### Returns

`Promise`\<[`MeterDefinition`](/api/metering-core/src/type-aliases/meterdefinition/)\>
