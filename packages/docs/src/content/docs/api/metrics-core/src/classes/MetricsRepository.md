---
editUrl: false
next: false
prev: false
title: "MetricsRepository"
---

Repository abstract class for storing and querying metrics data.

## Description

구현체: TimescaleMetricsStore (TimescaleDB) 또는 사용자 커스텀
모든 메서드는 tenant 격리를 보장해야 함

**TimescaleDB Schema (Hypertable)**:
```sql
-- TimescaleDB 확장 활성화
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- MRR 변동 이력 테이블
CREATE TABLE mrr_movements (
  id BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  event_key VARCHAR(255),
  timestamp TIMESTAMPTZ NOT NULL,
  new_mrr_amount BIGINT NOT NULL,
  new_mrr_currency VARCHAR(3) NOT NULL,
  expansion_mrr_amount BIGINT NOT NULL,
  expansion_mrr_currency VARCHAR(3) NOT NULL,
  contraction_mrr_amount BIGINT NOT NULL,
  contraction_mrr_currency VARCHAR(3) NOT NULL,
  churned_mrr_amount BIGINT NOT NULL,
  churned_mrr_currency VARCHAR(3) NOT NULL,
  reactivation_mrr_amount BIGINT NOT NULL,
  reactivation_mrr_currency VARCHAR(3) NOT NULL,
  net_mrr_amount BIGINT NOT NULL,
  net_mrr_currency VARCHAR(3) NOT NULL
);

-- 시간 기반 파티셔닝을 위한 Hypertable 변환
SELECT create_hypertable('mrr_movements', 'timestamp', chunk_time_interval => INTERVAL '1 month');

-- 인덱스 생성
CREATE INDEX idx_mrr_movements_tenant_timestamp ON mrr_movements (tenant_id, timestamp DESC);
CREATE UNIQUE INDEX uq_mrr_movements_tenant_event_key
  ON mrr_movements (tenant_id, event_key)
  WHERE event_key IS NOT NULL;

-- 메트릭 스냅샷 테이블
CREATE TABLE metrics_snapshots (
  id BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  snapshot_date DATE NOT NULL,
  total_mrr_amount BIGINT NOT NULL,
  total_mrr_currency VARCHAR(3) NOT NULL,
  active_customers INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, snapshot_date)
);

-- 시간 기반 파티셔닝을 위한 Hypertable 변환
SELECT create_hypertable('metrics_snapshots', 'snapshot_date', chunk_time_interval => INTERVAL '1 month');

-- 인덱스 생성
CREATE INDEX idx_snapshots_tenant_date ON metrics_snapshots (tenant_id, snapshot_date DESC);
```

## Extended by

- [`TimescaleMetricsStore`](/api/metrics-core/src/classes/timescalemetricsstore/)

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

***

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

***

### getSnapshot()

> `abstract` **getSnapshot**(`tenantId`, `date`): `Promise`\<[`MetricsSnapshot`](/api/metrics-core/src/type-aliases/metricssnapshot/)\>

특정 날짜의 메트릭 스냅샷 조회

#### Parameters

##### tenantId

`string`

테넌트 ID

##### date

`Date`

조회할 날짜

#### Returns

`Promise`\<[`MetricsSnapshot`](/api/metrics-core/src/type-aliases/metricssnapshot/)\>

스냅샷 데이터, 없으면 null

***

### recordMRRMovement()

> `abstract` **recordMRRMovement**(`tenantId`, `movement`, `timestamp`, `eventKey?`): `Promise`\<`void`\>

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

***

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
