---
editUrl: false
next: false
prev: false
title: "TimescaleMetricsStore"
---

TimescaleDB 기반 MetricsRepository 구현체

## Description

- TimescaleDB Hypertable에 MRR 변동 이력과 스냅샷 저장
- recordSnapshot은 upsert (ON CONFLICT UPDATE) 사용
- getRetentionMetrics은 스냅샷과 변동 이력을 집계하여 계산

**참고**: 실제 구현 시 쿼리 로직을 완성해야 합니다.
이 파일은 인터페이스와 스켈레톤만 제공합니다.

## Extends

- [`MetricsRepository`](/api/metrics-core/src/classes/metricsrepository/)

## Constructors

### Constructor

> **new TimescaleMetricsStore**(`db`): `TimescaleMetricsStore`

#### Parameters

##### db

[`PostgresClient`](/api/metrics-core/src/interfaces/postgresclient/)

#### Returns

`TimescaleMetricsStore`

#### Overrides

[`MetricsRepository`](/api/metrics-core/src/classes/metricsrepository/).[`constructor`](/api/metrics-core/src/classes/metricsrepository/#constructor)

## Methods

### getMRRHistory()

> **getMRRHistory**(`tenantId`, `period`): `Promise`\<[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)[]\>

MRR 변동 이력 조회

#### Parameters

##### tenantId

`string`

테넌트 ID

##### period

[`Period`](/api/metrics-core/src/type-aliases/period/)

조회 기간

#### Returns

`Promise`\<[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)[]\>

MRR 변동 데이터 배열

#### Overrides

[`MetricsRepository`](/api/metrics-core/src/classes/metricsrepository/).[`getMRRHistory`](/api/metrics-core/src/classes/metricsrepository/#getmrrhistory)

***

### getRetentionMetrics()

> **getRetentionMetrics**(`tenantId`, `period`): `Promise`\<[`RetentionMetrics`](/api/metrics-core/src/type-aliases/retentionmetrics/)\>

리텐션 메트릭 계산

#### Parameters

##### tenantId

`string`

테넌트 ID

##### period

[`Period`](/api/metrics-core/src/type-aliases/period/)

계산 기간

#### Returns

`Promise`\<[`RetentionMetrics`](/api/metrics-core/src/type-aliases/retentionmetrics/)\>

리텐션 메트릭 (GRR, NRR, Churn Rate 등)

#### Overrides

[`MetricsRepository`](/api/metrics-core/src/classes/metricsrepository/).[`getRetentionMetrics`](/api/metrics-core/src/classes/metricsrepository/#getretentionmetrics)

***

### getSnapshot()

> **getSnapshot**(`tenantId`, `date`): `Promise`\<[`MetricsSnapshot`](/api/metrics-core/src/type-aliases/metricssnapshot/) \| `null`\>

특정 날짜의 메트릭 스냅샷 조회

#### Parameters

##### tenantId

`string`

테넌트 ID

##### date

`Date`

조회할 날짜

#### Returns

`Promise`\<[`MetricsSnapshot`](/api/metrics-core/src/type-aliases/metricssnapshot/) \| `null`\>

스냅샷 데이터, 없으면 null

#### Overrides

[`MetricsRepository`](/api/metrics-core/src/classes/metricsrepository/).[`getSnapshot`](/api/metrics-core/src/classes/metricsrepository/#getsnapshot)

***

### recordMRRMovement()

> **recordMRRMovement**(`tenantId`, `movement`, `timestamp`, `eventKey?`): `Promise`\<`void`\>

MRR 변동 이력 기록

#### Parameters

##### tenantId

`string`

테넌트 ID

##### movement

[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)

MRR 변동 데이터

##### timestamp

`Date`

변동 발생 시각

##### eventKey?

`string`

이벤트 기반 멱등성 키 (선택)

#### Returns

`Promise`\<`void`\>

#### Overrides

[`MetricsRepository`](/api/metrics-core/src/classes/metricsrepository/).[`recordMRRMovement`](/api/metrics-core/src/classes/metricsrepository/#recordmrrmovement)

***

### recordSnapshot()

> **recordSnapshot**(`tenantId`, `snapshot`, `date`): `Promise`\<`void`\>

메트릭 스냅샷 기록 (Upsert)

#### Parameters

##### tenantId

`string`

테넌트 ID

##### snapshot

[`MetricsSnapshot`](/api/metrics-core/src/type-aliases/metricssnapshot/)

스냅샷 데이터

##### date

`Date`

스냅샷 날짜

#### Returns

`Promise`\<`void`\>

#### Overrides

[`MetricsRepository`](/api/metrics-core/src/classes/metricsrepository/).[`recordSnapshot`](/api/metrics-core/src/classes/metricsrepository/#recordsnapshot)
