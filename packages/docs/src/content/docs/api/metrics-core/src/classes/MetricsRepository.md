---
editUrl: false
next: false
prev: false
title: "MetricsRepository"
---

Repository abstract class for storing and querying metrics data.

## Description

모든 구현체는 tenant 격리와 멱등적 movement 기록을 보장해야 합니다. 구체적인
database client, schema, migration, SQL은 provider package가 소유합니다.

## Extended by

- [`PostgresMetricsStore`](/api/warehouse-postgres/src/metrics/classes/postgresmetricsstore/)

## Constructors

### Constructor

> **new MetricsRepository**(): `MetricsRepository`

#### Returns

`MetricsRepository`

## Methods

### getMRRHistory()

> `abstract` **getMRRHistory**(`tenantId`, `period`): `Promise`\<[`MRRMovement`](/api/metrics-core/src/type-aliases/mrrmovement/)[]\>

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

---

### getRetentionMetrics()

> `abstract` **getRetentionMetrics**(`tenantId`, `period`): `Promise`\<[`RetentionMetrics`](/api/metrics-core/src/type-aliases/retentionmetrics/)\>

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

---

### getSnapshot()

> `abstract` **getSnapshot**(`tenantId`, `date`): `Promise`\<[`MetricsSnapshot`](/api/metrics-core/src/type-aliases/metricssnapshot/) \| `null`\>

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

---

### recordMRRMovement()

> `abstract` **recordMRRMovement**(`tenantId`, `movement`, `timestamp`, `eventKey?`, `dedupeEventKeys?`): `Promise`\<`void`\>

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

##### dedupeEventKeys?

readonly `string`[]

이전 버전이나 외부 시스템에서 이미 저장했을 수 있는 호환 멱등성 키

#### Returns

`Promise`\<`void`\>

---

### recordSnapshot()

> `abstract` **recordSnapshot**(`tenantId`, `snapshot`, `date`): `Promise`\<`void`\>

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
