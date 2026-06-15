---
editUrl: false
next: false
prev: false
title: "SnapshotScheduler"
---

주기적 메트릭 스냅샷 캡처를 담당하는 스케줄러입니다.

## Constructors

### Constructor

> **new SnapshotScheduler**(`metricsRepository`, `mrrCalculator?`): `SnapshotScheduler`

#### Parameters

##### metricsRepository

[`MetricsRepository`](/api/metrics-core/src/classes/metricsrepository/)

##### mrrCalculator?

[`MrrCalculator`](/api/metrics-core/src/classes/mrrcalculator/) = `...`

#### Returns

`SnapshotScheduler`

## Methods

### captureSnapshot()

> **captureSnapshot**(`input`, `date?`, `config?`): `Promise`\<`void`\>

#### Parameters

##### input

[`SnapshotInput`](/api/metrics-core/src/type-aliases/snapshotinput/)

##### date?

`Date` = `...`

##### config?

[`SnapshotSchedulerConfig`](/api/metrics-core/src/type-aliases/snapshotschedulerconfig/)

#### Returns

`Promise`\<`void`\>
