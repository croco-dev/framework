# @croco/metering-drizzle

`@croco/metering-core`용 Drizzle 저장소입니다.

## 설치

```bash
pnpm add @croco/metering-drizzle @croco/metering-core @croco/tx-core drizzle-orm
```

## 사용법

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';
import { DrizzleMeterRepository, metersSqlite, usageRecordsSqlite } from '@croco/metering-drizzle';

const sqlite = new Database(':memory:');
const db = drizzle(sqlite);

const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: 'join' });

const repository = new DrizzleMeterRepository(db, txManager, {
  meterTable: metersSqlite,
  meterSchema: {
    id: metersSqlite.id,
    tenantId: metersSqlite.tenantId,
    meterId: metersSqlite.meterId,
    type: metersSqlite.type,
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
  },
});

const meter = await repository.save({
  tenantId: 'tenant-1',
  meterId: 'api_calls',
  type: 'COUNT',
  quota: 10000,
  allowOverQuota: false,
  metadata: { description: 'API calls per month' },
});

await repository.saveUsageRecords([
  {
    id: 'record-1',
    tenantId: 'tenant-1',
    meterId: 'api_calls',
    value: 1,
    timestamp: new Date(),
    idempotencyKey: 'idem-1',
    metadata: { endpoint: '/api/users' },
  },
]);

const found = await repository.findByMeterIdAndTenant('api_calls', 'tenant-1');
const allMeters = await repository.findAll();
const tenantMeters = await repository.findByTenant('tenant-1');
```

PostgreSQL JSONB를 그대로 쓰고 싶다면 `serializeJson`, `deserializeJson`에 패스스루 함수를 넘기면 됩니다.

## API 레퍼런스

### DrizzleMeterRepository


- `findByMeterIdAndTenant(...)`, 단일 미터 정의를 조회합니다.
- `save(meter)`, 미터 정의를 저장합니다.
- `findAll()`, 모든 미터 정의를 조회합니다.
- `findByTenant(tenantId)`, 테넌트별 미터를 조회합니다.
- `saveUsageRecords(records)`, 사용량 기록을 배치 저장합니다.

### Schema


- `metersPg`, `metersSqlite`, 미터 정의 스키마입니다.
- `usageRecordsPg`, `usageRecordsSqlite`, 사용량 기록 스키마입니다.
- `DrizzleMeterRepositoryConfig`, 컬럼 매핑과 직렬화기를 담는 설정 타입입니다.
