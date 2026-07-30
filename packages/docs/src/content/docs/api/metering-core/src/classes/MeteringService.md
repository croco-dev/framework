---
editUrl: false
next: false
prev: false
title: "MeteringService"
---

Usage Metering 핵심 서비스

## Description

- record(): 사용량 기록 (핵심 메서드)
- getUsage(): 사용량 조회
- Quota 초과 시 QuotaExceededProblem throw 또는 이벤트 발행

## Constructors

### Constructor

> **new MeteringService**(`options`): `MeteringService`

#### Parameters

##### options

[`MeteringServiceOptions`](/api/metering-core/src/type-aliases/meteringserviceoptions/)

#### Returns

`MeteringService`

## Methods

### getBillableUsageDiagnostics()

> **getBillableUsageDiagnostics**(): `Promise`\<[`BillableUsageJournalDiagnostics`](/api/metering-core/src/type-aliases/billableusagejournaldiagnostics/) \| `null`\>

#### Returns

`Promise`\<[`BillableUsageJournalDiagnostics`](/api/metering-core/src/type-aliases/billableusagejournaldiagnostics/) \| `null`\>

---

### getBillableUsageRequirement()

> **getBillableUsageRequirement**(`tenantId`, `meterId`): `"unknown"` \| `"local"` \| `"required"`

#### Parameters

##### tenantId

`string`

##### meterId

`string`

#### Returns

`"unknown"` \| `"local"` \| `"required"`

---

### getUsage()

> **getUsage**(`options`): `Promise`\<`number`\>

사용량 조회

#### Parameters

##### options

[`UsageQueryOptions`](/api/metering-core/src/type-aliases/usagequeryoptions/)

#### Returns

`Promise`\<`number`\>

---

### record()

#### Call Signature

> **record**\<`Meter`\>(`meter`, `input`): `Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)\>

타입이 지정된 meter 계약에 따라 사용량을 기록합니다.

##### Type Parameters

###### Meter

`Meter` _extends_ [`MeterRef`](/api/metering-core/src/type-aliases/meterref/)

##### Parameters

###### meter

`Meter`

###### input

[`MeterRecordInput`](/api/metering-core/src/type-aliases/meterrecordinput/)\<`Meter`\>

##### Returns

`Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)\>

##### Throws

QuotaExceededProblem quota 초과 시 (allowOverQuota=false)

##### Throws

DuplicateRecordProblem 중복 idempotencyKey 시

##### Throws

InvalidMeterProblem meter 없을 시

##### Throws

InvalidUsageEnvelopeProblem typed usage envelope이 meter 계약과 일치하지 않을 시

##### Throws

InvalidUsageValueProblem value가 1부터 Number.MAX_SAFE_INTEGER까지의 정수가 아닐 시

#### Call Signature

> **record**(`options`): `Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)\>

기존 문자열 meter ID 계약에 따라 사용량을 기록합니다.

##### Parameters

###### options

[`RecordOptions`](/api/metering-core/src/type-aliases/recordoptions/)

##### Returns

`Promise`\<[`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)\>

##### Throws

QuotaExceededProblem quota 초과 시 (allowOverQuota=false)

##### Throws

DuplicateRecordProblem 중복 idempotencyKey 시

##### Throws

InvalidMeterProblem meter 없을 시

##### Throws

InvalidUsageValueProblem value가 1부터 Number.MAX_SAFE_INTEGER까지의 정수가 아닐 시

---

### resolveBillableUsageRequirement()

> **resolveBillableUsageRequirement**(`tenantId`, `meterId`): `Promise`\<`"local"` \| `"required"`\>

#### Parameters

##### tenantId

`string`

##### meterId

`string`

#### Returns

`Promise`\<`"local"` \| `"required"`\>
