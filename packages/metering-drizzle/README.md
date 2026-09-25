# @croco/metering-drizzle

`@croco/metering-core`용 Drizzle 저장소입니다.

## 설치

```bash
pnpm add @croco/metering-drizzle @croco/metering-core @croco/tx-core drizzle-orm
```

## 사용법

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { DrizzleMeterRepository, metersSqlite, usageRecordsSqlite } from "@croco/metering-drizzle";

const sqlite = new Database(":memory:");
const db = drizzle(sqlite);

const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: "join" });

const repository = new DrizzleMeterRepository(db, txManager, {
  meterTable: metersSqlite,
  meterSchema: {
    id: metersSqlite.id,
    tenantId: metersSqlite.tenantId,
    meterId: metersSqlite.meterId,
    type: metersSqlite.type,
    billing: metersSqlite.billing,
    aggregation: metersSqlite.aggregation,
    unit: metersSqlite.unit,
    quota: metersSqlite.quota,
    allowOverQuota: metersSqlite.allowOverQuota,
    metadata: metersSqlite.metadata,
    createdAt: metersSqlite.createdAt,
    updatedAt: metersSqlite.updatedAt,
  },
  usageRecordTable: usageRecordsSqlite,
  usageRecordSchema: {
    id: usageRecordsSqlite.id,
    tenantId: usageRecordsSqlite.tenantId,
    meterId: usageRecordsSqlite.meterId,
    value: usageRecordsSqlite.value,
    recordedAt: usageRecordsSqlite.recordedAt,
    metadata: usageRecordsSqlite.metadata,
    idempotencyKey: usageRecordsSqlite.idempotencyKey,
    eventId: usageRecordsSqlite.eventId,
    dimensions: usageRecordsSqlite.dimensions,
  },
});

const meter = await repository.save({
  tenantId: "tenant-1",
  meterId: "api_calls",
  type: "COUNT",
  billing: "required",
  aggregation: "COUNT",
  unit: "request",
  quota: 10000,
  allowOverQuota: false,
  metadata: { description: "API calls per month" },
});

await repository.saveUsageRecords([
  {
    id: "record-1",
    tenantId: "tenant-1",
    meterId: "api_calls",
    value: 1,
    timestamp: new Date(),
    idempotencyKey: "idem-1",
    metadata: { endpoint: "/api/users" },
  },
]);

const found = await repository.findByMeterIdAndTenant("api_calls", "tenant-1");
const allMeters = await repository.findAll();
const tenantMeters = await repository.findByTenant("tenant-1");
```

Node PostgreSQL 클라이언트도 SQLite cast 없이 같은 저장소에 전달할 수 있습니다. 이 경로에서는 애플리케이션에
`pg` 드라이버를 함께 설치합니다.

```typescript
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { DrizzleMeterRepository, metersPg, usageRecordsPg } from "@croco/metering-drizzle";

const pgDb = drizzlePostgres("postgresql://user:password@localhost:5432/app");
const pgTxManager = new TxManager(createDrizzleTxAdapter(pgDb), { defaultNesting: "join" });
const pgRepository = new DrizzleMeterRepository(pgDb, pgTxManager, {
  meterTable: metersPg,
  meterSchema: metersPg,
  usageRecordTable: usageRecordsPg,
  usageRecordSchema: usageRecordsPg,
});
```

기존 테이블을 업그레이드할 때는 사용하는 dialect에 맞는 migration을 실행한 뒤 새 column mapping을
설정합니다.

```ts
import type { SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import {
  addMeterDefinitionFieldsSqlite,
  addUsageEnvelopeFieldsSqlite,
  type MeteringMigrationClient,
} from "@croco/metering-drizzle";

const migrationDialect = new SQLiteSyncDialect();
const migrationClient = {
  async execute(query: unknown) {
    const rendered = migrationDialect.sqlToQuery(query as SQL);
    const statement = sqlite.prepare(rendered.sql);
    return statement.reader ? statement.all(...rendered.params) : statement.run(...rendered.params);
  },
} satisfies MeteringMigrationClient;

await addMeterDefinitionFieldsSqlite(migrationClient);
await addUsageEnvelopeFieldsSqlite(migrationClient);
```

SQLite migration client의 `execute`는 `PRAGMA`와 `SELECT`가 반환한 행을 돌려줘야 합니다. 행 대신 실행 결과를
돌려주는 client는 `metering-drizzle/migration-query-result-unsupported`로 실패합니다.

PostgreSQL을 사용하는 경우에는 대신 `addMeterDefinitionFieldsPostgres(postgresClient)`와
`addUsageEnvelopeFieldsPostgres(postgresClient)`를 실행합니다.

`addMeterDefinitionFields*`는 `meters`에 `billing`(기본값 `local`), `aggregation`, `unit` 컬럼과
`meters_tenant_meter_unique` `(tenant_id, meter_id)` unique index를 추가합니다. 같은 `(tenant_id, meter_id)` 행이 이미
여러 개 있으면 행을 삭제하지 않고 `DuplicateMeterDefinitionsProblem`(`metering-drizzle/duplicate-meter-definitions`)으로
중복 목록을 보고하며, `transaction`을 제공한 client에서는 추가한 컬럼도 롤백됩니다. 남길 정의를 정한 뒤 나머지 행을
정리하고 다시 실행하세요. 중복이 많으면 오류 detail에는 앞의 20개만 표시되고 전체 목록은 `extensions.duplicates`에
있습니다.

`save`는 이 index를 conflict target으로 쓰므로, 커스텀 테이블에도 같은 unique index가 필요하고 마이그레이션은
새 버전 배포 전에 완료해야 합니다. 마이그레이션 전에 새 버전이 시작되면 `save`와 조회가 `billing` 컬럼이 없다는
DB 오류로 실패하고, index를 만든 뒤 이전 버전이 같은 meter를 다시 등록하면 unique 제약 위반으로 실패합니다.
마이그레이션 전에 저장된 행의 `billing`은 `local`이 되므로, `billing: "required"` meter는 마이그레이션 후 다시
등록해야 합니다. 앱 시작 때마다 `MeterRegistry.register`를 호출하는 구성은 다음 시작에서 복구됩니다.

safe-integer usage 또는 고정 소수점 quota를 사용하려면 `widenMeteringIntegersPostgres(postgresClient)`도
실행해 `usage_records.value`와 `meters.quota`를 `BIGINT`로 확장합니다.
기존 UUID 기반 `usage_records.id`가 있는 배포는 `widenUsageRecordIdsPostgres(postgresClient)`를 실행해
기존 UUID 값을 보존하면서 metering operation ID를 저장할 수 있는 `TEXT` 컬럼으로 확장합니다.
기존 PostgreSQL 배포에서는 애플리케이션 롤아웃 전에 이 마이그레이션을 완료해야 하며, 롤링 배포 중에는
마이그레이션 완료 전 새 버전의 writer를 시작하지 않습니다.

`save`는 같은 `(tenantId, meterId)`의 저장된 정의 하나를 이번 등록값 전체로 갱신합니다. 생략한 `quota`,
`aggregation`, `unit`, `metadata`는 비워지고 `billing`은 `local`, `allowOverQuota`는 `false`가 되며, `id`와
`createdAt`은 처음 값을 유지합니다. 앱을 시작할 때마다 `MeterRegistry.register`를 호출해도 행이 늘어나지 않고,
재시작 후 `loadAll`은 마지막 등록값의 `billing`·`aggregation`·`unit`을 복원합니다. `billing`이 `local`·`required`가
아니거나, `aggregation`이 `COUNT`·`SUM`이 아니거나, `unit`이 문자열이 아니면 저장 전 입력과 저장된 행 모두
`InvalidMeterDefinitionProblem`(`metering-drizzle/invalid-meter-definition`)으로 실패합니다.

`meterTable`의 컬럼 property 이름은 `MeterTable` 키와 같아야 합니다. meter 정의를 읽고 쓸 때는 `meterSchema`
매핑이 아니라 이 이름을 사용합니다.

typed usage에 `eventId` 또는 `dimensions`가 있지만 해당 mapping이 없으면
`UsageEnvelopeConfigurationProblem`으로 기록을 거부하며, billing field를 조용히 버리지 않습니다.

PostgreSQL JSONB를 그대로 쓰고 싶다면 `serializeJson`, `deserializeJson`에 패스스루 함수를 넘기면 됩니다.

`DrizzleMeterRepository`는 `replayContract: "idempotent"`를 선언합니다. 배치가 겹치거나
`UsageAggregator`의 저장 후 원본 삭제가 실패해 재시도하더라도
`(tenantId, meterId, idempotencyKey)`별 최초 기록만 저장합니다. 커스텀 테이블에도 제공 스키마와 같은
unique index가 필요합니다. 삭제가 실패하면 flush는 실패하며, 새 aggregator 인스턴스에서 재시도해도
이미 저장된 사용량은 중복 반영되지 않습니다.

PostgreSQL 스키마는 `UsageRecord.id`를 `TEXT`로 보존하고 timestamp 컬럼에는 `Date`를 전달합니다.
SQLite 스키마는 기존 호환성을 위해 내부 정수 row ID를 계속 자동 생성하며 timestamp는 epoch millisecond
정수로 저장합니다. 두 dialect 모두 replay 중복 방지는 `idempotencyKey` 계약을 따릅니다.

## API 레퍼런스

### DrizzleMeterRepository

- `findByMeterIdAndTenant(...)`, 단일 미터 정의를 조회합니다.
- `save(meter)`, 미터 정의를 `(tenantId, meterId)` 기준으로 저장하거나 갱신합니다.
- `findAll()`, 모든 미터 정의를 조회합니다.
- `findByTenant(tenantId)`, 테넌트별 미터를 조회합니다.
- `saveUsageRecords(records)`, 사용량 기록을 배치 저장합니다.

### Schema

- `metersPg`, `metersSqlite`, 미터 정의 스키마입니다.
- `usageRecordsPg`, `usageRecordsSqlite`, 사용량 기록 스키마입니다.
- `DrizzleMeterRepositoryConfig`, 컬럼 매핑과 직렬화기를 담는 설정 타입입니다.
