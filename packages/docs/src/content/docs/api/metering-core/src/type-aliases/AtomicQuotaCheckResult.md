---
editUrl: false
next: false
prev: false
title: "AtomicQuotaCheckResult"
---

> **AtomicQuotaCheckResult** = `object`

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:12](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/UsageStorage.ts#L12)

사용량 저장소의 원자적 quota 체크 계약과 저장소 인터페이스입니다.

## Description

실시간 사용량 저장소의 추상 인터페이스와 원자적 quota 체크 옵션을 정의합니다. Redis 외에도 다른 저장소로 구현할 수 있습니다.

## Properties

### exceeded

> **exceeded**: `boolean`

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:13](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/UsageStorage.ts#L13)

***

### newUsage

> **newUsage**: `number`

Defined in: [packages/metering-core/src/libs/UsageStorage.ts:14](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/UsageStorage.ts#L14)
