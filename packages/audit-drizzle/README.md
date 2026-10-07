# @croco/audit-drizzle

`@croco/audit-core`용 Drizzle 감사 로그 저장소입니다.

## 설치

```bash
pnpm add @croco/audit-drizzle @croco/audit-core @croco/tx-core drizzle-orm
```

## 사용법

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { TxManager } from "@croco/tx-core";
import { createDrizzleTxAdapter } from "@croco/tx-drizzle";
import { DrizzleAuditLogRepository, auditLogsSqlite } from "@croco/audit-drizzle";

const sqlite = new Database(":memory:");
const db = drizzle(sqlite);

const adapter = createDrizzleTxAdapter(db);
const txManager = new TxManager(adapter, { defaultNesting: "join" });

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
  tenantId: "tenant-1",
  actorId: "user-1",
  action: "user.update",
  resourceType: "User",
  resourceId: "user-1",
  payload: { email: "user@example.com" },
  diff: { email: { before: "old@example.com", after: "user@example.com" } },
  metadata: { requestId: "req-1" },
});

const logs = await repository.find({ tenantId: "tenant-1", limit: 10 });
```

저장소는 Drizzle JSON/JSONB 컬럼을 감지해 객체를 그대로 전달합니다. SQLite 같은 텍스트 컬럼은 기본적으로 JSON 문자열로 직렬화하며, `serializeJson`과 `deserializeJson`으로 이 동작을 바꿀 수 있습니다.

## 조회 순서와 페이지네이션

`find`, `findByDateRange`, `findByActor`, `findByResource`는 모두 `createdAt DESC, id DESC`로 정렬합니다. 같은 `createdAt`을 가진 항목도 순서가 고정되므로 데이터가 바뀌지 않는 동안 `limit`/`offset` 페이지 사이에서 항목이 중복되거나 누락되지 않습니다. 페이지를 읽는 사이에 새 항목이 추가되면 offset이 이동할 수 있습니다.

제공되는 SQLite 스키마의 `createdAt`은 초 단위입니다. 같은 초의 항목은 autoincrement `id` 내림차순으로 정렬되어 마지막에 삽입한 항목이 먼저 나옵니다. PostgreSQL 스키마의 `id`는 랜덤 UUID이므로 같은 시각 항목의 순서를 고정하지만 삽입 순서까지 보장하지는 않습니다.

## 검증

```bash
pnpm --filter @croco/audit-drizzle test
AUDIT_POSTGRES_URL=postgres://localhost/audit_test pnpm --filter @croco/audit-drizzle test:live
```

PostgreSQL 테스트는 `AUDIT_POSTGRES_URL`이 있을 때만 실행하며, 연결한 DB에서 임시 schema를 만들고 테스트 후 삭제합니다. 테스트 계정에는 schema 생성 권한이 필요합니다.

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
