---
editUrl: false
next: false
prev: false
title: "QuotaManager"
---

quota 검증과 기록을 담당하는 관리자입니다.

## Description

Quota 확인 및 사용량 기록을 원자적으로 수행하는 관리자입니다. Redis Lua 스크립트를 사용하여 race condition을 방지합니다.

## Example

```typescript
const manager = new QuotaManager(usageStorage, meterRegistry);

// 원자적 quota 체크 및 기록
const result = await manager.checkAndRecord({
  tenantId: "tenant-123",
  meterId: "api_calls",
  value: 1,
});

if (!result.allowed) {
  throw new QuotaExceededProblem("api_calls", result.quota, result.currentUsage);
}
```

## Constructors

### Constructor

> **new QuotaManager**(`options`): `QuotaManager`

#### Parameters

##### options

[`QuotaManagerOptions`](/api/metering-core/src/type-aliases/quotamanageroptions/)

#### Returns

`QuotaManager`

## Methods

### checkAndRecord()

> **checkAndRecord**(`options`): `Promise`\<[`QuotaCheckAndRecordResult`](/api/metering-core/src/type-aliases/quotacheckandrecordresult/)\>

#### Parameters

##### options

[`QuotaCheckAndRecordOptions`](/api/metering-core/src/type-aliases/quotacheckandrecordoptions/)

#### Returns

`Promise`\<[`QuotaCheckAndRecordResult`](/api/metering-core/src/type-aliases/quotacheckandrecordresult/)\>

---

### validateOrThrow()

> **validateOrThrow**(`options`): `void`

#### Parameters

##### options

###### allowOverQuota

`boolean`

###### exceeded

`boolean`

###### meterId

`string`

###### newUsage

`number`

###### quota

`number`

#### Returns

`void`
