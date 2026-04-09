# @croco/audit-drizzle

`@croco/audit-core`용 Drizzle 감사 로그 저장소입니다.

## 설치

```bash
pnpm add @croco/audit-drizzle @croco/audit-core @croco/tx-core drizzle-orm
```

## 사용법

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';
import { DrizzleAuditLogRepository, auditLogsSqlite } from '@croco/audit-drizzle';

const sqlite = new Database(':memory:');
const db = drizzle(sqlite);

const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: 'join' });

const repository = new DrizzleAuditLogRepository(db, txManager, {
  table: auditLogsSqlite,
  schema: {
    id: auditLogsSqlite.id,
    tenantId: auditLogsSqlite.tenantId,
    actorId: auditLogsSqlite.actorId,
    action: auditLogsSqlite.action,
    resourceType: auditLogsSqlite.resourceType,
    resourceId: auditLogsSqlite.resourceId,
    payload: auditLogsSqlite.payload,
    diff: auditLogsSqlite.diff,
    metadata: auditLogsSqlite.metadata,
    createdAt: auditLogsSqlite.createdAt,
  },
});

const entry = await repository.create({
  tenantId: 'tenant-1',
  actorId: 'user-1',
  action: 'user.update',
  resourceType: 'User',
  resourceId: 'user-1',
  payload: { email: 'user@example.com' },
  diff: { email: { before: 'old@example.com', after: 'user@example.com' } },
  metadata: { requestId: 'req-1' },
});

const logs = await repository.find({ tenantId: 'tenant-1', limit: 10 });
```

SQLite에서는 기본 직렬화기를 그대로 쓰고, PostgreSQL JSONB를 사용할 때는 `serializeJson`, `deserializeJson`을 직접 넘길 수 있습니다.

## API 레퍼런스

### DrizzleAuditLogRepository


- `create(entry)`, 감사 로그를 저장합니다.
- `find(query)`, 테넌트 기준 목록을 조회합니다.
- `findByDateRange(...)`, 기간 범위로 조회합니다.
- `findByActor(...)`, 액터 기준으로 조회합니다.
- `findByResource(...)`, 리소스 기준으로 조회합니다.

### Schema


- `auditLogsPg`, PostgreSQL용 감사 로그 스키마입니다.
- `auditLogsSqlite`, SQLite용 감사 로그 스키마입니다.
- `AuditLogTable`, 저장소 설정에 사용하는 컬럼 매핑 타입입니다.
- `DrizzleAuditLogRepositoryConfig`, 직렬화기와 스키마를 묶는 설정 타입입니다.
