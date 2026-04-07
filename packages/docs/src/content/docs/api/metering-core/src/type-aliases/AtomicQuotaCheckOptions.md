---
editUrl: false
next: false
prev: false
title: "AtomicQuotaCheckOptions"
---

> **AtomicQuotaCheckOptions** = `object`

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:3](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/UsageStorage.ts#L3)

사용량 저장소의 원자적 quota 체크 계약과 저장소 인터페이스입니다.

## Description

실시간 사용량 저장소의 추상 인터페이스와 원자적 quota 체크 옵션을 정의합니다. Redis 외에도 다른 저장소로 구현할 수 있습니다.

## Properties

### allowOverQuota

> **allowOverQuota**: `boolean`

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:8](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/UsageStorage.ts#L8)

***

### meterId

> **meterId**: `string`

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:5](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/UsageStorage.ts#L5)

***

### quota

> **quota**: `number`

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:7](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/UsageStorage.ts#L7)

***

### tenantId

> **tenantId**: `string`

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:4](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/UsageStorage.ts#L4)

***

### usageRecord

> **usageRecord**: [`UsageRecord`](/api/metering-core/src/type-aliases/usagerecord/)

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:9](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/UsageStorage.ts#L9)

***

### value

> **value**: `number`

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:6](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/UsageStorage.ts#L6)
