# @croco/audit-drizzle

Drizzle ORM 기반 감사 로그 저장소 구현체입니다. SQLite와 PostgreSQL을 지원합니다.

## 설치

```bash
pnpm add @croco/audit-drizzle @croco/audit-core @croco/tx-core drizzle-orm
```

## 사용법

### 1. SQLite (개발/테스트용)

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

// 감사 로그 생성
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

// 조회
const logs = await repository.find({ tenantId: 'tenant-1', limit: 10 });
```

### 2. PostgreSQL (프로덕션용)

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { TxManager } from '@croco/tx-core';
import { createDrizzleTxAdapter } from '@croco/tx-drizzle';
import { DrizzleAuditLogRepository, auditLogsPg } from '@croco/audit-drizzle';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: 'join' });

const repository = new DrizzleAuditLogRepository(db, txManager, {
  table: auditLogsPg,
  schema: {
    id: auditLogsPg.id,
    tenantId: auditLogsPg.tenantId,
    actorId: auditLogsPg.actorId,
    action: auditLogsPg.action,
    resourceType: auditLogsPg.resourceType,
    resourceId: auditLogsPg.resourceId,
    payload: auditLogsPg.payload,
    diff: auditLogsPg.diff,
    metadata: auditLogsPg.metadata,
    createdAt: auditLogsPg.createdAt,
  },
  // PostgreSQL은 JSONB를 사용하므로 직렬화/역직렬화 생략 가능
  serializeJson: (v) => v,
  deserializeJson: (v) => v,
});
```

### 3. DI 컨테이너에서 사용

```typescript
import { Container, Component, Inject } from '@croco/framework-context';
import { AUDIT_LOG_REPOSITORY_TOKEN } from '@croco/audit-core';
import { DrizzleAuditLogRepository, auditLogsSqlite } from '@croco/audit-drizzle';

const DRIZZLE_DB_TOKEN = 'DRIZZLE_DB_TOKEN';
const TX_MANAGER_TOKEN = 'TX_MANAGER_TOKEN';

// 등록
Container.set(AUDIT_LOG_REPOSITORY_TOKEN, {
  factory: () => {
    const db = Container.get(DRIZZLE_DB_TOKEN);
    const txManager = Container.get(TX_MANAGER_TOKEN);
    return new DrizzleAuditLogRepository(db, txManager, {
      table: auditLogsSqlite,
      schema: { /* ... */ },
    });
  },
});

// 사용
@Component()
class UserService {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY_TOKEN) private auditRepo: DrizzleAuditLogRepository
  ) {}

  async updateUser(id: string, data: UpdateUserDto) {
    // 비즈니스 로직
    await this.auditRepo.create({
      tenantId: 'tenant-1',
      actorId: 'user-1',
      action: 'user.update',
      resourceType: 'User',
      resourceId: id,
      payload: data,
      diff: null,
      metadata: {},
    });
  }
}
```

## API

### DrizzleAuditLogRepository

`AuditLogRepository` 추상 클래스의 Drizzle 구현체입니다.

#### Constructor

```typescript
constructor(
  db: DrizzleDb,
  txManager: TxManager<DrizzleDb>,
  config: DrizzleAuditLogRepositoryConfig
)
```

- `db`: Drizzle DB 인스턴스
- `txManager`: `@croco/tx-core`의 트랜잭션 매니저
- `config`: 테이블과 스키마 매핑 설정

#### Methods

- `create(entry)`: 감사 로그 항목 생성
- `find(query)`: 테넌트별 조회 (액터, 리소스 타입 필터 지원)
- `findByDateRange(tenantId, startDate, endDate, options?)`: 기간별 조회
- `findByActor(tenantId, actorId, options?)`: 액터별 조회
- `findByResource(tenantId, resourceType, resourceId, options?)`: 리소스별 조회

### Schema

- `auditLogsPg`: PostgreSQL용 스키마 (jsonb 사용)
- `auditLogsSqlite`: SQLite용 스키마 (text + JSON.stringify 사용)

## 테이블 스키마

```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,  -- SQLite
  -- 또는
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- PostgreSQL

  tenant_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,

  payload TEXT/JSONB NOT NULL DEFAULT '{}',
  diff TEXT/JSONB,
  metadata TEXT/JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMP/INTEGER NOT NULL
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_actor ON audit_logs(tenant_id, actor_id);
CREATE INDEX idx_audit_resource ON audit_logs(tenant_id, resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
```

## Peer Dependencies

- `drizzle-orm` >=0.30.0
- `@croco/audit-core` workspace:*
- `@croco/tx-core` workspace:*
- `@croco/tx-drizzle` workspace:*
