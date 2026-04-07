# @croco/access-drizzle

@croco/access-core의 Drizzle ORM 기반 구현체입니다.

## 개요

`access-drizzle`은 PostgreSQL을 사용하는 재귀적 접근 제어 시스템을 제공합니다. 관계 그래프 탐색을 지원하여 복잡한 권한 구조를 처리할 수 있습니다.

## 데이터베이스 스키마

```sql
CREATE TABLE relation_tuples (
  tenant_id VARCHAR(255) NOT NULL,
  object VARCHAR(255) NOT NULL,
  relation VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  PRIMARY KEY (tenant_id, object, relation, subject)
);
```

## 사용법

### 초기화

```typescript
import { AccessEngine } from '@croco/access-core';
import { DrizzleAccessProvider } from '@croco/access-drizzle';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const provider = new DrizzleAccessProvider(db);
const accessEngine = new AccessEngine(provider);
```

### 기본 연산

```typescript
// 권한 확인
const result = await accessEngine.check({
  tenantId: 'tenant-123',
  subject: 'user:456',
  relation: 'editor',
  object: 'document:123',
});

console.log(result.allowed); // true or false

// 권한 부여
await accessEngine.grant({
  tenantId: 'tenant-123',
  tuple: {
    object: 'document:123',
    relation: 'editor',
    subject: 'user:456',
  },
});

// 권한 취소
await accessEngine.revoke({
  tenantId: 'tenant-123',
  tuple: {
    object: 'document:123',
    relation: 'editor',
    subject: 'user:456',
  },
});

// 권한 목록 조회
const permissions = await accessEngine.list({
  tenantId: 'tenant-123',
  subject: 'user:456',
});

console.log(permissions);
/*
[
  { object: 'document:123', relation: 'editor', subject: 'user:456' },
  { object: 'project:456', relation: 'viewer', subject: 'user:456' }
]
*/
```

## 재귀적 관계 조회

`access-drizzle`은 최대 10단계 깊이까지 관계 그래프를 탐색합니다.

```typescript
// 사용자가 문서의 편집자인지 확인
await accessEngine.check({
  tenantId: 'tenant-123',
  subject: 'user:456',
  relation: 'editor',
  object: 'document:123',
});

// 사용자가 프로젝트의 관리자이므로 문서에 접근 가능
await accessEngine.check({
  tenantId: 'tenant-123',
  subject: 'user:456',
  relation: 'editor',
  object: 'document:123',
});
```

## 타입 안전성

모든 연산은 타입 안전하게 처리됩니다. 런타임 타입 가드를 통해 데이터베이스에서 반환된 값을 검증합니다.

```typescript
function assertRelationTupleRow(row: unknown): row is RelationTupleRow {
  if (!row || typeof row !== 'object') {
    return false;
  }

  const record = row as Record<string, unknown>;
  return (
    typeof record.object === 'string' &&
    typeof record.relation === 'string' &&
    typeof record.subject === 'string'
  );
}
```

## 성능 최적화

- `ON CONFLICT DO NOTHING`으로 중복 삽입 방지
- 재귀적 쿼리의 최대 깊이 제한 (기본 10)
- 효율적인 WHERE 절 동적 생성

## 라이선스

MIT