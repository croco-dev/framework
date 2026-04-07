---
editUrl: false
next: false
prev: false
title: "MeteringServiceOptions"
---

> **MeteringServiceOptions** = `object`

Defined in: [packages/metering-core/src/libs/MeteringService.ts:12](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/MeteringService.ts#L12)

MeteringService 생성 옵션 타입입니다.

## Description

MeteringService 인스턴스 생성 시 필요한 의존성들을 정의합니다.

## Properties

### eventBus?

> `optional` **eventBus**: [`EventBus`](/api/events-core/src/interfaces/eventbus/)

Defined in: [packages/metering-core/src/libs/MeteringService.ts:16](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/MeteringService.ts#L16)

***

### idempotencyManager

> **idempotencyManager**: [`IdempotencyManager`](/api/metering-core/src/classes/idempotencymanager/)

Defined in: [packages/metering-core/src/libs/MeteringService.ts:15](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/MeteringService.ts#L15)

***

### meterRegistry

> **meterRegistry**: [`MeterRegistry`](/api/metering-core/src/classes/meterregistry/)

Defined in: [packages/metering-core/src/libs/MeteringService.ts:13](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/MeteringService.ts#L13)

***

### usageStorage

> **usageStorage**: [`UsageStorage`](/api/metering-core/src/interfaces/usagestorage/)

Defined in: [packages/metering-core/src/libs/MeteringService.ts:14](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/MeteringService.ts#L14)
