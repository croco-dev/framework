---
editUrl: false
next: false
prev: false
title: "MeteringServiceOptions"
---

> **MeteringServiceOptions** = `object`

MeteringService 생성 옵션 타입입니다.

## Description

MeteringService 인스턴스 생성 시 필요한 의존성들을 정의합니다.

## Properties

### eventBus?

> `optional` **eventBus?**: [`EventBus`](/api/events-core/src/interfaces/eventbus/)

---

### idempotencyManager

> **idempotencyManager**: [`IdempotencyManager`](/api/metering-core/src/classes/idempotencymanager/)

---

### meterRegistry

> **meterRegistry**: [`MeterRegistry`](/api/metering-core/src/classes/meterregistry/)

---

### usageStorage

> **usageStorage**: [`UsageStorage`](/api/metering-core/src/interfaces/usagestorage/)
