---
editUrl: false
next: false
prev: false
title: "QuotaManager"
---

Defined in: [packages/metering-core/src/libs/QuotaManager.ts:24](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/metering-core/src/libs/QuotaManager.ts#L24)

quota 검증과 기록을 담당하는 관리자입니다.

## Description

Quota 확인 및 사용량 기록을 원자적으로 수행하는 관리자입니다. Redis Lua 스크립트를 사용하여 race condition을 방지합니다.

## Example

```typescript
const manager = new QuotaManager(usageStorage, meterRegistry);

// 원자적 quota 체크 및 기록
const result = await manager.checkAndRecord({
  tenantId: 'tenant-123',
  meterId: 'api_calls',
  value: 1,
});

if (!result.allowed) {
  throw new QuotaExceededProblem('api_calls', result.quota, result.currentUsage);
}

console.log(`현재 사용량: ${result.currentUsage}/${result.quota}`);
```

## Constructors

### Constructor

> **new QuotaManager**(`options`): `QuotaManager`

Defined in: [packages/metering-core/src/libs/QuotaManager.ts:27](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/metering-core/src/libs/QuotaManager.ts#L27)

#### Parameters

##### options

[`QuotaManagerOptions`](/api/metering-core/src/type-aliases/quotamanageroptions/)

#### Returns

`QuotaManager`

## Methods

### checkAndRecord()

> **checkAndRecord**(`options`): `Promise`\<[`QuotaCheckAndRecordResult`](/api/metering-core/src/type-aliases/quotacheckandrecordresult/)\>

Defined in: [packages/metering-core/src/libs/QuotaManager.ts:31](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/metering-core/src/libs/QuotaManager.ts#L31)

#### Parameters

##### options

[`QuotaCheckAndRecordOptions`](/api/metering-core/src/type-aliases/quotacheckandrecordoptions/)

#### Returns

`Promise`\<[`QuotaCheckAndRecordResult`](/api/metering-core/src/type-aliases/quotacheckandrecordresult/)\>

***

### validateOrThrow()

> **validateOrThrow**(`options`): `void`

Defined in: [packages/metering-core/src/libs/QuotaManager.ts:47](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/metering-core/src/libs/QuotaManager.ts#L47)

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
